const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["success", "info", "warning", "danger"],
    default: "info",
  },
  read: {
    type: Boolean,
    default: false,
  },
  page: {
    type: String,
    default: "",
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ company: 1, createdAt: -1 });
notificationSchema.index({ company: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
