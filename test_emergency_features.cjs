const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const BASE_URL = 'https://localhost:5173';

async function runEmergencyTests() {
  console.log("=== Starting Emergency SOS Functional E2E Tests ===");
  
  let options = new chrome.Options();
  options.addArguments('--ignore-certificate-errors');
  options.addArguments('--headless=new'); // Headless mode for automated check
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1280,800');
  
  // Fake microphone/camera to prevent browser prompt blocks
  options.addArguments('--use-fake-device-for-media-stream');
  options.addArguments('--use-fake-ui-for-media-stream');

  let driver;
  try {
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    console.log("1. Navigating to Login page...");
    await driver.get(`${BASE_URL}/login?role=citizen`);
    await driver.wait(until.elementLocated(By.css('input[type="email"]')), 5000);

    console.log("2. Logging in with test credentials...");
    const emailInput = await driver.findElement(By.css('input[type="email"]'));
    const passwordInput = await driver.findElement(By.css('input[type="password"]'));
    await emailInput.sendKeys('roshinielumalai12@gmail.com');
    await passwordInput.sendKeys('123456');
    await driver.findElement(By.css('button[type="submit"]')).click();

    // Wait for redirect to home
    await driver.wait(until.urlContains('/citizen/home'), 10000);
    console.log("✅ Successfully logged in and navigated to Citizen Dashboard.");
    await driver.sleep(2000); // Allow dashboard to render fully

    // Inject Geolocation Mock
    await driver.executeScript(`
      const mockGeolocation = {
        getCurrentPosition: function(success, error, options) {
          success({
            coords: {
              latitude: 12.9716,
              longitude: 77.5946,
              accuracy: 10
            },
            timestamp: Date.now()
          });
        },
        watchPosition: function(success, error, options) {
          success({
            coords: {
              latitude: 12.9716,
              longitude: 77.5946,
              accuracy: 10
            },
            timestamp: Date.now()
          });
          return 1;
        },
        clearWatch: function() {}
      };
      Object.defineProperty(navigator, 'geolocation', {
        value: mockGeolocation,
        configurable: true,
        writable: true
      });
    `);
    console.log("✅ Geolocation mock injected successfully via Object.defineProperty.");

    // ==========================================
    // TEST 1: Trigger Emergency & Cancel ("I'm Safe")
    // ==========================================
    console.log("\n--- TEST 1: Triggering distress overlay and clicking 'I'm Safe' ---");
    
    // Trigger emergency via window.useStore
    await driver.executeScript("window.useStore.getState().triggerEmergency('Simulated Audio Distress');");
    await driver.sleep(1000); // Wait for modal animation
    
    // Check if countdown overlay is visible
    let overlayText = await driver.findElement(By.xpath("//*[contains(text(), 'Emergency Detected')]"));
    if (overlayText) {
      console.log("✅ Pre-emergency countdown overlay is visible.");
    }

    // Assert countdown value is present
    let countdownVal = await driver.executeScript("return window.useStore.getState().countdown;");
    console.log(`Current countdown value: ${countdownVal}s`);
    if (countdownVal > 0 && countdownVal <= 10) {
      console.log("✅ Countdown timer is active and initialized correctly.");
    }

    // Click "I'm Safe"
    const imSafeBtn = await driver.findElement(By.xpath("//button[contains(., \"I'm Safe\") or contains(., \"I'M SAFE\")]"));
    await imSafeBtn.click();
    console.log("Clicked 'I'm Safe' disarm button.");
    await driver.sleep(1000);

    // Verify overlay is closed and timer is reset to null
    let countdownAfterCancel = await driver.executeScript("return window.useStore.getState().countdown;");
    let isEmergencyModeAfterCancel = await driver.executeScript("return window.useStore.getState().isEmergencyMode;");
    
    if (countdownAfterCancel === null && !isEmergencyModeAfterCancel) {
      console.log("✅ Success: Countdown stopped, emergency cancelled, and state returned to normal.");
    } else {
      throw new Error("Cancel/Disarm failed: Timer or Emergency Mode state is still active.");
    }

    // ==========================================
    // TEST 2: Trigger Emergency & Send Immediately ("Send Location Now")
    // ==========================================
    console.log("\n--- TEST 2: Triggering overlay and clicking 'Send Location Now' ---");
    
    await driver.executeScript("window.useStore.getState().triggerEmergency('Simulated Audio Distress 2');");
    await driver.sleep(1000);
    
    // Click "Send Location Now"
    const sendNowBtn = await driver.findElement(By.xpath("//button[contains(., 'Send Location Now') or contains(., 'SEND NOW')]"));
    await sendNowBtn.click();
    console.log("Clicked 'Send Location Now' override button.");
    await driver.sleep(5000); // Wait for geolocation timeout and api dispatch call

    // Check if full Emergency Mode page is active
    let emergencyHeader = await driver.findElements(By.xpath("//*[contains(text(), 'EMERGENCY MODE ACTIVATED')]"));
    let isEmergencyModeActive = await driver.executeScript("return window.useStore.getState().isEmergencyMode;");

    if (emergencyHeader.length > 0 && isEmergencyModeActive) {
      console.log("✅ Success: Bypassed countdown, triggered immediate dispatch, and activated Emergency Mode.");
    } else {
      throw new Error("Immediate dispatch override failed to activate emergency mode.");
    }

    // Disarm the active emergency mode using 'X' close button
    const closeBtn = await driver.findElement(By.xpath("//button[contains(@class, 'absolute top-8 right-8')]"));
    await closeBtn.click();
    console.log("Clicked 'X' close button to disarm active emergency.");
    await driver.sleep(1500);

    isEmergencyModeActive = await driver.executeScript("return window.useStore.getState().isEmergencyMode;");
    if (!isEmergencyModeActive) {
      console.log("✅ Success: Active emergency successfully disarmed and returned to dashboard.");
    } else {
      throw new Error("X disarm button failed to close emergency mode.");
    }

    // ==========================================
    // TEST 3: Trigger Emergency & Let Timer Run Out
    // ==========================================
    console.log("\n--- TEST 3: Triggering overlay and letting the countdown expire ---");
    
    await driver.executeScript("window.useStore.getState().triggerEmergency('Simulated Audio Distress 3');");
    console.log("Countdown started. Waiting 18 seconds for auto-dispatch...");
    await driver.sleep(18000); // Wait for countdown to run out (15s + padding)

    isEmergencyModeActive = await driver.executeScript("return window.useStore.getState().isEmergencyMode;");
    emergencyHeader = await driver.findElements(By.xpath("//*[contains(text(), 'EMERGENCY MODE ACTIVATED')]"));

    if (isEmergencyModeActive && emergencyHeader.length > 0) {
      console.log("✅ Success: 10s countdown expired. Auto-dispatched alerts and entered Emergency Mode.");
    } else {
      throw new Error("Auto-dispatch on countdown expiration failed.");
    }

    // Disarm using X
    const closeBtn2 = await driver.findElement(By.xpath("//button[contains(@class, 'absolute top-8 right-8')]"));
    await closeBtn2.click();
    await driver.sleep(1000);
    console.log("✅ Active emergency disarmed again.");

    console.log("\n🎉 ALL EMERGENCY SOS AND DISARM TESTS PASSED SUCCESSFULLY! 🎉");

  } catch (err) {
    console.error("\n❌ Test Failed with error:", err.message);
    if (driver) {
      try {
        const storeState = await driver.executeScript(`
          return {
            isEmergencyMode: window.useStore.getState().isEmergencyMode,
            countdown: window.useStore.getState().countdown,
            threatLevel: window.useStore.getState().threatLevel,
            countdownTimerExists: window.useStore.getState().countdownTimer !== null
          };
        `);
        console.log("\n=== ZUSTAND STORE STATE ON FAILURE ===");
        console.log(JSON.stringify(storeState, null, 2));

        const logs = await driver.manage().logs().get('browser');
        console.log("\n=== BROWSER CONSOLE LOGS ===");
        logs.forEach(log => console.log(`[${log.level.name}] ${log.message}`));
      } catch (logErr) {
        console.warn("Could not retrieve store state or browser logs:", logErr.message);
      }
    }
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

runEmergencyTests();
