const VEHICLE_RATE_MAP = {
  sedan: 5,
  saloon: 5,
  hatchback: 5,
  suv: 7,
  truck: 10,
  bus: 12,
  van: 8,
  motorcycle: 3,
  default: 6,
};

const getBaseRate = (vehicleType = "") => {
  const normalized = String(vehicleType).trim().toLowerCase();
  return VEHICLE_RATE_MAP[normalized] || VEHICLE_RATE_MAP.default;
};

const calculateParkingFee = ({ entryTime, exitTime = new Date(), vehicleType, settings }) => {
  const entry = new Date(entryTime);
  const exit = new Date(exitTime);

  if (Number.isNaN(entry.getTime()) || Number.isNaN(exit.getTime()) || exit <= entry) {
    return {
      durationHours: 0,
      billableHours: 0,
      amount: 0,
      baseRate: getBaseRate(vehicleType),
    };
  }

  const durationHours = (exit.getTime() - entry.getTime()) / (1000 * 60 * 60);
  const graceHours = Number(settings?.overstayGracePeriod || 0) / 60;
  const defaultDuration = Math.max(Number(settings?.defaultParkingDuration || 1), 1);
  const configuredRate = Number(settings?.pricePerHour);
  const baseRate = configuredRate > 0 ? configuredRate : getBaseRate(vehicleType);

  let billableHours = Math.max(Math.ceil(durationHours), 1);

  if (durationHours <= graceHours) {
    billableHours = 1;
  }

  const standardHours = Math.min(billableHours, defaultDuration);
  const overtimeHours = Math.max(billableHours - defaultDuration, 0);
  const amount = Number(((standardHours * baseRate) + (overtimeHours * baseRate * 1.5)).toFixed(2));

  return {
    durationHours: Number(durationHours.toFixed(2)),
    durationMinutes: Math.max(Math.round(durationHours * 60), 0),
    billableHours,
    amount,
    baseRate,
  };
};

module.exports = calculateParkingFee;
