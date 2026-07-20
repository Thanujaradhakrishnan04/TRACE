const { sendEmergencyEmail } = require('./services/emailService');

(async () => {
    console.log("Testing emailService.js local mock mailer...");
    const result = await sendEmergencyEmail('Abrahm@gmail.com', {lat: 12.9716, lng: 77.5946}, 'Test User', '+1234567890');
    console.log("Result:", result);
})();
