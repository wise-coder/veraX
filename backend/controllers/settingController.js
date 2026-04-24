const { validationResult } = require("express-validator");
const Setting = require("../models/Setting");
const { ensureSettings, syncCompanyParkingSlotCount } = require("../utils/systemHelpers");

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

const getSettings = async (req, res, next) => {
  try {
    const settings = await ensureSettings(req.companyId);

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

    const settings = await ensureSettings(req.companyId);
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
      await syncCompanyParkingSlotCount(req.companyId, Number(updates.totalParkingSlots));
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

const resetSettings = async (req, res, next) => {
  try {
    let settings = await Setting.findOne({ company: req.companyId });

    if (!settings) {
      settings = await Setting.create({
        ...Setting.DEFAULT_SETTINGS,
        company: req.companyId,
      });
    }

    Object.entries(Setting.DEFAULT_SETTINGS).forEach(([key, value]) => {
      settings[key] = value;
    });

    await syncCompanyParkingSlotCount(req.companyId, Setting.DEFAULT_SETTINGS.totalParkingSlots);
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
