require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 2525,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});

console.log("Testing SendGrid SMTP on port 2525...");
transporter.verify((error, success) => {
  if (error) {
    console.error("SendGrid failed:", error);
  } else {
    console.log("SendGrid success:", success);
  }
  process.exit();
});
