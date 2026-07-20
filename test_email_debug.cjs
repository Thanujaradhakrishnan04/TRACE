/**
 * Gmail App Password SMTP Test
 * 
 * This tests sending email DIRECTLY via Gmail SMTP (no SendGrid).
 * For this to work, the user needs a Gmail App Password.
 * 
 * Steps to get App Password:
 * 1. Go to https://myaccount.google.com/security
 * 2. Enable 2-Step Verification if not already enabled
 * 3. Go to https://myaccount.google.com/apppasswords
 * 4. Select "Mail" app, "Windows Computer" device
 * 5. Copy the 16-character password and paste it in server/.env as EMAIL_PASS
 */

const nodemailer = require('./server/node_modules/nodemailer');
const fs = require('fs');

// Parse server .env
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

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const sendgridKey = process.env.SENDGRID_API_KEY;

console.log('=== Email Config Debug ===');
console.log('EMAIL_USER:', emailUser);
console.log('EMAIL_PASS:', emailPass === 'REPLACE_WITH_GMAIL_APP_PASSWORD' ? '❌ NOT SET (placeholder)' : '✅ Set (' + emailPass?.length + ' chars)');
console.log('SENDGRID_API_KEY:', sendgridKey ? '✅ Set' : '❌ Not set');
console.log('');

if (emailPass === 'REPLACE_WITH_GMAIL_APP_PASSWORD' || !emailPass) {
  console.log('❌ EMAIL_PASS is not configured!');
  console.log('');
  console.log('To send email via Gmail SMTP directly:');
  console.log('1. Go to: https://myaccount.google.com/apppasswords');
  console.log('2. Generate an App Password for "Mail"');
  console.log('3. Update server/.env: EMAIL_PASS=your16charpassword');
  console.log('4. Re-run this script');
  console.log('');
  console.log('Trying SendGrid instead...');
}

// Try Gmail direct
async function tryGmail() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass }
  });

  try {
    await transporter.verify();
    console.log('✅ Gmail SMTP connection verified!');
    const info = await transporter.sendMail({
      from: emailUser,
      to: emailUser,
      subject: '🚨 StreetSentinel Gmail Direct Test',
      html: '<h2>StreetSentinel Email Test</h2><p>Direct Gmail SMTP is working!</p><p>' + new Date().toLocaleString() + '</p>'
    });
    console.log('✅ Email sent via Gmail! Message ID:', info.messageId);
  } catch (err) {
    console.log('❌ Gmail SMTP failed:', err.message);
    if (err.message.includes('BadCredentials') || err.message.includes('Username and Password')) {
      console.log('');
      console.log('=> The EMAIL_PASS must be a Gmail App Password (not your regular password).');
      console.log('=> Regular Gmail passwords are blocked. You need an App Password.');
      console.log('   Generate one at: https://myaccount.google.com/apppasswords');
    }
  }
}

// Try SendGrid
async function trySendGrid() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    auth: { user: 'apikey', pass: sendgridKey }
  });

  try {
    const info = await transporter.sendMail({
      from: emailUser,
      to: emailUser,
      subject: '🚨 StreetSentinel SendGrid SMTP Test - ' + new Date().toLocaleTimeString(),
      html: '<h2 style="color:red;">🚨 StreetSentinel Emergency Alert Test</h2><p>This is a test email sent via SendGrid SMTP.</p><p>Timestamp: ' + new Date().toLocaleString() + '</p>'
    });
    console.log('✅ SendGrid SMTP: Email sent! Message ID:', info.messageId);
    console.log('=> Check inbox AND spam/junk folder at:', emailUser);
  } catch (err) {
    console.log('❌ SendGrid SMTP failed:', err.message);
  }
}

(async () => {
  if (emailPass && emailPass !== 'REPLACE_WITH_GMAIL_APP_PASSWORD') {
    console.log('Testing Gmail direct SMTP...');
    await tryGmail();
  }
  
  if (sendgridKey) {
    console.log('Testing SendGrid SMTP...');
    await trySendGrid();
  }
})();
