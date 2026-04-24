const nodemailer = require("nodemailer");

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !user.includes("@gmail.com")) {
    throw new Error("EMAIL_USER must be your full Gmail address.");
  }

  if (!pass) {
    throw new Error("EMAIL_PASS is required and must be a Gmail App Password.");
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
};

const sendEmail = async ({ to, subject, text, html }) => {
  // To use Gmail:
  // 1. Enable 2-Step Verification
  // 2. Generate an App Password
  // 3. Use that App Password in EMAIL_PASS
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email configuration missing. Please set EMAIL_USER and EMAIL_PASS");
  }

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  await getTransporter().sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
};

module.exports = sendEmail;
