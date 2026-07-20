# Street Sentinel — Native Android (Kotlin + Jetpack Compose)

This is a native Kotlin rewrite of the Street Sentinel web app (`street-patrol/src`), built
as a real Android Studio project — **not** the Capacitor-wrapped web view used by
`StreetSentinel_Android`. Architecture choices (confirmed with you): **Jetpack Compose**,
**osmdroid** for maps (OSM tiles, no Google Maps API key — same as the web app's Leaflet setup).

## How to open it
1. Open this folder (`StreetSentinel_claude`) directly in Android Studio (Koala+ / any
   version supporting AGP 8.6 & Kotlin 2.0).
2. Replace `app/google-services.json` with the **real** file from your Firebase project
   (Firebase Console → Project settings → your Android app, package `com.streetsentinel.app`).
   This must be the same Firebase project your web app already points at (see
   `src/firebase/config.js`) so both clients share the same `users`, `emergencies`, etc.
   collections and the same Firestore security rules (`firestore.rules`).
3. Run your existing Node/Express backend (the `server/` folder from the web project) —
   no backend changes are needed. The app talks to it over REST (`/emergency/dispatch`)
   and Socket.IO exactly like `useStore.js` does.
   - On an emulator it's pre-wired to `http://10.0.2.2:4000` (emulator's alias for your
     host machine), matching the same 10.0.2.2 rewrite `getBackendUrl()` does for
     Capacitor native builds.
   - On a physical device, change `BACKEND_URL`/`SOCKET_URL` in `app/build.gradle.kts`
     to your machine's LAN IP.
4. Build & run.

## Phase 3 — corrections from your video review (this pass)

You flagged specific things that didn't match the web app's real behavior. Here's what was
actually wrong and what was fixed, based on re-reading the exact web source for each:

1. **Home screen "hero"/disarm button was the wrong component.** The previous pass used a
   3-state Smart/Extreme `ProtectionToggle` dial, but the real `CitizenHome.jsx` uses a single
   ARM/DISARM Shield toggle with a live dB meter (with a threshold marker line) directly in the
   hero card. `CitizenHomeScreen.kt` is now a full rebuild matching that: ARM/DISARM button,
   live dB bar with threshold marker, "Only saying 'help me'/'save me' triggers SOS" copy,
   safety-score cards, hospital/pharmacy counts, the exact 6-item quick-access grid, and the
   Fake Call / Voice SOS utility row.

