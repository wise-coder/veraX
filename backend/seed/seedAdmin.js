require("dotenv").config();

const connectDB = require("../config/db");
const User = require("../models/User");

const seedAdmin = async () => {
  try {
    await connectDB();

    const existingAdmin = await User.findOne({ email: "admin@parking.com" });

    if (existingAdmin) {
      console.log("Admin user already exists");
      process.exit(0);
    }

    await User.create({
      fullName: "System Administrator",
      email: "admin@parking.com",
      phone: "+10000000000",
      password: "Admin@12345",
      role: "admin",
      status: "active",
    });

    console.log("Default admin created: admin@parking.com / Admin@12345");
    process.exit(0);
  } catch (error) {
    console.error(`Failed to seed admin: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();
