const Company = require("../models/Company");
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

const ensureCompanyId = (companyId) => {
  if (!companyId) {
    const error = new Error("Company context is missing");
    error.statusCode = 400;
    throw error;
  }
};

const syncCompanyParkingSlotCount = async (companyId, targetTotal) => {
  ensureCompanyId(companyId);

  const slots = await ParkingSlot.find({ company: companyId }).sort({ positionIndex: 1 });
  const currentTotal = slots.length;

  if (targetTotal === currentTotal) {
    return;
  }

  if (targetTotal > currentTotal) {
    const newSlots = [];

    for (let index = currentTotal + 1; index <= targetTotal; index += 1) {
      newSlots.push({
        company: companyId,
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
  await ParkingSlot.deleteMany({ company: companyId, _id: { $in: removableIds } });
};

const ensureSettings = async (companyId, overrides = {}) => {
  ensureCompanyId(companyId);

  let settings = await Setting.findOne({ company: companyId });

  if (!settings) {
    settings = await Setting.create({
      ...Setting.DEFAULT_SETTINGS,
      ...overrides,
      company: companyId,
    });
    return settings;
  }

  let changed = false;

  Object.entries(Setting.DEFAULT_SETTINGS).forEach(([key, value]) => {
    if (settings[key] === undefined) {
      settings[key] = value;
      changed = true;
    }
  });

  Object.entries(overrides).forEach(([key, value]) => {
    if (value !== undefined && settings[key] !== value) {
      settings[key] = value;
      changed = true;
    }
  });

  if (changed) {
    await settings.save();
  }

  return settings;
};

const ensureCompanyResources = async (companyId, options = {}) => {
  const settings = await ensureSettings(companyId, {
    parkingLotName: options.parkingLotName || Setting.DEFAULT_SETTINGS.parkingLotName,
  });

  await syncCompanyParkingSlotCount(companyId, Number(settings.totalParkingSlots || Setting.DEFAULT_SETTINGS.totalParkingSlots));

  return settings;
};

const ensureUserCompany = async (user, options = {}) => {
  if (user.company) {
    await ensureCompanyResources(user.company, options);

    if (typeof user.populate === "function") {
      await user.populate("company", "name owner");
    }

    return user.company;
  }

  const company = await Company.create({
    name: options.companyName || `${user.fullName}'s Parking`,
    owner: user._id,
  });

  user.company = company._id;
  await user.save();
  await ensureCompanyResources(company._id, {
    parkingLotName: company.name,
  });

  if (typeof user.populate === "function") {
    await user.populate("company", "name owner");
  }

  return company;
};

const getDashboardOverviewData = async (companyId) => {
  ensureCompanyId(companyId);

  const { start, end } = getTodayRange();

  const [settings, slots, recentParkedVehicles, recentTransactions, todayTransactionsCount, paidPaymentsToday, carsCurrentlyParked] = await Promise.all([
    ensureSettings(companyId),
    ParkingSlot.find({ company: companyId })
      .sort({ positionIndex: 1 })
      .populate({
        path: "currentVehicle",
        select: "plateNumber ownerName ownerPhone vehicleType entryTime status",
      }),
    Vehicle.find({ company: companyId, status: "parked" })
      .sort({ entryTime: -1 })
      .limit(5)
      .populate("currentSlot", "slotNumber"),
    Transaction.find({ company: companyId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("parkingSlot", "slotNumber")
      .populate("createdBy", "fullName role"),
    Transaction.countDocuments({
      company: companyId,
      createdAt: { $gte: start, $lte: end },
    }),
    Payment.find({
      company: companyId,
      status: "paid",
      paidAt: { $gte: start, $lte: end },
    }),
    Vehicle.countDocuments({ company: companyId, status: "parked" }),
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
    settings,
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
  ensureCompanyResources,
  ensureSettings,
  ensureUserCompany,
  generateCode,
  getDashboardOverviewData,
  getDateRange,
  getPagination,
  getTodayRange,
  isStrongPassword,
  syncCompanyParkingSlotCount,
  toCsv,
};
