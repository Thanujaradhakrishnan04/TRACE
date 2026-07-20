const sgMail = require('./server/node_modules/@sendgrid/mail');
const fs = require('fs');

// Parse .env from server folder
const envText = fs.readFileSync('./server/.env', 'utf8');
envText.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, '');
    process.env[key] = val;
  }
});

const apiKey = process.env.SENDGRID_API_KEY;
const senderEmail = process.env.SENDGRID_SENDER_EMAIL;

console.log('API Key present:', !!apiKey, '| Key prefix:', apiKey?.slice(0, 10));
console.log('Sender email:', senderEmail);

sgMail.setApiKey(apiKey);

const msg = {
  to: 'roshinielumalai12@gmail.com',
  from: senderEmail,
  subject: '🚨 StreetSentinel Email Test',
  text: 'This is a direct test email from StreetSentinel. If you receive this, email delivery is working!',
  html: '<h2 style="color:red;">🚨 StreetSentinel Test</h2><p>Email delivery is working correctly!</p><p>Timestamp: ' + new Date().toLocaleString() + '</p>',
};

console.log('\nSending email to:', msg.to);
console.log('From:', msg.from);

sgMail.send(msg)
  .then((response) => {
    console.log('\n✅ SUCCESS! Email sent via SendGrid!');
    console.log('Status Code:', response[0].statusCode);
    console.log('Message ID:', response[0].headers['x-message-id']);
    console.log('\n👉 Check your inbox AND spam/junk folder at:', msg.to);
  })
  .catch((error) => {
    console.error('\n❌ FAILED to send email!');
    console.error('Error code:', error.code);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Body:', JSON.stringify(error.response.body, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  });
