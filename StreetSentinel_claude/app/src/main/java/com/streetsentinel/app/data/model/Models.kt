package com.streetsentinel.app.data.model

/** Mirrors the `currentUser` shape in useStore.js / users/{uid} Firestore doc. */
data class SentinelUser(
    val uid: String = "",
    val email: String = "",
    val name: String = "Citizen",
    val phone: String = "",
    val role: String = "citizen", // "citizen" | "police" | "admin"
    val photoUrl: String = "",
    val isMockUser: Boolean = false
)

/** Mirrors a contact doc under users/{uid}/contacts */
data class EmergencyContact(
    val id: String = "",
    val name: String = "",
    val phone: String = "",
    val relation: String = "",
    val email: String = ""
)

/** Mirrors an alert doc under users/{uid}/alerts */
data class AlertRecord(
    val id: String = "",
    val type: String = "",
    val timestamp: Long = 0L,
    val riskLevel: String = "LOW", // LOW | MEDIUM | HIGH | CRITICAL
    val location: GeoPoint? = null,
    val smsStatus: String = "PENDING",
    val emailStatus: String = "PENDING",
    val whatsappShared: Boolean = false,
    val audioLabel: String? = null,
    val audioConfidence: Double? = null,
    val mapsLink: String? = null,
    val meshRelayed: Boolean = false
)

data class GeoPoint(val lat: Double, val lng: Double)

/** Mirrors `settings` in useStore.js (users/{uid}/settings/default) */
data class UserSettings(
    val mic: Boolean = true,
    val gps: Boolean = true,
    val notifications: Boolean = true,
    val emailAlerts: Boolean = true,
    val whatsappAlerts: Boolean = true
)

/** Mirrors `emergencyData` object built in triggerEmergency()/sendEmergencyAlert() */
data class EmergencyData(
    val reason: String = "",
    val startTime: Long = 0L,
    val assignedOfficer: String? = null,
    val eta: String? = null,
    val locationUrl: String? = null,
    val floorLevel: String? = null
)

enum class ThreatLevel { LOW, MEDIUM, HIGH, CRITICAL }

/** Mirrors emergencyChats[alertId] message shape (socket.io payload) */
data class ChatMessage(
    val senderId: String = "",
    val senderRole: String = "", // "citizen" | "police"
    val text: String = "",
    val timestamp: Long = 0L,
    val status: String = "sent", // sent | read
    val senderName: String = "",
    val alertId: String = ""
)
