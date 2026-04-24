const { validationResult } = require("express-validator");
const ParkingSlot = require("../models/ParkingSlot");
const Setting = require("../models/Setting");
const { ensureSettings } = require("../utils/systemHelpers");

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

const syncParkingSlotCount = async (targetTotal) => {
  const slots = await ParkingSlot.find().sort({ positionIndex: 1 });
  const currentTotal = slots.length;

  if (targetTotal === currentTotal) {
    return;
  }

  if (targetTotal > currentTotal) {
    const newSlots = [];

    for (let index = currentTotal + 1; index <= targetTotal; index += 1) {
      newSlots.push({
        slotNumber: `P${index}`,
        positionIndex: index,
        status: "available",
      });
    }

    if (newSlots.length) {
      await ParkingSlot.insertMany(newSlots);
    }

    return;
  }

  const removableSlots = slots.filter((slot) => slot.status === "available").reverse();
  const slotsToRemoveCount = currentTotal - targetTotal;

  if (removableSlots.length < slotsToRemoveCount) {
    const error = new Error("Cannot reduce total parking slots because some slots are occupied, reserved, or under maintenance");
    error.statusCode = 400;
    throw error;
  }

  const removableIds = removableSlots.slice(0, slotsToRemoveCount).map((slot) => slot._id);
  await ParkingSlot.deleteMany({ _id: { $in: removableIds } });
};

const getSettings = async (_req, res, next) => {
  try {
    const settings = await ensureSettings();

    return res.json({
      success: true,
      message: "Settings fetched successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const settings = await ensureSettings();
    const updates = req.body;

    if (updates.totalParkingSlots !== undefined && Number(updates.totalParkingSlots) < 1) {
      return res.status(400).json({
        success: false,
        message: "Total parking slots must be at least 1",
      });
    }

    if (updates.sessionTimeout !== undefined && Number(updates.sessionTimeout) < 1) {
      return res.status(400).json({
        success: false,
        message: "Session timeout must be greater than 0",
      });
    }

    if (updates.pricePerHour !== undefined && Number(updates.pricePerHour) < 0) {
      return res.status(400).json({
        success: false,
        message: "Price per hour cannot be negative",
      });
    }

    Object.keys(Setting.DEFAULT_SETTINGS).forEach((key) => {
      if (updates[key] !== undefined) {
        settings[key] = updates[key];
      }
    });

    if (updates.totalParkingSlots !== undefined) {
      await syncParkingSlotCount(Number(updates.totalParkingSlots));
    }

    await settings.save();

    return res.json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const resetSettings = async (_req, res, next) => {
  try {
    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create(Setting.DEFAULT_SETTINGS);
    }

    Object.entries(Setting.DEFAULT_SETTINGS).forEach(([key, value]) => {
      settings[key] = value;
    });

    await syncParkingSlotCount(Setting.DEFAULT_SETTINGS.totalParkingSlots);
    await settings.save();

    return res.json({
      success: true,
      message: "Settings reset successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
};
