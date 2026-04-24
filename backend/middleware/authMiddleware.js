const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ensureUserCompany } = require("../utils/systemHelpers");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId || decoded.id)
      .select("-password")
      .populate("company", "name owner");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, user not found",
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

    req.user = user;
    req.companyId = user.company?._id || user.company;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, token invalid",
    });
  }
};

module.exports = { protect };
