const nodemailer = require('nodemailer');
require('dotenv').config({ path: __dirname + '/server/.env' });

async function testMailer() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
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
      text: 'This is a test email to verify credentials.'
    });
    console.log('Success:', info.messageId);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testMailer();
