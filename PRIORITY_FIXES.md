# StreetSentinel Priority Fixes & Enhancements

This document outlines the high-priority bugs, incomplete features, and critical refinements required in the StreetSentinel codebase.

---

## 1. SafeWalk & Check-in Timer (Phase 3)
* **Problem**: SafeWalk tracking operates, but the Check-in Timer is purely visual. There is no active timer thread or action when it runs out.
* **Fix**:
  * Add a `checkInTimer` value to the SafeWalk state in `useSafeWalkMonitor.js`.
  * If the timer runs out, trigger a frontend prompt/popup asking: *"Have you arrived safely?"*.
  * Start a 15-second countdown on the prompt. If the user does not press *"I'M SAFE"*, trigger the `triggerEmergency` method.

---

## 2. Advanced Audio Detection & Waveform (Phase 4)
* **Problem**: Audio classifications (e.g., Screaming, Shouting) are randomized on volume spikes. There is no live visual representation of sound input (waveform).
* **Fix**:
  * Implement a canvas-based or CSS-based **Real-Time Audio Waveform** component in `CitizenHome.jsx` when Protection Mode is active.
  * Integrate a dedicated decibel frequency threshold check so that sustained volume spikes within voice ranges trigger higher confidence levels.

---

## 3. Real System Notifications & Service Worker (Phase 6)
* **Problem**: Notifications are requested on startup, but cannot display when the application is minimized or when the browser tab is inactive.
* **Fix**:
  * Create a Service Worker (`sw.js`) to handle background notification clicks.
  * Implement push and system tray notification hooks that trigger outside the browser shell.

---

## 4. System Health Dashboard (Phase 12)
* **Problem**: No consolidated health screen showing active status of APIs and sensors.
* **Fix**:
  * Create a new route and screen `SystemHealth.jsx` (or embed it within the `Settings` page).
  * Read real states for:
    * **Microphone Status**: Permission and AudioContext state.
    * **GPS Status**: Accuracy and geolocator status.
    * **Internet Status**: Online/Offline socket state.
    * **Database Status**: Firebase connection status.
    * **Notification Status**: Notification permission level.
    * **Protection Status**: Armed/Disarmed state.

---

## 5. Nearby Safety Scanner (Phase 13)
* **Problem**: Nearby safety scanning is missing.
* **Fix**:
  * Implement a helper in `utils/geo.js` that calls the public Overpass API:
    `https://overpass-api.de/api/interpreter?data=[out:json];node(around:5000,lat,lng)[amenity=police];out;`
  * Add a tab/panel in SafeWalk or CitizenHome displaying a list of nearby hospitals, police stations, and women's centers with distance calculations.

---

## 6. Night Safety Mode (Phase 13)
* **Problem**: Night Safety Mode displays a banner after 8 PM but does not change app behavior.
* **Fix**:
  * Adjust the `useAudioDetection` baseline check after 8 PM to lower the threshold (making it more sensitive).
  * Automatically enable high-accuracy GPS polling and trigger location checks at shorter intervals.
