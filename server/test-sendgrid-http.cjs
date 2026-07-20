require('dotenv').config();
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'Abrahm@gmail.com', // Sending to the requested guardian
  from: 'streetsentinel.app@gmail.com', // Using the correct verified sender
  subject: 'Test SendGrid API with Correct Sender',
  text: 'This is a test over HTTP using the root .env sender'
};

console.log("Testing SendGrid HTTP API with alternative sender...");
sgMail.send(msg)
  .then(() => {
    console.log("SendGrid HTTP API success! Email sent.");
    process.exit();
  })
  .catch((error) => {
    console.error("SendGrid HTTP API failed:", error.response ? error.response.body : error);
    process.exit(1);
  });