2. **The 15s countdown → "I'm Safe"/"Send Location Now" → auto-email-to-contacts flow was
   completely missing.** This lives in `components/ui/EmergencyOverlay.jsx` in the web app —
   a *global* overlay mounted above all routes, not something embedded in one screen. That's
   why "disarm was listening but nothing happened after detection": the countdown state was
   being set in the ViewModel, but nothing was ever shown for it. Added `EmergencyOverlay.kt`
   as a real global overlay (mounted in `MainActivity` above the nav host, exactly like the web
   app mounts it outside `<Outlet/>`), plus vibration and a real Android notification
   (`SentinelViewModel`'s `vibrateAlertPattern()`/`postEmergencyNotification()`), matching
   `navigator.vibrate()` + the browser Notification call in `triggerEmergency()`. If untouched,
   it now auto-calls `sendEmergencyAlert()` at 0 — which is what dispatches to the backend,
   which emails/SMSs your emergency contacts.

3. **SafeWalk was just a static map.** Rebuilt to match `SafeWalk.jsx`: destination search
   (Nominatim), a real walking route drawn from OSRM, a live area safety score, and the
   check-in monitor (port of `useSafeWalkMonitor.js`) — pick an interval, walk, and if you
   don't confirm "I'm Safe" within 15s of a check-in, it automatically calls
   `triggerEmergency("SafeWalk Check-In Timeout")`, same as the web app.

4. **Tactical Command showed 4 static rows with no data.** It's now a full rebuild with the
   real 3-tab structure from `TacticalCommand.jsx`: **SOS Feed** (live incidents + a resolved
   case ledger), **Profiles** (every citizen account in Firestore, expandable to show their
   saved contacts + alert history), and **Stations** (nearby police stations via Overpass).

5. **Police Dashboard didn't show SOS triggers or citizen data.** Rebuilt against real
   Firestore data: a stats bar (active/dispatched/total), a map with markers for every live
   emergency (so a citizen's SOS now appears on it immediately), and an incident feed with
   working **Dispatch**/**Resolve** buttons that write back to Firestore. Citizen profiles are
   covered by Tactical Command's Profiles tab (that's where the web app puts them too — see
   `TacticalCommand.jsx`, not `PoliceDashboard.jsx`).

Added along the way: `FirestoreRepository.allEmergenciesFlow()` / `allCitizenProfilesFlow()` /
`dispatchEmergency()`, and `RouteService.kt` (Nominatim search + OSRM routing, both free/no-key,
matching the web app's setup).

## Phase 4 — this pass (bug fixes + Tactical/Dispatch overhaul)

1. **Root cause of "citizen profile data not fetching": found and fixed.** `SignupScreen`
   called `viewModel.updateUserProfile(...)`, which reads `currentUser.value?.uid` — but that
   StateFlow is only populated once the async auth-state listener catches up, which is
   reliably *after* signup returns. So the profile write silently no-op'd and nothing was ever
   saved. Fixed by adding `completeSignupProfile(uid, fields)`, which writes using the uid
   returned directly from Firebase Auth instead of relying on ViewModel state that isn't
   ready yet.

2. **Root cause of "nearby police/hospitals/pharmacies not fetching via GPS": found and
   fixed.** The ViewModel started watching location in `init{}`, before Compose had even
   asked for the location permission — `requestLocationUpdates()` threw `SecurityException`
   on that first attempt and the coroutine died with no retry, so `lastKnownLocation` stayed
   null forever (which is what all the amenity-fetching `LaunchedEffect(lastLocation)` blocks
   depend on). `startLocationTracking()` is now restartable and safe to fail, and
   `MainActivity` calls it again the moment the permission is actually granted.

3. **Emergency contacts: email is now a required field.** `EmergencyContact` already had an
   `email` property, but the Add Contact dialog never asked for it — so contacts were being
   saved with no email, and the backend had nothing to send SOS alerts to. The dialog now
   requires and validates an email before saving, shows it in the contact list, and an
   existing-contacts screen shows a warning banner if any saved contact is still missing one.

4. **SafeWalk map now shows nearby police/hospitals/pharmacies.** It was fetching the data for
   the safety score but never drawing it — the map only had your position, destination, and
   route. Added color-coded markers (blue police, red hospital, green pharmacy) plus a legend
   row with live counts, so you can see the same facility data that's already available in
   the citizen home screen and Tactical Command's Stations tab.

5. **Police Dispatch screen: redesigned + citizen chat wired in.** Rounded/elevated map card
   instead of a flush block, consistent card spacing, and a cleaner 3-action row
   (Chat / Dispatch / Resolve) that no longer competes for space. "Chat" opens a real
   conversation with the citizen who triggered that SOS (see #7).

6. **Tactical Command: Profiles tab can now message any citizen.** Each profile card has a
   Message button (and a full-width one when expanded) that opens a direct chat thread with
   that citizen — even with no active emergency, per your request ("police can communicate
   with all the registered profiles").

7. **Real two-way chat, backed by Firestore (this is the biggest structural fix).** The old
   chat screens only held messages in local, per-screen memory — nothing was ever actually
   sent anywhere, so a citizen's message could never reach a police account. Added:
   - `FirestoreRepository.chatMessagesFlow()` / `sendChatMessage()` / `chatThreadsFlow()` —
     one conversation thread per citizen (`chats/{citizenUid}/messages`), shared by that
     citizen's Police Chat screen and every officer's inbox.
   - `ChatThread.kt` — one shared, reusable chat UI for both sides.
   - `PoliceChatScreen` is now a real inbox: every citizen conversation, newest first, with a
     last-message preview — tapping one opens the live thread. This is what "chat page can
     have all the people's message inboxes" needed.
   - `CitizenChatScreen` now persists to that same thread instead of a local list.

8. **Police bottom-nav icons changed**, per your request: Dispatch → badge icon, Map → globe,
   Tactical → shield, Chat → forum/inbox icon — more distinct at a glance than the previous
   generic set.

9. **Login / Signup redesigned** as an elevated card on a dark gradient background, with
   icon-accented fields, a password visibility toggle, and a role badge chip — everything
   else in the app (colors, navigation, all other screens) is untouched, as requested.

## What's fully ported (real logic, not placeholder UI)
- **Theme**: colors ported 1:1 from `src/index.css`'s active `@theme` tokens (white/slate
  background, `#E11D48` red primary) — confirmed via `main.jsx` that this file, not the
  unused dark-neon `styles/themes/dark.css`, is what the web app actually renders.
- **State management** (`SentinelViewModel.kt`): a direct line-by-line port of the Zustand
  store `useStore.js` — `triggerEmergency`/`sendEmergencyAlert`/`cancelEmergency` with the
  same 15s countdown, 10s cancel-cooldown, no-contacts guard, offline→mesh branching, and
  Firestore/backend dispatch sequence.
- **Firebase**: `AuthRepository` + `FirestoreRepository` mirror `firebase/config.js` and the
  `onSnapshot` listeners in `setupListeners(uid)` (contacts, alerts, settings, active
  emergency).
- **Backend integration**: `BackendApi.kt` (REST) + `SocketService.kt` (Socket.IO client)
  are drop-in native equivalents of the `fetch()` and `socket.io-client` calls — same
  endpoints, same payload shapes.
- **Navigation**: `NavGraph.kt` mirrors `App.jsx`'s full route tree (auth → citizen/police/admin),
  including role-based landing after login/signup.
- **Screens with real, working logic**: Splash, Onboarding, RoleSelection, AuthLanding,
  Login, Signup, Citizen Home, Emergency SOS (full quick-actions grid + live contacts),
  SafeWalk (osmdroid map centered on live GPS), Alerts (live Firestore list), Contacts
  (add/delete/call, live Firestore), Profile, Settings (live toggles bound to Firestore).
- **Police Dashboard & Map**: live-bound to the same `emergencies` collection the web
  Police views use.

## Phase 2 — completed this pass
These moved from "flagged as lighter" to fully wired with real logic (not placeholders):
- **Audio threat detection** (`useAudioDetection.js` → `services/AudioDetectionService.kt`):
  real mic RMS→dB detection via `AudioRecord`, same day/night absolute + spike thresholds,
  calibration baseline, and loud-noise-spike event stream as the web hook.
- **Shake-to-SOS** (`useMotionDetection.js` → `services/MotionDetectionService.kt`): real
  accelerometer shake detection (3 shakes/2s) via `SensorManager`.
- **Risk engine** (`useRiskEngine.js` → `services/RiskAndSafetyScoring.kt`): same weighted
  geo/audio/time-of-day formula, ported 1:1.
- **Location safety scoring** (`safetyScoreService.js` + `overpassService.js` →
  `RiskAndSafetyScoring.kt` + `services/OverpassService.kt`): same scoring rubric and the
  same OSM Overpass endpoint fallback chain + generated fallback amenities.
- **Hardware trigger pipeline** (`useHardwareTriggers.js` → `SentinelViewModel.setIsListening()`):
  wires all of the above together — mic + shake both call `triggerEmergency()`, ambient risk
  continuously updates `threatLevel` without auto-triggering, matching the web hook's split
  behavior exactly.
- `CitizenHomeScreen`'s protection toggle/status card, `DiagnosticsScreen`, and `SafeWalkScreen`
  (live safety-score badge) now all show this real data instead of static placeholders.

## What's still lighter (next candidates)
- **AI vision snapshot** (`AISnapshotModule.jsx` + `aiVisionService.js`, TensorFlow.js
  coco-ssd) → native equivalent would use ML Kit Object Detection (already added as a
  Gradle dependency) + CameraX; not yet wired to the emergency flow.
- **Offline P2P mesh** (`p2pMeshService.js`) → native equivalent is Google Nearby
  Connections API; permissions are declared in the manifest, service not yet built.
- **Route safety scoring** (`routeSafetyService.js`) → single-point safety score is live in
  SafeWalk; scoring a full route between two points is not yet ported.
- **Floor detection** (`useFloorFinder.js`, `useVerticalPositioning.js`) → barometer-based,
  niche, not yet ported.
- **Guardians, Evidence Vault, System Health, Citizen/Police Chat, Tactical Command** →
  structurally present with live Firestore/ViewModel bindings where simple, but simplified
  relative to their much larger JS originals.
- **Admin analytics/users/heatmap/settings** → same as the web app: mock placeholder
  pages (the original `AdminHome.jsx` and siblings are themselves placeholders with
  static numbers, so this is intentional parity, not a shortcut).

## Project structure
```
app/src/main/java/com/streetsentinel/app/
  theme/           Color.kt, Theme.kt              — ported from index.css
  navigation/      Routes.kt, NavGraph.kt           — ported from App.jsx routes
  data/model/      Models.kt                        — Firestore doc shapes
  data/repository/ AuthRepository, FirestoreRepository, BackendApi, SocketService
  services/        LocationService, AudioDetectionService, MotionDetectionService,
                    RiskAndSafetyScoring (RiskEngine + SafetyScoreService),
                    OverpassService, SentinelProtectionService
  viewmodel/       SentinelViewModel.kt              — port of useStore.js
  ui/auth/         Splash, Onboarding, RoleSelection, AuthLanding, Login, Signup
  ui/citizen/      Scaffold + all 12 citizen screens
  ui/police/       Scaffold + 4 police screens
  ui/admin/        Scaffold + admin home/placeholders
```

## Suggested next steps
Tell me which item to deepen next — AI snapshot vision, route safety scoring, or the
offline mesh — and I'll port that service in full next.
