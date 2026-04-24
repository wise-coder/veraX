const Setting = require("../models/Setting");
const ParkingSlot = require("../models/ParkingSlot");
const Vehicle = require("../models/Vehicle");
const Transaction = require("../models/Transaction");
const Payment = require("../models/Payment");

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildRegex = (value = "") => new RegExp(escapeRegex(value.trim()), "i");

const buildSearchQuery = (search, fields = []) => {
  if (!search || !fields.length) {
    return {};
  }

  const regex = buildRegex(search);

  return {
    $or: fields.map((field) => ({
      [field]: regex,
    })),
  };
};

const getPagination = (query, defaultSortBy = "createdAt") => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.max(Number(query.limit) || 10, 1);
  const sortBy = query.sortBy || defaultSortBy;
  const order = query.order === "asc" ? 1 : -1;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sort: { [sortBy]: order },
  };
};

const generateCode = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const getDateRange = (startDate, endDate) => {
  const range = {};

  if (startDate || endDate) {
    range.$gte = startDate ? new Date(startDate) : new Date(0);
    range.$lte = endDate ? new Date(endDate) : new Date();
  }

  return Object.keys(range).length ? range : null;
};

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const formatCsvValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value).replace(/"/g, "\"\"");
  return `"${stringValue}"`;
};

const toCsv = (headers, rows) => {
  const headerLine = headers.map((header) => formatCsvValue(header.label)).join(",");
  const rowLines = rows.map((row) => headers.map((header) => formatCsvValue(row[header.key])).join(","));
  return [headerLine, ...rowLines].join("\n");
};

const buildPaginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 1,
});

const isStrongPassword = (value = "") => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(value);

const ensureSettings = async () => {
  let settings = await Setting.findOne();

  if (!settings) {
    settings = await Setting.create(Setting.DEFAULT_SETTINGS);
    return settings;
  }

  let changed = false;

  Object.entries(Setting.DEFAULT_SETTINGS).forEach(([key, value]) => {
    if (settings[key] === undefined) {
      settings[key] = value;
      changed = true;
    }
  });

  if (changed) {
    await settings.save();
  }

  return settings;
};

const getDashboardOverviewData = async () => {
  const { start, end } = getTodayRange();

  const [slots, recentParkedVehicles, recentTransactions, todayTransactionsCount, paidPaymentsToday, carsCurrentlyParked] = await Promise.all([
    ParkingSlot.find()
      .sort({ positionIndex: 1 })
      .populate({
        path: "currentVehicle",
        select: "plateNumber ownerName ownerPhone vehicleType entryTime status",
      }),
    Vehicle.find({ status: "parked" })
      .sort({ entryTime: -1 })
      .limit(5)
      .populate("currentSlot", "slotNumber"),
    Transaction.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("parkingSlot", "slotNumber")
      .populate("createdBy", "fullName role"),
    Transaction.countDocuments({
      createdAt: { $gte: start, $lte: end },
    }),
    Payment.find({
      status: "paid",
      paidAt: { $gte: start, $lte: end },
    }),
    Vehicle.countDocuments({ status: "parked" }),
  ]);

  const totalSlots = slots.length;
  const occupiedSlots = slots.filter((slot) => slot.status === "occupied").length;
  const availableSlots = slots.filter((slot) => slot.status === "available").length;
  const reservedSlots = slots.filter((slot) => slot.status === "reserved").length;
  const maintenanceSlots = slots.filter((slot) => slot.status === "maintenance").length;
  const todayRevenue = paidPaymentsToday.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const occupancyRate = totalSlots ? Number(((occupiedSlots / totalSlots) * 100).toFixed(2)) : 0;

  return {
    totalSlots,
    occupiedSlots,
    availableSlots,
    reservedSlots,
    maintenanceSlots,
    carsCurrentlyParked,
    todayRevenue,
    totalTransactionsToday: todayTransactionsCount,
    occupancyRate,
    recentParkedVehicles: recentParkedVehicles.map((vehicle) => ({
      id: vehicle._id,
      plateNumber: vehicle.plateNumber,
      ownerName: vehicle.ownerName,
      ownerPhone: vehicle.ownerPhone,
      vehicleType: vehicle.vehicleType,
      currentSlot: vehicle.currentSlot?.slotNumber || null,
      entryTime: vehicle.entryTime,
      status: vehicle.status,
    })),
    recentTransactions: recentTransactions.map((transaction) => ({
      id: transaction._id,
      transactionCode: transaction.transactionCode,
      plateNumber: transaction.plateNumber,
      type: transaction.type,
      slotNumber: transaction.parkingSlot?.slotNumber || null,
      amount: transaction.amount,
      status: transaction.status,
      createdAt: transaction.createdAt,
      createdBy: transaction.createdBy?.fullName || null,
    })),
    parkingMapData: slots.map((slot) => ({
      id: slot._id,
      slotNumber: slot.slotNumber,
      status: slot.status,
      currentVehicle: slot.currentVehicle?._id || null,
      plateNumber: slot.currentVehicle?.plateNumber || null,
      ownerName: slot.currentVehicle?.ownerName || null,
      ownerPhone: slot.currentVehicle?.ownerPhone || null,
      vehicleType: slot.currentVehicle?.vehicleType || null,
      entryTime: slot.currentVehicle?.entryTime || null,
    })),
  };
};

module.exports = {
  buildPaginationMeta,
  buildRegex,
  buildSearchQuery,
  ensureSettings,
  generateCode,
  getDashboardOverviewData,
  getDateRange,
  getPagination,
  getTodayRange,
  isStrongPassword,
  toCsv,
};
