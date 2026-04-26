const { validationResult } = require("express-validator");

const Notification = require("../models/Notification");

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

const serializeNotification = (notification) => ({
  id: notification._id,
  message: notification.message,
  type: notification.type,
  read: Boolean(notification.read),
  page: notification.page || "",
  company: notification.company,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ company: req.companyId })
      .sort({ createdAt: -1 })
      .limit(30);

    return res.json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications.map(serializeNotification),
    });
  } catch (error) {
    next(error);
  }
};

const createNotification = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const notification = await Notification.create({
      company: req.companyId,
      message: req.body.message.trim(),
      type: req.body.type || "info",
      page: req.body.page || "",
      createdBy: req.user?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: serializeNotification(notification),
    });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        company: req.companyId,
      },
      {
        $set: {
          read: true,
        },
      },
      {
        new: true,
      },
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({
      success: true,
      message: "Notification marked as read",
      data: serializeNotification(notification),
    });
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      company: req.companyId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({
      success: true,
      message: "Notification deleted successfully",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createNotification,
  deleteNotification,
  getNotifications,
  markNotificationRead,
};
