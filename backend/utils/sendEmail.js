async function sendEmail(to, subject, html) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME || "VeraX";
  const payload = typeof to === "object" && to !== null
    ? to
    : { to, subject, html };

  if (!apiKey || !fromEmail) {
    throw new Error("Missing Brevo email configuration");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: fromName,
        email: fromEmail,
      },
      to: [{ email: payload.to }],
      subject: payload.subject,
      htmlContent: payload.html,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Brevo API email error:", data);
    throw new Error("Failed to send email");
  }

  return data;
}

module.exports = sendEmail;
