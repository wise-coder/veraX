const rateLimit = require("express-rate-limit");

const defaultMessage = {
  success: false,
  message: "Too many requests, please try again later",
};

const buildLimiter = ({
  windowMs,
  max,
}) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: defaultMessage,
});

const loginRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
});

const verifyOtpRateLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
});

const resendOtpRateLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 3,
});

module.exports = {
  loginRateLimiter,
  verifyOtpRateLimiter,
  resendOtpRateLimiter,
};
