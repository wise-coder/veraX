const { validationResult } = require("express-validator");

const ParkingSlot = require("../models/ParkingSlot");
const Payment = require("../models/Payment");
const Transaction = require("../models/Transaction");
const {
  buildPaginationMeta,
  buildSearchQuery,
  generateCode,
  getPagination,
  getTodayRange,
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

const serializeSlot = (slot) => ({
  id: slot._id,
  slotNumber: slot.slotNumber,
  status: slot.status,
  positionIndex: slot.positionIndex,
  currentVehicle: slot.currentVehicle
    ? {
      id: slot.currentVehicle._id || slot.currentVehicle,
      plateNumber: slot.currentVehicle.plateNumber || null,
      ownerName: slot.currentVehicle.ownerName || null,
      ownerPhone: slot.currentVehicle.ownerPhone || null,
      vehicleType: slot.currentVehicle.vehicleType || null,
      status: slot.currentVehicle.status || null,
      entryTime: slot.currentVehicle.entryTime || null,
      exitTime: slot.currentVehicle.exitTime || null,
    }
    : null,
  createdAt: slot.createdAt,
  updatedAt: slot.updatedAt,
});

const getParkingSlots = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const { page, limit, skip, sort } = getPagination(req.query, "positionIndex");
    const filter = {
      company: req.companyId,
      ...buildSearchQuery(search, ["slotNumber"]),
    };

    if (status) {
      filter.status = status;
    }

    const { start, end } = getTodayRange();

    const [slots, total, totalSlots, occupiedSlots, availableSlots, reservedSlots, maintenanceSlots, paidPaymentsToday] = await Promise.all([
      ParkingSlot.find(filter)
        .populate("currentVehicle", "plateNumber ownerName ownerPhone vehicleType status entryTime exitTime")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      ParkingSlot.countDocuments(filter),
      ParkingSlot.countDocuments({ company: req.companyId }),
      ParkingSlot.countDocuments({ company: req.companyId, status: "occupied" }),
      ParkingSlot.countDocuments({ company: req.companyId, status: "available" }),
      ParkingSlot.countDocuments({ company: req.companyId, status: "reserved" }),
      ParkingSlot.countDocuments({ company: req.companyId, status: "maintenance" }),
      Payment.find({ company: req.companyId, status: "paid", paidAt: { $gte: start, $lte: end } }).select("amount"),
    ]);

    return res.json({
      success: true,
      message: "Parking slots fetched successfully",
      data: {
        slots: slots.map(serializeSlot),
        summary: {
          totalSlots,
          occupiedSlots,
          availableSlots,
          reservedSlots,
          maintenanceSlots,
          todayRevenue: paidPaymentsToday.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
        },
        pagination: buildPaginationMeta(page, limit, total),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAvailableSlots = async (req, res, next) => {
  try {
    const slots = await ParkingSlot.find({
      company: req.companyId,
      status: "available",
      currentVehicle: null,
    }).sort({ positionIndex: 1 });

    return res.json({
      success: true,
      message: "Available parking slots fetched successfully",
      data: {
        slots: slots.map(serializeSlot),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getParkingSlotById = async (req, res, next) => {
  try {
    const slot = await ParkingSlot.findOne({ _id: req.params.id, company: req.companyId })
      .populate("currentVehicle", "plateNumber ownerName ownerPhone vehicleType status entryTime exitTime");

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Parking slot not found",
      });
    }

    return res.json({
      success: true,
      message: "Parking slot fetched successfully",
      data: serializeSlot(slot),
    });
  } catch (error) {
    next(error);
  }
};

const createParkingSlot = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const normalizedSlotNumber = req.body.slotNumber.trim().toUpperCase();
    const existingSlot = await ParkingSlot.findOne({ company: req.companyId, slotNumber: normalizedSlotNumber });

    if (existingSlot) {
      return res.status(400).json({
        success: false,
        message: "Parking slot number already exists",
      });
    }

    const highestPositionSlot = await ParkingSlot.findOne({ company: req.companyId }).sort({ positionIndex: -1 });
    const positionIndex = req.body.positionIndex || (highestPositionSlot ? highestPositionSlot.positionIndex + 1 : 1);

    const duplicatePosition = await ParkingSlot.findOne({ company: req.companyId, positionIndex });

    if (duplicatePosition) {
      return res.status(400).json({
        success: false,
        message: "Position index already exists",
      });
    }

    if (req.body.status === "occupied") {
      return res.status(400).json({
        success: false,
        message: "New parking slot cannot start as occupied",
      });
    }

    const slot = await ParkingSlot.create({
      company: req.companyId,
      slotNumber: normalizedSlotNumber,
      status: req.body.status || "available",
      positionIndex,
    });

    return res.status(201).json({
      success: true,
      message: "Parking slot created successfully",
      data: serializeSlot(slot),
    });
  } catch (error) {
    next(error);
  }
};

const updateParkingSlot = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const slot = await ParkingSlot.findOne({ _id: req.params.id, company: req.companyId })
      .populate("currentVehicle", "plateNumber ownerName vehicleType");

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Parking slot not found",
      });
    }

    if (req.body.slotNumber) {
      const normalizedSlotNumber = req.body.slotNumber.trim().toUpperCase();
      const duplicateSlot = await ParkingSlot.findOne({
        _id: { $ne: slot._id },
        company: req.companyId,
        slotNumber: normalizedSlotNumber,
      });

      if (duplicateSlot) {
        return res.status(400).json({
          success: false,
          message: "Parking slot number already exists",
        });
      }

      slot.slotNumber = normalizedSlotNumber;
    }

    if (req.body.positionIndex && Number(req.body.positionIndex) !== slot.positionIndex) {
      const duplicatePosition = await ParkingSlot.findOne({
        _id: { $ne: slot._id },
        company: req.companyId,
        positionIndex: Number(req.body.positionIndex),
      });

      if (duplicatePosition) {
        return res.status(400).json({
          success: false,
          message: "Position index already exists",
        });
      }

      slot.positionIndex = Number(req.body.positionIndex);
    }

    if (req.body.status) {
      if (slot.currentVehicle && req.body.status !== "occupied") {
        return res.status(400).json({
          success: false,
          message: "Cannot change status of an occupied slot manually",
        });
      }

      if (!slot.currentVehicle && req.body.status === "occupied") {
        return res.status(400).json({
          success: false,
          message: "Cannot mark slot as occupied without assigning a vehicle",
        });
      }

      slot.status = req.body.status;
    }

    if (slot.currentVehicle) {
      slot.status = "occupied";
    }

    await slot.save();

    const transaction = await Transaction.create({
      company: req.companyId,
      transactionCode: generateCode("TRX"),
      vehicle: slot.currentVehicle?._id || null,
      plateNumber: slot.currentVehicle?.plateNumber || "N/A",
      type: "slot_update",
      parkingSlot: slot._id,
      amount: 0,
      status: "completed",
      description: `Parking slot ${slot.slotNumber} updated`,
      createdBy: req.user._id,
    });

    const updatedSlot = await ParkingSlot.findOne({ _id: slot._id, company: req.companyId })
      .populate("currentVehicle", "plateNumber ownerName ownerPhone vehicleType status entryTime exitTime");

    return res.json({
      success: true,
      message: "Parking slot updated successfully",
      data: {
        slot: serializeSlot(updatedSlot),
        transactionId: transaction._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

const deleteParkingSlot = async (req, res, next) => {
  try {
    const slot = await ParkingSlot.findOne({ _id: req.params.id, company: req.companyId });

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Parking slot not found",
      });
    }

    if (slot.status === "occupied" || slot.currentVehicle) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete an occupied parking slot",
      });
    }

    await slot.deleteOne();

    return res.json({
      success: true,
      message: "Parking slot deleted successfully",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getParkingSlots,
  getAvailableSlots,
  getParkingSlotById,
  createParkingSlot,
  updateParkingSlot,
  deleteParkingSlot,
};
