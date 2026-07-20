package com.streetsentinel.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.streetsentinel.app.data.model.*
import com.streetsentinel.app.data.repository.AuthRepository
import com.streetsentinel.app.data.repository.BackendApi
import com.streetsentinel.app.data.repository.FirestoreRepository
import com.streetsentinel.app.data.repository.SocketService
import com.streetsentinel.app.services.LocationService
import com.streetsentinel.app.services.AudioDetectionService
import com.streetsentinel.app.services.MotionDetectionService
import com.streetsentinel.app.services.RiskEngine
import com.streetsentinel.app.services.OverpassService
import com.streetsentinel.app.services.SafetyScoreService
import com.streetsentinel.app.services.NearbyZone
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers

/**
 * Direct Kotlin port of the Zustand store `useStore` (src/context/useStore.js).
 * Every public StateFlow here corresponds 1:1 to a field returned from create((set,get)=>({...}))
 * in the original file, and every function mirrors an action of the same name.
 */
class SentinelViewModel(app: Application) : AndroidViewModel(app) {

    private val authRepo = AuthRepository()
    private val firestoreRepo = FirestoreRepository()
    private val backendApi = BackendApi()
    private val socketService = SocketService()
    private val locationService = LocationService(app)
    private val audioDetectionService = AudioDetectionService()
    private val motionDetectionService = MotionDetectionService(app)
    private val overpassService = OverpassService()

    // ---- currentUser / contacts / alertHistory / settings ----
    private val _currentUser = MutableStateFlow<SentinelUser?>(null)
    val currentUser: StateFlow<SentinelUser?> = _currentUser.asStateFlow()

    private val _contacts = MutableStateFlow<List<EmergencyContact>>(emptyList())
    val contacts: StateFlow<List<EmergencyContact>> = _contacts.asStateFlow()

    private val _alertHistory = MutableStateFlow<List<AlertRecord>>(emptyList())
    val alertHistory: StateFlow<List<AlertRecord>> = _alertHistory.asStateFlow()

    private val _settings = MutableStateFlow(UserSettings())
    val settings: StateFlow<UserSettings> = _settings.asStateFlow()

    // ---- network / mesh ----
    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline.asStateFlow()

    private val _isMeshActive = MutableStateFlow(false)
    val isMeshActive: StateFlow<Boolean> = _isMeshActive.asStateFlow()

    // ---- threat / AI state (mirrors threatLevel/aiMessage/riskScore/audioLevel) ----
    private val _threatLevel = MutableStateFlow(ThreatLevel.LOW)
    val threatLevel: StateFlow<ThreatLevel> = _threatLevel.asStateFlow()

    private val _aiMessage = MutableStateFlow("Sentinel AI active. Environment stable.")
    val aiMessage: StateFlow<String> = _aiMessage.asStateFlow()

    // ---- emergency mode ----
    private val _isEmergencyMode = MutableStateFlow(false)
    val isEmergencyMode: StateFlow<Boolean> = _isEmergencyMode.asStateFlow()

    private val _emergencyData = MutableStateFlow<EmergencyData?>(null)
    val emergencyData: StateFlow<EmergencyData?> = _emergencyData.asStateFlow()

    private val _countdown = MutableStateFlow<Int?>(null)
    val countdown: StateFlow<Int?> = _countdown.asStateFlow()

    private val _activeEmergencyId = MutableStateFlow<String?>(null)
    val activeEmergencyId: StateFlow<String?> = _activeEmergencyId.asStateFlow()

    private val _noContactsWarning = MutableStateFlow(false)
    val noContactsWarning: StateFlow<Boolean> = _noContactsWarning.asStateFlow()

    private val _smsDeliveryStatus = MutableStateFlow<String?>(null)
    val smsDeliveryStatus: StateFlow<String?> = _smsDeliveryStatus.asStateFlow()

    private val _emailDeliveryStatus = MutableStateFlow<String?>(null)
    val emailDeliveryStatus: StateFlow<String?> = _emailDeliveryStatus.asStateFlow()

