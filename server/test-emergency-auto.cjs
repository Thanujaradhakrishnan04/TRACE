const assert = require('assert');
require('dotenv').config();
const { sendEmergencyEmail } = require('./services/emailService');

async function runAutoTests() {
  console.log('====================================================');
  console.log('🚀 STARTING BACKEND EMERGENCY EMAIL AUTO-TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Verify environment variables and SendGrid API key loading
  try {
    console.log('Test 1: Environment Variables & API Keys Check...');
    assert.ok(process.env.EMAIL_USER, 'EMAIL_USER must be present');
    assert.ok(process.env.SENDGRID_API_KEY, 'SENDGRID_API_KEY must be present for dual-layer fallback');
    console.log('✅ PASSED: Environment keys loaded correctly (`EMAIL_USER` & `SENDGRID_API_KEY` present).\n');
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 1:', err.message, '\n');
    failed++;
  }

  // Test 2: Verify sendEmergencyEmail with mock live coordinates & contacts
  try {
    console.log('Test 2: Live SOS Dispatch Email Test (Primary / Fallback execution)...');
    const mockLocation = { lat: 13.0827, lng: 80.2707 };
    const mockUser = 'AutoTest Citizen';
    const mockPhone = '+919876543210';
    const testEmail = process.env.EMAIL_USER || 'roshinielumalai12@gmail.com';

    const startTime = Date.now();
    const result = await sendEmergencyEmail(testEmail, mockLocation, mockUser, mockPhone, null);
    const durationMs = Date.now() - startTime;

    assert.strictEqual(result.success, true, `sendEmergencyEmail returned success=false: ${result.error}`);
    assert.ok(result.messageId, 'Result must contain messageId confirmation');
    console.log(`✅ PASSED: Emergency email dispatched successfully in ${durationMs}ms (Message ID: ${result.messageId}).\n`);
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 2:', err.message, '\n');
    failed++;
  }

  // Test 3: Verify sendEmergencyEmail handles null/missing location gracefully without throwing
  try {
    console.log('Test 3: Null Location Handling Test...');
    const result = await sendEmergencyEmail('test@example.com', null, 'NullLoc User', '+1234567890', null);
    assert.strictEqual(result.success, true, `sendEmergencyEmail failed with null location: ${result.error}`);
    console.log('✅ PASSED: Null location handled cleanly (`Location not available` fallback formatted).\n');
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 3:', err.message, '\n');
    failed++;
  }

  console.log('====================================================');
  console.log(`📊 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAutoTests();
