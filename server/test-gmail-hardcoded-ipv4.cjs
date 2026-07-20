require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: '74.125.130.109', // hardcoded IPv4 for smtp.gmail.com
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 5000
});

console.log(`Testing Gmail SMTP (Hardcoded IPv4) on port 465 for ${process.env.EMAIL_USER}...`);
transporter.verify((error, success) => {
  if (error) {
    console.error("Gmail IPv4 failed:", error.message);
  } else {
    console.log("Gmail IPv4 success:", success);
    process.exit();
  }
});