    private val _lastKnownLocation = MutableStateFlow<GeoPoint?>(null)
    val lastKnownLocation: StateFlow<GeoPoint?> = _lastKnownLocation.asStateFlow()

    // ---- Location Context Data (Fetched centrally to avoid UI thrashing) ----
    private val _nearbyZones = MutableStateFlow<List<NearbyZone>>(emptyList())
    val nearbyZones: StateFlow<List<NearbyZone>> = _nearbyZones.asStateFlow()

    private val _safetyScore = MutableStateFlow<Int?>(null)
    val safetyScore: StateFlow<Int?> = _safetyScore.asStateFlow()

    private val _safetyLevel = MutableStateFlow<String?>("WAITING FOR GPS")
    val safetyLevel: StateFlow<String?> = _safetyLevel.asStateFlow()

    private val _safetyReasons = MutableStateFlow<List<String>>(listOf("Locating satellite..."))
    val safetyReasons: StateFlow<List<String>> = _safetyReasons.asStateFlow()

    private val _policeCount = MutableStateFlow<Int?>(null)
    val policeCount: StateFlow<Int?> = _policeCount.asStateFlow()

    private val _hospitalCount = MutableStateFlow<Int?>(null)
    val hospitalCount: StateFlow<Int?> = _hospitalCount.asStateFlow()

    private val _pharmacyCount = MutableStateFlow<Int?>(null)
    val pharmacyCount: StateFlow<Int?> = _pharmacyCount.asStateFlow()

    // ---- Diagnostic / hardware-trigger state (mirrors isListening/rawAmplitude/currentThreshold in useStore.js) ----
    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _audioLevel = MutableStateFlow(-100.0)
    val audioLevel: StateFlow<Double> = _audioLevel.asStateFlow()

    private val _currentThreshold = MutableStateFlow(-15.0)
    val currentThreshold: StateFlow<Double> = _currentThreshold.asStateFlow()

    private val _riskScore = MutableStateFlow(0.0)
    val riskScore: StateFlow<Double> = _riskScore.asStateFlow()

    // ---- Chat selection (used by police: Tactical → Profiles → Message, and Dispatch → Chat with Citizen) ----
    private val _selectedChatConversationId = MutableStateFlow<String?>(null)
    val selectedChatConversationId: StateFlow<String?> = _selectedChatConversationId.asStateFlow()

    private val _selectedChatTitle = MutableStateFlow<String?>(null)
    val selectedChatTitle: StateFlow<String?> = _selectedChatTitle.asStateFlow()

    fun openChatWith(conversationId: String, title: String) {
        _selectedChatConversationId.value = conversationId
        _selectedChatTitle.value = title
    }

    fun clearSelectedChat() {
        _selectedChatConversationId.value = null
        _selectedChatTitle.value = null
    }

    fun chatMessages(conversationId: String) = firestoreRepo.chatMessagesFlow(conversationId)

    fun sendChatMessage(conversationId: String, citizenName: String, text: String, senderRole: String) {
        val senderId = currentUser.value?.uid ?: "unknown"
        viewModelScope.launch {
            runCatching {
                firestoreRepo.sendChatMessage(
                    conversationId, citizenName,
                    com.streetsentinel.app.data.model.ChatMessage(senderId = senderId, senderRole = senderRole, text = text, timestamp = System.currentTimeMillis())
                )
            }
        }
    }

    fun chatThreads() = firestoreRepo.chatThreadsFlow()
    fun citizenProfiles() = firestoreRepo.allCitizenProfilesFlow()

    private var countdownJob: Job? = null
    private var lastCancelTimeMs: Long = 0L

    init {
        // Equivalent of onAuthStateChanged(auth, ...) block in useStore.js
        viewModelScope.launch {
            authRepo.authStateFlow().collect { firebaseUser ->
                if (firebaseUser != null) {
                    attachUserListeners(firebaseUser.uid)
                    connectSocket(activeEmergencyId.value)
                } else {
                    _currentUser.value = null
                    _contacts.value = emptyList()
                    _alertHistory.value = emptyList()
                    _activeEmergencyId.value = null
                    socketService.disconnect()
                }
            }
        }
        // Best-effort start now (covers the case where permission was already granted on a
        // previous run); startLocationTracking() is safe to call again once MainActivity's
        // permission flow confirms ACCESS_FINE_LOCATION was actually granted.
        startLocationTracking()
    }

