const nodemailer = require('nodemailer');

nodemailer.createTestAccount((err, account) => {
    if (err) {
        console.error('Failed to create a testing account. ' + err.message);
        return process.exit(1);
    }
    console.log('Ethereal Credentials:');
    console.log('User:', account.user);
    console.log('Pass:', account.pass);
    console.log('SMTP:', account.smtp.host, account.smtp.port);
});
