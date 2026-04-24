const calculateParkingFee = ({ entryTime, exitTime = new Date(), settings }) => {
  const entry = new Date(entryTime);
  const exit = new Date(exitTime);

  if (Number.isNaN(entry.getTime()) || Number.isNaN(exit.getTime()) || exit <= entry) {
    return {
      durationInMinutes: 0,
      amount: 0,
      amountToPay: 0,
      pricePerMinute: Number(settings?.pricePerMinute) || 15,
    };
  }

  const durationInMinutes = Math.max(1, Math.ceil((exit.getTime() - entry.getTime()) / (1000 * 60)));
  const pricePerMinute = Number(settings?.pricePerMinute) > 0 ? Number(settings.pricePerMinute) : 15;
  const amountToPay = Number((durationInMinutes * pricePerMinute).toFixed(2));

  return {
    durationInMinutes,
    amount: amountToPay,
    amountToPay,
    pricePerMinute,
  };
};

module.exports = calculateParkingFee;
