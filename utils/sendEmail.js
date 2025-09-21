const nodemailer = require("nodemailer");

const sendEmail = async (data, req, res) => {
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.USER_EMAIL,
      pass: process.env.USER_PASS,
    },
  });

  await transporter.sendMail({
    from: "Food ordering app",
    to: data.to,
    subject: data.subject,
    text: data.text,
    html: data.html,
  });
};

module.exports = sendEmail;
