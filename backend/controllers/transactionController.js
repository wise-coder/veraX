const Transaction = require("../models/Transaction");
const ParkingSlot = require("../models/ParkingSlot");
const {
  buildPaginationMeta,
  buildRegex,
  getDateRange,
  getPagination,
  toCsv,
} = require("../utils/systemHelpers");

const serializeTransaction = (transaction) => ({
  id: transaction._id,
  transactionCode: transaction.transactionCode,
  plateNumber: transaction.plateNumber,
  type: transaction.type,
  parkingSlot: transaction.parkingSlot
    ? {
      id: transaction.parkingSlot._id || transaction.parkingSlot,
      slotNumber: transaction.parkingSlot.slotNumber || null,
    }
    : null,
  amount: transaction.amount,
  status: transaction.status,
  description: transaction.description,
  vehicle: transaction.vehicle
    ? {
      id: transaction.vehicle._id || transaction.vehicle,
      plateNumber: transaction.vehicle.plateNumber || transaction.plateNumber,
      vehicleType: transaction.vehicle.vehicleType || null,
    }
    : null,
  createdBy: transaction.createdBy
    ? {
      id: transaction.createdBy._id || transaction.createdBy,
      fullName: transaction.createdBy.fullName || null,
      role: transaction.createdBy.role || null,
    }
    : null,
  createdAt: transaction.createdAt,
});

const getTransactions = async (req, res, next) => {
  try {
    const { search, status, type, export: exportType, parkingSlot } = req.query;
    const { page, limit, skip, sort } = getPagination(req.query);
    const dateRange = getDateRange(req.query.startDate, req.query.endDate);
    const filter = { company: req.companyId };

    if (status) {
      filter.status = status;
    }

    if (type) {
      filter.type = type;
    }

    if (parkingSlot) {
      filter.parkingSlot = parkingSlot;
    }

    if (dateRange) {
      filter.createdAt = dateRange;
    }

    if (search) {
      const regex = buildRegex(search);
      const slotIds = await ParkingSlot.find({ company: req.companyId, slotNumber: regex }).distinct("_id");
      filter.$or = [
        { transactionCode: regex },
        { plateNumber: regex },
        { type: regex },
      ];

      if (slotIds.length) {
        filter.$or.push({ parkingSlot: { $in: slotIds } });
      }
    }

    const query = Transaction.find(filter)
      .populate("parkingSlot", "slotNumber")
      .populate("createdBy", "fullName role")
      .populate("vehicle", "plateNumber vehicleType")
      .sort(sort);

    if (exportType === "csv" || exportType === "json") {
      const transactions = await query;
      const rows = transactions.map((transaction) => serializeTransaction(transaction));

      if (exportType === "json") {
        return res.json({
          success: true,
          message: "Transactions exported successfully",
          data: rows,
        });
      }

      const csv = toCsv(
        [
          { key: "transactionCode", label: "Transaction Code" },
          { key: "plateNumber", label: "Plate Number" },
          { key: "type", label: "Type" },
          { key: "slotNumber", label: "Parking Slot" },
          { key: "amount", label: "Amount" },
          { key: "status", label: "Status" },
          { key: "description", label: "Description" },
          { key: "createdAt", label: "Created At" },
          { key: "createdBy", label: "Created By" },
        ],
        rows.map((row) => ({
          transactionCode: row.transactionCode,
          plateNumber: row.plateNumber,
          type: row.type,
          slotNumber: row.parkingSlot?.slotNumber || "",
          amount: row.amount,
          status: row.status,
          description: row.description,
          createdAt: row.createdAt,
          createdBy: row.createdBy?.fullName || "",
        })),
      );

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=transactions.csv");
      return res.send(csv);
    }

    const [transactions, total] = await Promise.all([
      query.skip(skip).limit(limit),
      Transaction.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      message: "Transactions fetched successfully",
      data: {
        transactions: transactions.map((transaction) => serializeTransaction(transaction)),
        pagination: buildPaginationMeta(page, limit, total),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, company: req.companyId })
      .populate("parkingSlot", "slotNumber status positionIndex")
      .populate("createdBy", "fullName email phone role")
      .populate("vehicle", "plateNumber ownerName ownerPhone vehicleType status entryTime exitTime");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    return res.json({
      success: true,
      message: "Transaction fetched successfully",
      data: serializeTransaction(transaction),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTransactions,
  getTransactionById,
};