    private var locationJob: Job? = null

    /**
     * Equivalent of the global geolocation watchPosition() in App.jsx. Bug fix: this used to
     * run once from init{}, before Compose had even asked for the location permission —
     * requestLocationUpdates() throws SecurityException in that case, which silently killed
     * the coroutine forever with no retry. That's why nearby police/hospital/pharmacy data
     * (which all depend on lastKnownLocation) never loaded. MainActivity now calls this again
     * once the runtime permission is actually granted, and failures here no longer take down
     * the whole ViewModel.
     */
    private var lastFetchedLocation: GeoPoint? = null

    private fun showToast(msg: String) {
        viewModelScope.launch(Dispatchers.Main) {
            android.widget.Toast.makeText(getApplication(), msg, android.widget.Toast.LENGTH_LONG).show()
        }
    }

    fun startLocationTracking() {
        locationJob?.cancel()
        locationJob = viewModelScope.launch {
            showToast("Searching for GPS signal...")
            
            // 8-second fallback for emulators or indoor testing without GPS signal
            viewModelScope.launch {
                kotlinx.coroutines.delay(8000)
                if (_lastKnownLocation.value == null) {
                    showToast("No GPS signal. Fetching IP Geolocation...")
                    val ipLoc = locationService.getIpLocation()
                    if (ipLoc != null && _lastKnownLocation.value == null) {
                        showToast("Using Wi-Fi/IP location.")
                        _lastKnownLocation.value = ipLoc
                        checkAndFetchAmenities(ipLoc)
                    } else if (_lastKnownLocation.value == null) {
                        showToast("IP Location failed. Using fallback testing location.")
                        val fallback = GeoPoint(13.0827, 80.2707) // Chennai fallback
                        _lastKnownLocation.value = fallback
                        checkAndFetchAmenities(fallback)
                    }
                }
            }

            viewModelScope.launch {
                try {
                    val immediateLoc = locationService.getCurrentLocation()
                    if (immediateLoc != null && _lastKnownLocation.value == null) {
                        _lastKnownLocation.value = immediateLoc
                        checkAndFetchAmenities(immediateLoc)
                    }
                } catch (e: Exception) {
                    showToast("Immediate GPS fetch failed: ${e.message}")
                }
            }
            try {
                locationService.watchLocation().collect { point ->
                    _lastKnownLocation.value = point
                    checkAndFetchAmenities(point)
                }
            } catch (e: SecurityException) {
                // Permission not granted yet — MainActivity will call startLocationTracking() again.
            } catch (e: Exception) {
                showToast("GPS Watch Error: ${e.message}")
            }
        }
    }

    private suspend fun checkAndFetchAmenities(loc: GeoPoint) {
        val prev = lastFetchedLocation
        // Fetch if we haven't fetched yet, or if we moved > 100 meters
        if (prev == null || calculateDistanceMeters(prev.lat, prev.lng, loc.lat, loc.lng) > 100) {
            lastFetchedLocation = loc
            
            // This runs on IO without blocking the location tracking flow
            viewModelScope.launch(Dispatchers.IO) {
                try {
                    val zones = overpassService.fetchNearbyAmenities(loc.lat, loc.lng, radius = 5000)
                    val landuse = overpassService.fetchLanduse(loc.lat, loc.lng)
                    val result = SafetyScoreService.calculateLocationSafetyScore(zones, landuse)
                    
                    _nearbyZones.value = zones
                    _safetyScore.value = result.score
                    _safetyLevel.value = result.level.name
                    _safetyReasons.value = result.reasons
                    
                    _policeCount.value = zones.count { it.type == "police" }
                    _hospitalCount.value = zones.count { it.type == "hospital" || it.type == "clinic" }
                    _pharmacyCount.value = zones.count { it.type == "pharmacy" || it.type == "chemist" }
                    
                    if (zones.isEmpty()) {
                        showToast("GPS Locked, but 0 safe zones found in 15km.")
                    } else {
                        showToast("GPS Locked: Found ${zones.size} safe zones.")
                    }
                } catch (e: Exception) {
                    lastFetchedLocation = null // Reset so it tries again next emission!
                    showToast("API Fetch Error: ${e.message}")
                }
            }
        }
    }

