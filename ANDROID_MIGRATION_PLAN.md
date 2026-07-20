# StreetSentinel Android Migration Plan

This document details the step-by-step procedure to transition the StreetSentinel React/Vite web application into a native Android app using Capacitor.

---

## Step 1: Install Capacitor Packages
First, add the Capacitor core libraries, CLI, and the Android platform package to the root project:
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
```

## Step 2: Initialize Capacitor Config
Initialize Capacitor with the application metadata:
```bash
npx cap init StreetSentinel com.streetsentinel.app --web-dir=dist
```
*Note: This creates a `capacitor.config.json` (or `.ts`) file.*

## Step 3: Add Android Platform
Generate the native Android project folder:
```bash
npx cap add android
```
*Note: This creates the `android/` directory containing the native Gradle configuration, source files, and Android Manifest.*

## Step 4: Add Capacitor Core Plugins
To interact with native APIs (Geolocation, Permissions, Device) from JavaScript, install the official Capacitor plugins:
```bash
npm install @capacitor/geolocation @capacitor/local-notifications @capacitor/device @capacitor/network
```

## Step 5: Build and Sync Web Assets
Compile the React code and copy the static assets into the Android native folder:
```bash
npm run build
npx cap sync
```

## Step 6: Configure Android Manifest (`AndroidManifest.xml`)
Open `android/app/src/main/AndroidManifest.xml` and insert the necessary permissions inside the `<manifest>` tag:

```xml
<!-- Location Permissions -->
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Sensor Permissions -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<!-- Foreground Service Permissions -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

*Note: For Android 14+ (API 34+), foreground services require explicit types. We will configure `foregroundServiceType="microphone|location"` inside the service declaration.*

## Step 7: Launch in Android Studio
Open the project in Android Studio to run it on an emulator or a physical device:
```bash
npx cap open android
```
From Android Studio, compile and run the application.
