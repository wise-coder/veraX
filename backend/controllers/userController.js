const { validationResult } = require("express-validator");
const User = require("../models/User");
const {
  buildPaginationMeta,
  buildSearchQuery,
  ensureSettings,
  getPagination,
  isStrongPassword,
} = require("../utils/systemHelpers");

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
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const getUsers = async (req, res, next) => {
  try {
    const { search, status, role } = req.query;
    const { page, limit, skip, sort } = getPagination(req.query);
    const searchFilter = buildSearchQuery(search, ["fullName", "email", "phone", "role"]);
    const filter = { ...searchFilter, company: req.companyId };

    if (status) {
      filter.status = status;
    }

    if (role) {
      filter.role = role;
    }

    const [users, total] = await Promise.all([
      User.find(filter).populate("company", "name").sort(sort).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      message: "Users fetched successfully",
      data: {
        users: users.map(sanitizeUser),
        pagination: buildPaginationMeta(page, limit, total),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const { fullName, email, phone, password, role, status } = req.body;
    const settings = await ensureSettings(req.companyId);
    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    if (settings.requireStrongPassword && !isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long",
      });
    }

    const user = await User.create({
      fullName,
      email: normalizedEmail,
      phone,
      password,
      company: req.companyId,
      role: role || "attendant",
      status: status || "active",
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, company: req.companyId }).populate("company", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "User fetched successfully",
      data: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const validationResponse = validationErrorResponse(req, res);

    if (validationResponse) {
      return validationResponse;
    }

    const settings = await ensureSettings(req.companyId);
    const user = await User.findOne({ _id: req.params.id, company: req.companyId })
      .select("+password")
      .populate("company", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (req.body.email && req.body.email.toLowerCase() !== user.email) {
      const emailInUse = await User.findOne({ email: req.body.email.toLowerCase() });

      if (emailInUse) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }

      user.email = req.body.email.toLowerCase();
    }

    if (req.body.role && user.role === "admin" && req.body.role !== "admin") {
      const adminCount = await User.countDocuments({ company: req.companyId, role: "admin" });

      if (adminCount === 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot change role of the only admin user",
        });
      }
    }

    if (req.body.status === "inactive" && user.role === "admin") {
      const activeAdminCount = await User.countDocuments({ company: req.companyId, role: "admin", status: "active" });

      if (activeAdminCount === 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot deactivate the only active admin user",
        });
      }
    }

    user.fullName = req.body.fullName || user.fullName;
    user.phone = req.body.phone || user.phone;
    user.role = req.body.role || user.role;
    user.status = req.body.status || user.status;

    if (req.body.password) {
      if (settings.requireStrongPassword && !isStrongPassword(req.body.password)) {
        return res.status(400).json({
          success: false,
          message: "Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long",
        });
      }

      user.password = req.body.password;
    }

    await user.save();

    return res.json({
      success: true,
      message: "User updated successfully",
      data: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, company: req.companyId }).populate("company", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ company: req.companyId, role: "admin" });

      if (adminCount === 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete the only admin user",
        });
      }
    }

    await user.deleteOne();

    return res.json({
      success: true,
      message: "User deleted successfully",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
};
