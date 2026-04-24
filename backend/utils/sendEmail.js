const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

module.exports = async function sendEmail(toOrOptions, subject, html) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Missing EMAIL_USER or EMAIL_PASS");
    }

    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    const payload = typeof toOrOptions === "object" && toOrOptions !== null
      ? toOrOptions
      : { to: toOrOptions, subject, html };

    await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
  } catch (error) {
    console.error("Email send error:", error);
    throw new Error("Failed to send email");
  }
};
