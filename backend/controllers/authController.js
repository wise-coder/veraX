const { validationResult } = require("express-validator");
const crypto = require("crypto");

const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const generateOtp = require("../utils/generateOtp");
const sendEmail = require("../utils/sendEmail");
const { ensureSettings, ensureUserCompany, isStrongPassword } = require("../utils/systemHelpers");

const OTP_EXPIRY_MS = 10 * 60 * 1000;

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

const sanitizeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  company: user.company
    ? {
      id: user.company._id || user.company,
      name: user.company.name || null,
    }
    : null,
  isEmailVerified: Boolean(user.isEmailVerified),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

const buildOtpEmail = (otp, fullName) => ({
  subject: "Verify your veraX account",
  text: `Hello ${fullName || "there"}, your veraX verification code is ${otp}. It expires in 10 minutes.`,
  html: `
    <div style="background:#ffffff;padding:30px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:500px;margin:0 auto;border:1px solid #e5e5e5;padding:25px;background:#ffffff;">
        <h2 style="text-align:center;color:#000000;margin:0 0 24px;padding-bottom:16px;border-bottom:1px solid #e5e5e5;font-size:24px;font-weight:700;">
          VeraX Parking
        </h2>
        <p style="color:#000000;font-size:16px;line-height:1.5;margin:0 0 12px;">
          Verify your email
        </p>
        <p style="color:#333333;font-size:14px;line-height:1.6;margin:0 0 30px;">
          Use the code below to verify your email address.
        </p>
        <div style="margin:30px 0;text-align:center;">
          <div style="display:inline-block;padding:15px 30px;border:1px solid #000000;font-size:28px;font-weight:bold;letter-spacing:5px;color:#000000;">
            ${otp}
          </div>
        </div>
        <p style="font-size:12px;line-height:1.6;color:#555555;margin:0 0 8px;">
          This code expires in 10 minutes.
        </p>
        <p style="font-size:12px;line-height:1.6;color:#555555;margin:0;">
          If you didn't request this, ignore this email.
        </p>
      </div>
    </div>
  `,
});

const setEmailOtp = (user, otp) => {
  user.emailOtp = hashOtp(otp);
  user.emailOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
  user.isEmailVerified = false;
};

const deliverOtpEmail = async (user, otp) => {
  const emailContent = buildOtpEmail(otp, user.fullName);

  await sendEmail({
    to: user.email,
    ...emailContent,
  });
};

const signup = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const { fullName, email, phone, password, companyName } = req.body;
    const normalizedEmail = email.toLowerCase();
    const normalizedCompanyName = String(companyName || `${fullName}'s Parking`).trim() || `${fullName}'s Parking`;

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long",
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const otp = generateOtp();
    const user = new User({
      fullName,
      email: normalizedEmail,
      phone,
      password,
      role: "admin",
    });
    setEmailOtp(user, otp);
    await user.save();
    await ensureUserCompany(user, { companyName: normalizedCompanyName });
    await ensureSettings(user.company?._id || user.company, {
      parkingLotName: normalizedCompanyName,
    });
    await user.populate("company", "name owner");

    try {
      await deliverOtpEmail(user, otp);
    } catch (emailError) {
      await User.deleteOne({ _id: user._id });
      throw emailError;
    }

    return res.status(201).json({
      success: true,
      message: "Signup successful. Please verify your email with the OTP sent.",
      data: {
        email: user.email,
        requiresOtp: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() })
      .select("+password")
      .populate("company", "name owner");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    if (!user.company) {
      await ensureUserCompany(user);
      await user.populate("company", "name owner");
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
        requiresOtp: true,
        email: user.email,
      });
    }

    return res.json({
      success: true,
      message: "Login successful",
      data: {
        token: generateToken(user),
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    return res.json({
      success: true,
      message: "Authenticated user fetched successfully",
      data: sanitizeUser(req.user),
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmailOtp = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const { email, otp } = req.body;
    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail })
      .select("+emailOtp +emailOtpExpires +password")
      .populate("company", "name owner");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.json({
        success: true,
        message: "Email already verified",
        data: {
          user: sanitizeUser(user),
          token: generateToken(user),
        },
      });
    }

    if (!user.emailOtp || !user.emailOtpExpires) {
      return res.status(400).json({
        success: false,
        message: "OTP is missing. Please request a new verification code.",
      });
    }

    if (user.emailOtpExpires.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new verification code.",
      });
    }

    if (user.emailOtp !== hashOtp(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP code",
      });
    }

    user.isEmailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpires = undefined;
    await user.save();
    if (!user.company) {
      await ensureUserCompany(user);
      await user.populate("company", "name owner");
    }

    return res.json({
      success: true,
      message: "Email verified successfully",
      data: {
        user: sanitizeUser(user),
        token: generateToken(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

const resendEmailOtp = async (req, res) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+emailOtp +emailOtpExpires");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    const otp = generateOtp();
    setEmailOtp(user, otp);
    await user.save();

    try {
      await deliverOtpEmail(user, otp);
    } catch (error) {
      console.error("Resend OTP error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Check email configuration.",
      });
    }

    return res.json({
      success: true,
      message: "A new verification code has been sent to your email.",
      data: {
        email: user.email,
        requiresOtp: true,
      },
    });
  } catch (error) {
    console.error("Resend OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while resending OTP.",
    });
  }
};

module.exports = {
  signup,
  login,
  getMe,
  verifyEmailOtp,
  resendEmailOtp,
};
