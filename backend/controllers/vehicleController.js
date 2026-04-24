const { validationResult } = require("express-validator");

const ParkingSlot = require("../models/ParkingSlot");
const Payment = require("../models/Payment");
const Transaction = require("../models/Transaction");
const Vehicle = require("../models/Vehicle");
const calculateParkingFee = require("../utils/calculateParkingFee");
const {
  buildPaginationMeta,
  buildSearchQuery,
  ensureSettings,
  generateCode,
  getDashboardOverviewData,
  getPagination,
} = require("../utils/systemHelpers");

const VEHICLE_POPULATE = [
  { path: "currentSlot", select: "slotNumber status positionIndex" },
  { path: "createdBy", select: "fullName email phone role" },
];

const SLOT_POPULATE = {
  path: "currentVehicle",
  select: "plateNumber ownerName ownerPhone vehicleType status entryTime exitTime",
};

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

const serializeVehicle = (vehicle) => ({
  id: vehicle._id,
  plateNumber: vehicle.plateNumber,
  ownerName: vehicle.ownerName,
  ownerPhone: vehicle.ownerPhone,
  vehicleType: vehicle.vehicleType,
  status: vehicle.status,
  currentSlot: vehicle.currentSlot
    ? {
      id: vehicle.currentSlot._id || vehicle.currentSlot,
      slotNumber: vehicle.currentSlot.slotNumber || null,
      status: vehicle.currentSlot.status || null,
      positionIndex: vehicle.currentSlot.positionIndex || null,
    }
    : null,
  entryTime: vehicle.entryTime,
  exitTime: vehicle.exitTime,
  createdBy: vehicle.createdBy
    ? {
      id: vehicle.createdBy._id || vehicle.createdBy,
      fullName: vehicle.createdBy.fullName || null,
      email: vehicle.createdBy.email || null,
      phone: vehicle.createdBy.phone || null,
      role: vehicle.createdBy.role || null,
    }
    : null,
  createdAt: vehicle.createdAt,
  updatedAt: vehicle.updatedAt,
});

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

