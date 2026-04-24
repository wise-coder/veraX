const { validationResult } = require("express-validator");

const ParkingSlot = require("../models/ParkingSlot");
const Payment = require("../models/Payment");
const Transaction = require("../models/Transaction");
const Vehicle = require("../models/Vehicle");
const { getDateRange } = require("../utils/systemHelpers");

const validationErrorResponse = (req, res) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return null;
  }

  return res.status(400).json({
    success: false,
    message: errors.array()[0].msg,
  });
};

const normalizeIds = (items = []) => items.filter(Boolean).map((item) => item.toString());

const unionIds = (...lists) => [...new Set(lists.flatMap((list) => normalizeIds(list)))];

const intersectIds = (...lists) => {
  const normalizedLists = lists
    .filter((list) => Array.isArray(list))
    .map((list) => normalizeIds(list));

  if (!normalizedLists.length) {
    return [];
  }

  return normalizedLists.reduce((accumulator, currentList) => accumulator.filter((item) => currentList.includes(item)));
};

const buildRevenueOverTime = (payments) => {
  const bucket = new Map();

  payments.forEach((payment) => {
    const key = payment.paidAt ? new Date(payment.paidAt).toISOString().slice(0, 10) : "unknown";
    bucket.set(key, Number(((bucket.get(key) || 0) + Number(payment.amount || 0)).toFixed(2)));
  });

  return [...bucket.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, amount]) => ({ date, amount }));
};

const getReports = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const { parkingSlot, paymentMethod } = req.query;
    const hasFilters = Boolean(req.query.startDate || req.query.endDate || parkingSlot || paymentMethod);
    const dateRange = getDateRange(req.query.startDate, req.query.endDate);
    const transactionScopeFilter = {};
    const paymentScopeFilter = { status: "paid" };

    if (dateRange) {
      transactionScopeFilter.createdAt = dateRange;
      paymentScopeFilter.paidAt = dateRange;
    }

    if (parkingSlot) {
      transactionScopeFilter.parkingSlot = parkingSlot;
    }

    if (paymentMethod) {
      paymentScopeFilter.paymentMethod = paymentMethod;
    }

    const [transactionVehicleIds, paymentVehicleIds] = await Promise.all([
      Transaction.distinct("vehicle", { ...transactionScopeFilter, vehicle: { $ne: null } }),
      Payment.distinct("vehicle", paymentScopeFilter),
    ]);

    let scopedVehicleIds = null;

    if (parkingSlot && paymentMethod) {
      scopedVehicleIds = intersectIds(transactionVehicleIds, paymentVehicleIds);
    } else if (parkingSlot) {
      scopedVehicleIds = normalizeIds(transactionVehicleIds);
    } else if (paymentMethod) {
      scopedVehicleIds = normalizeIds(paymentVehicleIds);
    } else if (dateRange) {
      scopedVehicleIds = unionIds(transactionVehicleIds, paymentVehicleIds);
    }

    if (Array.isArray(scopedVehicleIds)) {
      paymentScopeFilter.vehicle = { $in: scopedVehicleIds };
      transactionScopeFilter.vehicle = { $in: scopedVehicleIds };
    }

    const topSlotsMatch = {
      ...transactionScopeFilter,
      type: "check_out",
      status: "completed",
      amount: { $gt: 0 },
      parkingSlot: parkingSlot || { $ne: null },
    };

    const [paidPayments, totalTransactions, recentTransactions, topSlotsAggregation] = await Promise.all([
      Payment.find(paymentScopeFilter)
        .populate("vehicle", "plateNumber ownerName vehicleType")
        .sort({ paidAt: 1 }),
      Transaction.countDocuments(transactionScopeFilter),
      Transaction.find(transactionScopeFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("parkingSlot", "slotNumber")
        .populate("createdBy", "fullName role")
        .populate("vehicle", "plateNumber ownerName vehicleType"),
      Transaction.aggregate([
        {
          $match: topSlotsMatch,
        },
        {
          $group: {
            _id: "$parkingSlot",
            revenue: { $sum: "$amount" },
            transactions: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const slotIds = topSlotsAggregation.map((slot) => slot._id).filter(Boolean);
    const slots = slotIds.length ? await ParkingSlot.find({ _id: { $in: slotIds } }).select("slotNumber") : [];
    const slotMap = new Map(slots.map((slot) => [slot._id.toString(), slot.slotNumber]));

    const reportVehicleFilter = Array.isArray(scopedVehicleIds)
      ? { _id: { $in: scopedVehicleIds } }
      : {};

    const [vehiclesForStatusChart, completedVehicles] = await Promise.all([
      Vehicle.find(reportVehicleFilter).select("status"),
      Vehicle.find({
        ...reportVehicleFilter,
        entryTime: { $ne: null },
        exitTime: { $ne: null },
      }).select("entryTime exitTime"),
    ]);

    const totalRevenue = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const averageParkingDuration = completedVehicles.length
      ? Number(
        (
          completedVehicles.reduce((sum, vehicle) => {
            const durationHours = (new Date(vehicle.exitTime) - new Date(vehicle.entryTime)) / (1000 * 60 * 60);
            return sum + durationHours;
          }, 0) / completedVehicles.length
        ).toFixed(2),
      )
      : 0;

    return res.json({
      success: true,
      message: "Reports fetched successfully",
      data: {
        totalRevenue,
        totalVehicles: hasFilters
          ? (Array.isArray(scopedVehicleIds) ? scopedVehicleIds.length : 0)
          : await Vehicle.countDocuments(),
        totalTransactions,
        averageParkingDuration,
        revenueOverTime: buildRevenueOverTime(paidPayments),
        vehicleStatusChart: {
          parked: vehiclesForStatusChart.filter((vehicle) => vehicle.status === "parked").length,
          checkedOut: vehiclesForStatusChart.filter((vehicle) => vehicle.status === "checked_out").length,
        },
        topParkingSlotsByRevenue: topSlotsAggregation.map((slot) => ({
          parkingSlotId: slot._id,
          slotNumber: slotMap.get(slot._id.toString()) || "Unknown",
          revenue: Number(slot.revenue.toFixed(2)),
          transactions: slot.transactions,
        })),
        recentActivity: recentTransactions.map((transaction) => ({
          id: transaction._id,
          transactionCode: transaction.transactionCode,
          plateNumber: transaction.plateNumber,
          type: transaction.type,
          amount: transaction.amount,
          status: transaction.status,
          slotNumber: transaction.parkingSlot?.slotNumber || null,
          createdBy: transaction.createdBy?.fullName || null,
          createdAt: transaction.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReports,
};
