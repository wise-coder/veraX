const mongoose = require("mongoose");

const DEFAULT_SETTINGS = {
  parkingLotName: "Smart Parking Hub",
  address: "Parking Avenue, Downtown",
  timezone: "Africa/Cairo",
  dateFormat: "YYYY-MM-DD HH:mm",
  currency: "USD",
  pricePerHour: 20,
  totalParkingSlots: 20,
  defaultParkingDuration: 2,
  overstayGracePeriod: 15,
  allowOvernightParking: true,
  enableSlotSelection: true,
  autoAssignSlot: true,
  emailNotifications: true,
  smsNotifications: true,
  paymentNotifications: true,
  overstayAlerts: true,
  dailySummaryReports: false,
  passwordPolicy: "strong",
  sessionTimeout: 30,
  twoFactorAuthentication: false,
  loginAttemptLimit: 5,
  requireStrongPassword: true,
  theme: "light",
  primaryColor: "#2F8F12",
  sidebarPosition: "left",
  compactSidebar: false,
};

const settingSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    unique: true,
    index: true,
  },
  parkingLotName: { type: String, default: DEFAULT_SETTINGS.parkingLotName },
  address: { type: String, default: DEFAULT_SETTINGS.address },
  timezone: { type: String, default: DEFAULT_SETTINGS.timezone },
  dateFormat: { type: String, default: DEFAULT_SETTINGS.dateFormat },
  currency: { type: String, default: DEFAULT_SETTINGS.currency },
  pricePerHour: { type: Number, default: DEFAULT_SETTINGS.pricePerHour },
  totalParkingSlots: { type: Number, default: DEFAULT_SETTINGS.totalParkingSlots },
  defaultParkingDuration: { type: Number, default: DEFAULT_SETTINGS.defaultParkingDuration },
  overstayGracePeriod: { type: Number, default: DEFAULT_SETTINGS.overstayGracePeriod },
  allowOvernightParking: { type: Boolean, default: DEFAULT_SETTINGS.allowOvernightParking },
  enableSlotSelection: { type: Boolean, default: DEFAULT_SETTINGS.enableSlotSelection },
  autoAssignSlot: { type: Boolean, default: DEFAULT_SETTINGS.autoAssignSlot },
  emailNotifications: { type: Boolean, default: DEFAULT_SETTINGS.emailNotifications },
  smsNotifications: { type: Boolean, default: DEFAULT_SETTINGS.smsNotifications },
  paymentNotifications: { type: Boolean, default: DEFAULT_SETTINGS.paymentNotifications },
  overstayAlerts: { type: Boolean, default: DEFAULT_SETTINGS.overstayAlerts },
  dailySummaryReports: { type: Boolean, default: DEFAULT_SETTINGS.dailySummaryReports },
  passwordPolicy: { type: String, default: DEFAULT_SETTINGS.passwordPolicy },
  sessionTimeout: { type: Number, default: DEFAULT_SETTINGS.sessionTimeout },
  twoFactorAuthentication: { type: Boolean, default: DEFAULT_SETTINGS.twoFactorAuthentication },
  loginAttemptLimit: { type: Number, default: DEFAULT_SETTINGS.loginAttemptLimit },
  requireStrongPassword: { type: Boolean, default: DEFAULT_SETTINGS.requireStrongPassword },
  theme: { type: String, default: DEFAULT_SETTINGS.theme },
  primaryColor: { type: String, default: DEFAULT_SETTINGS.primaryColor },
  sidebarPosition: { type: String, default: DEFAULT_SETTINGS.sidebarPosition },
  compactSidebar: { type: Boolean, default: DEFAULT_SETTINGS.compactSidebar },
}, {
  timestamps: true,
});

settingSchema.index({ company: 1, updatedAt: -1 });

const Setting = mongoose.model("Setting", settingSchema);

Setting.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

module.exports = Setting;
