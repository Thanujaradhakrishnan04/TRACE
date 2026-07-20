# StreetSentinel Performance Review

This document provides an analysis of the performance, resource allocation, and battery utilization characteristics of the StreetSentinel application, highlighting key optimizations needed for native mobile deployment.

---

## 1. Resource Consumption Profiling

### A. Geolocation & GPS Tracking
* **Current Implementation**: Uses `navigator.geolocation.watchPosition` with `enableHighAccuracy: true` and `maximumAge: 0`.
* **Resource Profile**:
  * **CPU Usage**: Moderate (continuous polling and background coordinate updates).
  * **Battery Drain**: **High**. Continuous hardware GPS queries prevent the device CPU from entering low-power sleep states.
  * **WebView Limitation**: Most mobile browsers throttle background JavaScript execution, meaning geolocation updates may stall when the browser is minimized.
* **Optimization**:
  * Implement an adaptive distance filter: only query GPS if the device accelerometer detects movement.
  * During Android migration, offload background tracking to the native Android `FusedLocationProviderClient` with a request interval adjusted based on speed (e.g., walk vs. stationary).

### B. Audio Monitoring & Analysis
* **Current Implementation**: Runs continuous Web Audio API analysers at a fast interval (150ms) to read real-time decibels. Simultaneously runs Web Speech API `SpeechRecognition`.
* **Resource Profile**:
  * **Memory Overhead**: Low-moderate (analyser buffers are small).
  * **Battery Drain**: **High**. Active microphone listeners keep the audio hardware turned on continuously.
  * **Speech Recognition Overhead**: In Chrome and Android WebViews, `SpeechRecognition` requires an active internet connection as it streams voice data to Google's recognition servers, consuming significant mobile data and power.
* **Optimization**:
  * Pause audio analysis when the app is disarmed.
  * In the Android native service, use a native, low-power audio recorder or offline wake-word engines (like Porcupine or pocket-sphinx) to detect SOS phrases locally without remote server streams.

### C. Database & Network Sync (Firebase + WebSockets)
* **Current Implementation**: Establishes 4 active Firebase `onSnapshot` real-time listeners (for profile, contacts, alerts, default settings) plus an active Socket.io connection to the Node.js backend.
* **Resource Profile**:
  * **Network Overhead**: Low (Firestore uses incremental updates).
  * **Memory Leaks**: **High Risk**. If listeners are not unsubscribed on logout, they persist and continue to consume memory.
* **Optimization**:
  * Validate that all `unsubContacts`, `unsubAlerts`, and `unsubSettings` functions are executed when authentication states change to null.
  * Batch location updates to Firestore and Socket.io (e.g., send location updates only if the user moves more than 10 meters).

---

## 2. Recommended Optimizations for Native Android Environment

1. **WebView Throttling Bypass**:
   * Background JavaScript execution is heavily restricted by Android. Background tasks *must* be handled by native Kotlin services rather than relying on the web bundle.

2. **Native Wake-Locks**:
   * The Android Foreground Service will request a native CPU Wake-Lock (`PowerManager.PARTIAL_WAKE_LOCK`) only when SafeWalk is active to prevent the OS from killing location tracking.

3. **Persistent Audio Buffer Caching**:
   * Instead of continuous analysis, the native service will monitor volume spikes. Upon a spike, it will record a circular buffer of 5 seconds of audio, analyze it, and write to the vault only when a threat is identified.
