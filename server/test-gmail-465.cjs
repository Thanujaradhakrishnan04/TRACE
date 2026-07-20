require('dotenv').config();
const nodemailer = require('nodemailer');

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

console.log(`Testing Gmail SMTP on port 465 for ${process.env.EMAIL_USER}...`);
transporter.verify((error, success) => {
  if (error) {
    console.error("Gmail failed:", error.message);
  } else {
    console.log("Gmail success:", success);
    
    // Test sending an email if successful
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'Abrahm@gmail.com',
        subject: 'Test Email via Port 465',
        text: 'This is a real test email sent from Node.js'
    };
    
    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error("Failed to send real email:", err);
        } else {
            console.log("Email sent! Message ID:", info.messageId);
        }
        process.exit();
    });
  }
});
