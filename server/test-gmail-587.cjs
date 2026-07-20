require('dotenv').config({ path: __dirname + '/.env' });
const nodemailer = require('nodemailer');

async function test() {
  console.log("Testing Gmail SMTP on port 587...");
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'Test Email',
      text: 'This is a test email.'
    });
    console.log('Success:', info.messageId);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
