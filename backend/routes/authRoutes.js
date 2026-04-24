const express = require("express");
const { body } = require("express-validator");

const {
  getMe,
  login,
  signup,
  verifyEmailOtp,
  resendEmailOtp,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/signup",
  [
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("phone").trim().notEmpty().withMessage("Phone number is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
    body("companyName").optional().trim().notEmpty().withMessage("Company name cannot be empty"),
    body("role").optional().isIn(["admin", "manager", "attendant", "cashier"]).withMessage("Invalid role"),
  ],
  signup,
);

router.post(
  "/login",
  [
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  login,
);

router.post(
  "/verify-email-otp",
  [
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("otp")
      .trim()
      .matches(/^\d{6}$/)
      .withMessage("OTP must be a 6-digit code"),
  ],
  verifyEmailOtp,
);

router.post(
  "/resend-email-otp",
  [
    body("email").trim().isEmail().withMessage("Valid email is required"),
  ],
  resendEmailOtp,
);

router.get("/me", protect, getMe);

module.exports = router;
