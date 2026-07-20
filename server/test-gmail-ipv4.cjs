require('dotenv').config();
const nodemailer = require('nodemailer');
const dns = require('dns');

// Force IPv4 lookup
dns.setDefaultResultOrder('ipv4first');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 5000
});

console.log(`Testing Gmail SMTP (forced IPv4) on port 465 for ${process.env.EMAIL_USER}...`);
transporter.verify((error, success) => {
  if (error) {
    console.error("Gmail IPv4 failed:", error.message);
  } else {
    console.log("Gmail IPv4 success:", success);
    process.exit();
  }
});