    private fun calculateDistanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = kotlin.math.sin(dLat / 2) * kotlin.math.sin(dLat / 2) + 
                kotlin.math.cos(Math.toRadians(lat1)) * kotlin.math.cos(Math.toRadians(lat2)) * 
                kotlin.math.sin(dLon / 2) * kotlin.math.sin(dLon / 2)
        val c = 2 * kotlin.math.atan2(kotlin.math.sqrt(a), kotlin.math.sqrt(1 - a))
        return r * c
    }

    private fun attachUserListeners(uid: String) {
        viewModelScope.launch { firestoreRepo.userDoc(uid).collect { u -> _currentUser.value = u ?: SentinelUser(uid = uid) } }
        viewModelScope.launch { firestoreRepo.contactsFlow(uid).collect { _contacts.value = it } }
        viewModelScope.launch { firestoreRepo.alertsFlow(uid).collect { _alertHistory.value = it } }
        viewModelScope.launch { firestoreRepo.settingsFlow(uid).collect { _settings.value = it } }
        viewModelScope.launch {
            firestoreRepo.activeEmergencyIdFlow(uid).collect { id ->
                _activeEmergencyId.value = id
                _isEmergencyMode.value = id != null
            }
        }
    }

    private fun connectSocket(activeId: String?) {
        viewModelScope.launch {
            val token = authRepo.getIdToken() ?: return@launch
            socketService.connect(token, activeId, currentUser.value?.role ?: "citizen")
        }
    }

    // ---- Auth actions ----
    suspend fun login(email: String, password: String) = authRepo.signIn(email, password)
    suspend fun signup(email: String, password: String) = authRepo.signUp(email, password)

    /**
     * Writes the initial profile fields right after signup, using the uid returned directly
     * from Firebase Auth. Bug fix: the old code called updateUserProfile(fields) here, which
     * reads currentUser.value?.uid — but currentUser is populated asynchronously by the
     * authStateFlow listener and is reliably still null at this exact moment, so the write
     * silently no-op'd and the profile (name/phone/role) was never actually saved. That's why
     * "citizen profile data not fetching" — there was nothing in Firestore to fetch.
     */
    suspend fun completeSignupProfile(uid: String, fields: Map<String, Any?>) {
        runCatching { firestoreRepo.updateUserProfile(uid, fields) }
    }
    fun logout() {
        authRepo.signOut()
        socketService.disconnect()
    }

    // ---- Settings / contacts (mirrors updateSettings/addContact/deleteContact) ----
    fun updateSettings(newSettings: UserSettings) {
        val uid = currentUser.value?.uid ?: return
        _settings.value = newSettings
        viewModelScope.launch { firestoreRepo.updateSettings(uid, newSettings) }
    }

    fun addContact(contact: EmergencyContact) {
        val uid = currentUser.value?.uid ?: return
        viewModelScope.launch { firestoreRepo.addContact(uid, contact) }
    }

    fun deleteContact(contactId: String) {
        val uid = currentUser.value?.uid ?: return
        viewModelScope.launch { firestoreRepo.deleteContact(uid, contactId) }
    }

    fun setOfflineStatus(offline: Boolean) { _isOffline.value = offline }
    fun clearNoContactsWarning() { _noContactsWarning.value = false }

    /**
     * Direct port of useHardwareTriggers.js: toggling isListening starts/stops the mic +
     * accelerometer pipeline. Loud sound spikes and shake gestures call triggerEmergency();
     * ambient risk score is recalculated continuously via RiskEngine and only updates the
     * displayed threat level (it does not by itself trigger an emergency).
     */
    fun setIsListening(active: Boolean) {
        _isListening.value = active
        if (!active) {
            audioDetectionService.stop()
            _audioLevel.value = -100.0
            return
        }
        audioDetectionService.start(viewModelScope)
        viewModelScope.launch {
            audioDetectionService.decibels.collect { db ->
                _audioLevel.value = db
                _currentThreshold.value = audioDetectionService.currentThreshold.value

                val baseline = -50.0 // matches the hook's initial baselineDb before calibration completes
                val dbSeverity = if (db > baseline + 20) ((db - baseline - 20) / 40).coerceIn(0.0, 1.0) else 0.0
                val result = com.streetsentinel.app.services.RiskEngine.calculateRisk(dbSeverity = dbSeverity)
                _riskScore.value = result.score

                when (result.level) {
                    com.streetsentinel.app.services.RiskLevel.EMERGENCY ->
                        setThreatLevel(ThreatLevel.HIGH, "High ambient noise detected. Stay alert.")
                    com.streetsentinel.app.services.RiskLevel.HIGH_RISK ->
                        setThreatLevel(ThreatLevel.MEDIUM, "Elevated noise level. Monitoring closely.")
                    else -> if (threatLevel.value != ThreatLevel.CRITICAL) setThreatLevel(ThreatLevel.LOW, "Sentinel AI active. Environment stable.")
                }
            }
        }
        viewModelScope.launch {
            audioDetectionService.threats.collect { threat ->
                if (threat.type == "VOICE_SOS" || threat.type == "LOUD_SOUND_SOS") {
                    triggerEmergency("Audio Threat Detected")
                }
            }
        }
        viewModelScope.launch {
            motionDetectionService.shakeEvents().collect {
                triggerEmergency("Shake SOS Detected")
            }
        }
    }

    fun setThreatLevel(level: ThreatLevel, message: String?) {
        _threatLevel.value = level
        if (message != null) _aiMessage.value = message
    }

    /**
     * Direct port of triggerEmergency(reason, audioLabel, audioConfidence) from useStore.js:
     * guards on cooldown + zero contacts, starts a 15s countdown, then calls sendEmergencyAlert.
     */
    fun triggerEmergency(reason: String) {
        if (isEmergencyMode.value || countdownJob != null) return
        if (System.currentTimeMillis() - lastCancelTimeMs < 10_000) return
        if (contacts.value.isEmpty()) {
            _noContactsWarning.value = true
            return
        }

        _threatLevel.value = ThreatLevel.CRITICAL
        _aiMessage.value = "We detected a possible distress situation. Would you like to share your live location with your emergency contacts?"
        _countdown.value = 15
        vibrateAlertPattern()
        postEmergencyNotification()

        countdownJob = viewModelScope.launch {
            var remaining = 15
            while (remaining > 0) {
                delay(1000)
                remaining -= 1
                _countdown.value = if (remaining > 0) remaining else null
            }
            countdownJob = null
            sendEmergencyAlert(reason)
        }
    }

    /** Direct port of sendEmergencyAlert() from useStore.js */
    fun sendEmergencyAlert(reason: String = "Manual SOS Override") {
        viewModelScope.launch {
            val offlineNow = isOffline.value
            _countdown.value = null
            _isEmergencyMode.value = true
            _isMeshActive.value = offlineNow
            _emergencyData.value = EmergencyData(reason = reason, startTime = System.currentTimeMillis())
            _smsDeliveryStatus.value = if (offlineNow) "QUEUED_MESH" else "PENDING"
            _aiMessage.value = if (offlineNow)
                "OFFLINE DETECTED. Mesh Network Protocol Activated. Broadcasting SOS to nearby peers."
            else "CRITICAL ALERT. Emergency Mode Activated. Dispatching authorities."

            val coords = lastKnownLocation.value ?: locationService.getCurrentLocation() ?: GeoPoint(12.9716, 77.5946)
            val mapsLink = locationService.mapsLinkFor(coords)
            _emergencyData.value = _emergencyData.value?.copy(locationUrl = mapsLink)

            val uid = currentUser.value?.uid
            var userAlertId: String? = null
            if (uid != null) {
                val ids = try {
                    firestoreRepo.createEmergency(
                        uid, currentUser.value?.name ?: "Citizen", currentUser.value?.phone ?: "",
                        reason, coords, mapsLink
                    )
                } catch (e: Exception) { null }
                _activeEmergencyId.value = ids?.first
                userAlertId = ids?.second
            }

            if (offlineNow) {
                _emailDeliveryStatus.value = "QUEUED_MESH"
                return@launch // mirrors early-return: mesh queue path
            }

            if (contacts.value.isEmpty()) {
                _smsDeliveryStatus.value = "NO_CONTACTS"
                _emailDeliveryStatus.value = "NO_CONTACTS"
                return@launch
            }

            _emailDeliveryStatus.value = "SENDING"
            val token = authRepo.getIdToken()
            val result = backendApi.dispatchEmergency(
                idToken = token,
                emergencyId = activeEmergencyId.value,
                reason = reason,
                location = coords,
                mapsLink = mapsLink,
                contacts = contacts.value,
                userName = currentUser.value?.name ?: "Citizen",
                userPhone = currentUser.value?.phone ?: ""
            )
            val finalSmsStatus = if (result.success) (result.smsStatus ?: "SUCCESS") else "ERROR"
            val finalEmailStatus = if (result.success) (result.emailStatus ?: "SUCCESS") else "ERROR"
            _smsDeliveryStatus.value = finalSmsStatus
            _emailDeliveryStatus.value = finalEmailStatus

            firestoreRepo.updateEmergencyStatus(uid, userAlertId, activeEmergencyId.value, finalSmsStatus, finalEmailStatus)
        }
    }

    /** Direct port of cancelEmergency() from useStore.js */
    fun cancelEmergency() {
        countdownJob?.cancel()
        countdownJob = null
        val activeId = activeEmergencyId.value
        if (activeId != null) {
            viewModelScope.launch { runCatching { firestoreRepo.resolveEmergency(activeId) } }
        }
        _isEmergencyMode.value = false
        _emergencyData.value = null
        _countdown.value = null
        _smsDeliveryStatus.value = null
        _threatLevel.value = ThreatLevel.LOW
        _aiMessage.value = "Emergency cancelled. System returning to normal."
        lastCancelTimeMs = System.currentTimeMillis()
        _activeEmergencyId.value = null
    }

    fun updateUserProfile(fields: Map<String, Any?>) {
        val uid = currentUser.value?.uid ?: return
        viewModelScope.launch { runCatching { firestoreRepo.updateUserProfile(uid, fields) } }
    }

    /** Port of `navigator.vibrate([500, 250, 500])` in triggerEmergency(). */
    private fun vibrateAlertPattern() {
        val app = getApplication<Application>()
        val vibrator = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            (app.getSystemService(android.content.Context.VIBRATOR_MANAGER_SERVICE) as? android.os.VibratorManager)?.defaultVibrator
        } else {
            app.getSystemService(android.content.Context.VIBRATOR_SERVICE) as? android.os.Vibrator
        }
        vibrator?.vibrate(android.os.VibrationEffect.createWaveform(longArrayOf(0, 500, 250, 500), -1))
    }

    /** Port of the browser Notification + Capacitor LocalNotifications calls in triggerEmergency(). */
    private fun postEmergencyNotification() {
        val app = getApplication<Application>()
        if (android.os.Build.VERSION.SDK_INT >= 33 &&
            androidx.core.content.ContextCompat.checkSelfPermission(app, android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) return
        val notification = androidx.core.app.NotificationCompat.Builder(app, com.streetsentinel.app.SentinelApplication.EMERGENCY_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("StreetSentinel Alert")
            .setContentText("Emergency detected! Open app if you are SAFE.")
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
            .setCategory(androidx.core.app.NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .build()
        androidx.core.app.NotificationManagerCompat.from(app).notify(999, notification)
    }
}
