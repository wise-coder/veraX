const { validationResult } = require("express-validator");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { ensureSettings, isStrongPassword } = require("../utils/systemHelpers");

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
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const signup = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const { fullName, email, phone, password, role } = req.body;
    const settings = await ensureSettings();
    const normalizedEmail = email.toLowerCase();

    if (settings.requireStrongPassword && !isStrongPassword(password)) {
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

    const existingUsersCount = await User.countDocuments();
    const user = await User.create({
      fullName,
      email: normalizedEmail,
      phone,
      password,
      role: existingUsersCount === 0 ? (role || "admin") : "attendant",
    });

    const safeUser = sanitizeUser(user);

    return res.status(201).json({
      success: true,
      message: "Signup successful",
      data: {
        token: generateToken(user),
        user: safeUser,
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
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

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

module.exports = {
  signup,
  login,
  getMe,
};