const serializeTransaction = (transaction) => ({
  id: transaction._id,
  transactionCode: transaction.transactionCode,
  plateNumber: transaction.plateNumber,
  type: transaction.type,
  amount: transaction.amount,
  status: transaction.status,
  description: transaction.description,
  parkingSlot: transaction.parkingSlot
    ? {
      id: transaction.parkingSlot._id || transaction.parkingSlot,
      slotNumber: transaction.parkingSlot.slotNumber || null,
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

const getAssignableSlot = async (parkingSlotId, settings, companyId) => {
  let slot = null;

  if (parkingSlotId) {
    slot = await ParkingSlot.findOne({ _id: parkingSlotId, company: companyId });

    if (!slot) {
      const error = new Error("Parking slot not found");
      error.statusCode = 404;
      throw error;
    }

    if (slot.status !== "available" || slot.currentVehicle) {
      const error = new Error("Selected parking slot is not available");
      error.statusCode = 400;
      throw error;
    }

    return slot;
  }

  if (!settings.autoAssignSlot) {
    const error = new Error("No parking slot selected and auto assignment is disabled");
    error.statusCode = 400;
    throw error;
  }

  slot = await ParkingSlot.findOne({
    company: companyId,
    status: "available",
    currentVehicle: null,
  }).sort({ positionIndex: 1 });

  if (!slot) {
    const error = new Error("No available parking slot found");
    error.statusCode = 400;
    throw error;
  }

  return slot;
};

const processVehicleCheckIn = async (req, res, successMessage) => {
  const validationResponse = validationErrorResponse(req, res);

  if (validationResponse) {
    return validationResponse;
  }

  const settings = await ensureSettings(req.companyId);
  const normalizedPlateNumber = req.body.plateNumber.trim().toUpperCase();
  const activeVehicle = await Vehicle.findOne({
    company: req.companyId,
    plateNumber: normalizedPlateNumber,
    status: "parked",
  });

  if (activeVehicle) {
    return res.status(400).json({
      success: false,
      message: "Vehicle is already parked",
    });
  }

  const slot = await getAssignableSlot(req.body.parkingSlotId, settings, req.companyId);
  const entryTime = req.body.entryTime ? new Date(req.body.entryTime) : new Date();
  let vehicle = await Vehicle.findOne({
    company: req.companyId,
    plateNumber: normalizedPlateNumber,
  }).sort({ updatedAt: -1 });

  if (!vehicle) {
    vehicle = new Vehicle({
      company: req.companyId,
      plateNumber: normalizedPlateNumber,
      ownerName: req.body.ownerName,
      ownerPhone: req.body.ownerPhone,
      vehicleType: req.body.vehicleType,
      createdBy: req.user._id,
    });
  }

  vehicle.plateNumber = normalizedPlateNumber;
  vehicle.ownerName = req.body.ownerName;
  vehicle.ownerPhone = req.body.ownerPhone;
  vehicle.vehicleType = req.body.vehicleType;
  vehicle.company = req.companyId;
  vehicle.status = "parked";
  vehicle.currentSlot = slot._id;
  vehicle.entryTime = entryTime;
  vehicle.exitTime = null;

  if (!vehicle.createdBy) {
    vehicle.createdBy = req.user._id;
  }

  await vehicle.save();

  slot.status = "occupied";
  slot.currentVehicle = vehicle._id;
  await slot.save();

  const transaction = await Transaction.create({
    company: req.companyId,
    transactionCode: generateCode("TRX"),
    vehicle: vehicle._id,
    plateNumber: vehicle.plateNumber,
    type: "check_in",
    parkingSlot: slot._id,
    amount: 0,
    status: "completed",
    description: req.body.note || `Vehicle ${vehicle.plateNumber} checked in to slot ${slot.slotNumber}`,
    createdBy: req.user._id,
  });

  const [populatedVehicle, populatedSlot, populatedTransaction, dashboard] = await Promise.all([
    Vehicle.findOne({ _id: vehicle._id, company: req.companyId }).populate(VEHICLE_POPULATE),
    ParkingSlot.findOne({ _id: slot._id, company: req.companyId }).populate(SLOT_POPULATE),
    Transaction.findOne({ _id: transaction._id, company: req.companyId })
      .populate("parkingSlot", "slotNumber")
      .populate("createdBy", "fullName role"),
    getDashboardOverviewData(req.companyId),
  ]);

  return res.status(201).json({
    success: true,
    message: successMessage,
    data: {
      vehicle: serializeVehicle(populatedVehicle),
      slot: serializeSlot(populatedSlot),
      transaction: serializeTransaction(populatedTransaction),
      dashboard,
    },
  });
};

const getVehicles = async (req, res, next) => {
  try {
    const { search, status, vehicleType } = req.query;
    const { page, limit, skip, sort } = getPagination(req.query);
    const filter = {
      company: req.companyId,
      ...buildSearchQuery(search, ["plateNumber", "ownerName", "ownerPhone"]),
    };

    if (status) {
      filter.status = status;
    }

    if (vehicleType) {
      filter.vehicleType = vehicleType;
    }

    const [vehicles, total, parkedCount, checkedOutCount] = await Promise.all([
      Vehicle.find(filter)
        .populate(VEHICLE_POPULATE)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Vehicle.countDocuments(filter),
      Vehicle.countDocuments({ company: req.companyId, status: "parked" }),
      Vehicle.countDocuments({ company: req.companyId, status: "checked_out" }),
    ]);

    return res.json({
      success: true,
      message: "Vehicles fetched successfully",
      data: {
        vehicles: vehicles.map(serializeVehicle),
        summary: {
          totalVehicles: total,
          parkedVehicles: parkedCount,
          checkedOutVehicles: checkedOutCount,
        },
        pagination: buildPaginationMeta(page, limit, total),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createVehicle = async (req, res, next) => {
  try {
    return await processVehicleCheckIn(req, res, "Vehicle added and checked in successfully");
  } catch (error) {
    next(error);
  }
};

const checkInVehicle = async (req, res, next) => {
  try {
    return await processVehicleCheckIn(req, res, "Vehicle checked in successfully");
  } catch (error) {
    next(error);
  }
};

const getVehicleById = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, company: req.companyId }).populate(VEHICLE_POPULATE);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    const [transactions, payments] = await Promise.all([
      Transaction.find({ company: req.companyId, vehicle: vehicle._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("parkingSlot", "slotNumber")
        .populate("createdBy", "fullName role"),
      Payment.find({ company: req.companyId, vehicle: vehicle._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("receivedBy", "fullName role"),
    ]);

    return res.json({
      success: true,
      message: "Vehicle fetched successfully",
      data: {
        vehicle: serializeVehicle(vehicle),
        transactions: transactions.map(serializeTransaction),
        payments: payments.map(serializePayment),
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateVehicle = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const vehicle = await Vehicle.findOne({ _id: req.params.id, company: req.companyId });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    if (req.body.plateNumber) {
      const normalizedPlateNumber = req.body.plateNumber.trim().toUpperCase();
      const duplicateActiveVehicle = await Vehicle.findOne({
        _id: { $ne: vehicle._id },
        company: req.companyId,
        plateNumber: normalizedPlateNumber,
        status: "parked",
      });

      if (duplicateActiveVehicle) {
        return res.status(400).json({
          success: false,
          message: "Another active parked vehicle already uses that plate number",
        });
      }

      vehicle.plateNumber = normalizedPlateNumber;
    }

    vehicle.ownerName = req.body.ownerName || vehicle.ownerName;
    vehicle.ownerPhone = req.body.ownerPhone || vehicle.ownerPhone;
    vehicle.vehicleType = req.body.vehicleType || vehicle.vehicleType;

    await vehicle.save();

    const updatedVehicle = await Vehicle.findOne({ _id: vehicle._id, company: req.companyId }).populate(VEHICLE_POPULATE);

    return res.json({
      success: true,
      message: "Vehicle updated successfully",
      data: serializeVehicle(updatedVehicle),
    });
  } catch (error) {
    next(error);
  }
};

const deleteVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, company: req.companyId });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    if (vehicle.status === "parked" || vehicle.currentSlot) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete a vehicle that is currently parked",
      });
    }

    const pendingPayment = await Payment.findOne({ company: req.companyId, vehicle: vehicle._id, status: "pending" });

    if (pendingPayment) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete vehicle with pending payment",
      });
    }

    await vehicle.deleteOne();

    return res.json({
      success: true,
      message: "Vehicle deleted successfully",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

const checkOutVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, company: req.companyId })
      .populate("currentSlot", "slotNumber status positionIndex");

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    if (vehicle.status === "checked_out") {
      return res.status(400).json({
        success: false,
        message: "Vehicle is already checked out",
      });
    }

    const settings = await ensureSettings(req.companyId);
    const now = new Date();
    const slotId = vehicle.currentSlot?._id || vehicle.currentSlot;
    const slot = slotId ? await ParkingSlot.findOne({ _id: slotId, company: req.companyId }) : null;
    const feeDetails = calculateParkingFee({
      entryTime: vehicle.entryTime,
      exitTime: now,
      vehicleType: vehicle.vehicleType,
      settings,
    });

    vehicle.exitTime = now;
    vehicle.status = "checked_out";
    vehicle.currentSlot = null;
    await vehicle.save();

    if (slot) {
      slot.status = "available";
      slot.currentVehicle = null;
      await slot.save();
    }

    const transaction = await Transaction.create({
      company: req.companyId,
      transactionCode: generateCode("TRX"),
      vehicle: vehicle._id,
      plateNumber: vehicle.plateNumber,
      type: "check_out",
      parkingSlot: slot ? slot._id : null,
      amount: feeDetails.amount,
      status: "completed",
      description: `Vehicle ${vehicle.plateNumber} checked out after ${feeDetails.durationHours} hours`,
      createdBy: req.user._id,
    });

    const paymentStatus = req.body.markAsPaid || req.body.status === "paid" ? "paid" : "pending";
    const payment = await Payment.create({
      company: req.companyId,
      paymentCode: generateCode("PAY"),
      vehicle: vehicle._id,
      plateNumber: vehicle.plateNumber,
      amount: feeDetails.amount,
      paymentMethod: req.body.paymentMethod || "cash",
      status: paymentStatus,
      paidAt: paymentStatus === "paid" ? now : null,
      receivedBy: paymentStatus === "paid" ? req.user._id : null,
    });

    if (payment.status === "paid") {
      await Transaction.create({
        company: req.companyId,
        transactionCode: generateCode("TRX"),
        vehicle: vehicle._id,
        plateNumber: vehicle.plateNumber,
        type: "payment",
        parkingSlot: slot ? slot._id : null,
        amount: payment.amount,
        status: "completed",
        description: `Payment received for ${vehicle.plateNumber}`,
        createdBy: req.user._id,
      });
    }

    const [updatedVehicle, updatedPayment, updatedTransaction, dashboard] = await Promise.all([
      Vehicle.findOne({ _id: vehicle._id, company: req.companyId }).populate(VEHICLE_POPULATE),
      Payment.findOne({ _id: payment._id, company: req.companyId })
        .populate("vehicle", "plateNumber")
        .populate("receivedBy", "fullName role"),
      Transaction.findOne({ _id: transaction._id, company: req.companyId })
        .populate("parkingSlot", "slotNumber")
        .populate("createdBy", "fullName role"),
      getDashboardOverviewData(req.companyId),
    ]);

    return res.json({
      success: true,
      message: "Vehicle checked out successfully",
      data: {
        vehicle: serializeVehicle(updatedVehicle),
        payment: serializePayment(updatedPayment),
        transaction: serializeTransaction(updatedTransaction),
        freedSlot: slot
          ? {
            id: slot._id,
            slotNumber: slot.slotNumber,
            status: slot.status,
            positionIndex: slot.positionIndex,
          }
          : null,
        feeDetails,
        dashboard,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVehicles,
  createVehicle,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  checkInVehicle,
  checkOutVehicle,
};
