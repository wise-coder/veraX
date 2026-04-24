const { validationResult } = require("express-validator");

const ParkingSlot = require("../models/ParkingSlot");
const Payment = require("../models/Payment");
const Transaction = require("../models/Transaction");
const Vehicle = require("../models/Vehicle");
const {
  buildPaginationMeta,
  buildRegex,
  generateCode,
  getPagination,
  toCsv,
} = require("../utils/systemHelpers");

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

const serializePayment = (payment) => ({
  id: payment._id,
  paymentCode: payment.paymentCode,
  plateNumber: payment.plateNumber,
  amount: payment.amount,
  paymentMethod: payment.paymentMethod,
  status: payment.status,
  paidAt: payment.paidAt,
  vehicle: payment.vehicle
    ? {
      id: payment.vehicle._id || payment.vehicle,
      plateNumber: payment.vehicle.plateNumber || payment.plateNumber,
      ownerName: payment.vehicle.ownerName || null,
      vehicleType: payment.vehicle.vehicleType || null,
    }
    : null,
  receivedBy: payment.receivedBy
    ? {
      id: payment.receivedBy._id || payment.receivedBy,
      fullName: payment.receivedBy.fullName || null,
      role: payment.receivedBy.role || null,
    }
    : null,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
});

const getPayments = async (req, res, next) => {
  try {
    const { search, status, paymentMethod, export: exportType } = req.query;
    const { page, limit, skip, sort } = getPagination(req.query);
    const filter = { company: req.companyId };

    if (status) {
      filter.status = status;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};

      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate);
      }

      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    if (search) {
      const regex = buildRegex(search);
      filter.$or = [
        { paymentCode: regex },
        { plateNumber: regex },
        { paymentMethod: regex },
      ];
    }

    const baseQuery = Payment.find(filter)
      .populate("vehicle", "plateNumber ownerName vehicleType")
      .populate("receivedBy", "fullName role")
      .sort(sort);

    if (exportType === "csv" || exportType === "json") {
      const payments = await baseQuery;
      const rows = payments.map((payment) => serializePayment(payment));

      if (exportType === "json") {
        return res.json({
          success: true,
          message: "Payments exported successfully",
          data: rows,
        });
      }

      const csv = toCsv(
        [
          { key: "paymentCode", label: "Payment Code" },
          { key: "plateNumber", label: "Plate Number" },
          { key: "amount", label: "Amount" },
          { key: "paymentMethod", label: "Payment Method" },
          { key: "status", label: "Status" },
          { key: "paidAt", label: "Paid At" },
          { key: "receivedBy", label: "Received By" },
        ],
        rows.map((row) => ({
          paymentCode: row.paymentCode,
          plateNumber: row.plateNumber,
          amount: row.amount,
          paymentMethod: row.paymentMethod,
          status: row.status,
          paidAt: row.paidAt || "",
          receivedBy: row.receivedBy?.fullName || "",
        })),
      );

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=payments.csv");
      return res.send(csv);
    }

    const [payments, total, paidPayments, totalVehicles, totalTransactions, totalSlots, occupiedSlots] = await Promise.all([
      baseQuery.skip(skip).limit(limit),
      Payment.countDocuments(filter),
      Payment.find({ company: req.companyId, status: "paid" }).select("amount"),
      Vehicle.countDocuments({ company: req.companyId }),
      Transaction.countDocuments({ company: req.companyId }),
      ParkingSlot.countDocuments({ company: req.companyId }),
      ParkingSlot.countDocuments({ company: req.companyId, status: "occupied" }),
    ]);

    return res.json({
      success: true,
      message: "Payments fetched successfully",
      data: {
        summary: {
          totalRevenue: paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
          totalVehicles,
          totalTransactions,
          occupancyRate: totalSlots ? Number(((occupiedSlots / totalSlots) * 100).toFixed(2)) : 0,
        },
        payments: payments.map((payment) => serializePayment(payment)),
        pagination: buildPaginationMeta(page, limit, total),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, company: req.companyId })
      .populate("vehicle", "plateNumber ownerName ownerPhone vehicleType status entryTime exitTime")
      .populate("receivedBy", "fullName email phone role");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    return res.json({
      success: true,
      message: "Payment fetched successfully",
      data: serializePayment(payment),
    });
  } catch (error) {
    next(error);
  }
};

const markPaymentAsPaid = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const payment = await Payment.findOne({ _id: req.params.id, company: req.companyId })
      .populate("vehicle", "plateNumber currentSlot");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment is already marked as paid",
      });
    }

    payment.status = "paid";
    payment.paidAt = new Date();
    payment.receivedBy = req.user._id;

    if (req.body.paymentMethod) {
      payment.paymentMethod = req.body.paymentMethod;
    }

    await payment.save();

    const latestCheckoutTransaction = await Transaction.findOne({
      company: req.companyId,
      vehicle: payment.vehicle?._id || payment.vehicle,
      type: "check_out",
    }).sort({ createdAt: -1 });

    await Transaction.create({
      company: req.companyId,
      transactionCode: generateCode("TRX"),
      vehicle: payment.vehicle?._id || payment.vehicle,
      plateNumber: payment.plateNumber,
      type: "payment",
      parkingSlot: latestCheckoutTransaction?.parkingSlot || null,
      amount: payment.amount,
      status: "completed",
      description: `Payment ${payment.paymentCode} marked as paid`,
      createdBy: req.user._id,
    });

    const updatedPayment = await Payment.findOne({ _id: payment._id, company: req.companyId })
      .populate("vehicle", "plateNumber ownerName vehicleType")
      .populate("receivedBy", "fullName role");

    return res.json({
      success: true,
      message: "Payment marked as paid successfully",
      data: serializePayment(updatedPayment),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPayments,
  getPaymentById,
  markPaymentAsPaid,
};
