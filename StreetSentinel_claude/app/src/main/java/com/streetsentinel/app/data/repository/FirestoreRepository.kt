package com.streetsentinel.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.streetsentinel.app.data.model.AlertRecord
import com.streetsentinel.app.data.model.ChatMessage
import com.streetsentinel.app.data.model.EmergencyContact
import com.streetsentinel.app.data.model.GeoPoint
import com.streetsentinel.app.data.model.SentinelUser
import com.streetsentinel.app.data.model.UserSettings
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Equivalent of `db` export in src/firebase/config.js plus the onSnapshot()
 * listeners registered in useStore.js: setupListeners(uid).
 */
class FirestoreRepository(private val db: FirebaseFirestore = FirebaseFirestore.getInstance()) {

    fun userDoc(uid: String): Flow<SentinelUser?> = callbackFlow {
        val reg = db.collection("users").document(uid).addSnapshotListener { snap, _ ->
            if (snap != null && snap.exists()) {
                trySend(
                    SentinelUser(
                        uid = uid,
                        email = snap.getString("email") ?: "",
                        name = snap.getString("name") ?: "Citizen",
                        phone = snap.getString("phone") ?: "",
                        role = snap.getString("role") ?: "citizen",
                        photoUrl = snap.getString("photoUrl") ?: ""
                    )
                )
            } else trySend(null)
        }
        awaitClose { reg.remove() }
    }

    fun contactsFlow(uid: String): Flow<List<EmergencyContact>> = callbackFlow {
        val reg = db.collection("users").document(uid).collection("contacts")
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.map {
                    EmergencyContact(
                        id = it.id,
                        name = it.getString("name") ?: "",
                        phone = it.getString("phone") ?: "",
                        relation = it.getString("relation") ?: "",
                        email = it.getString("email") ?: ""
                    )
                } ?: emptyList()
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    fun alertsFlow(uid: String): Flow<List<AlertRecord>> = callbackFlow {
        val reg = db.collection("users").document(uid).collection("alerts")
            .addSnapshotListener { snap, _ ->
                val list = (snap?.documents?.map { d ->
                    val loc = d.get("location") as? Map<*, *>
                    AlertRecord(
                        id = d.id,
                        type = d.getString("type") ?: "",
                        timestamp = d.getLong("timestamp") ?: 0L,
                        riskLevel = d.getString("riskLevel") ?: "LOW",
                        location = loc?.let { GeoPoint((it["lat"] as? Double) ?: 0.0, (it["lng"] as? Double) ?: 0.0) },
                        smsStatus = d.getString("smsStatus") ?: "PENDING",
                        emailStatus = d.getString("emailStatus") ?: "PENDING",
                        mapsLink = d.getString("mapsLink")
                    )
                } ?: emptyList()).sortedByDescending { it.timestamp }
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    fun settingsFlow(uid: String): Flow<UserSettings> = callbackFlow {
        val ref = db.collection("users").document(uid).collection("settings").document("default")
        val reg = ref.addSnapshotListener { snap, _ ->
            if (snap != null && snap.exists()) {
                trySend(
                    UserSettings(
                        mic = snap.getBoolean("mic") ?: true,
                        gps = snap.getBoolean("gps") ?: true,
                        notifications = snap.getBoolean("notifications") ?: true,
                        emailAlerts = snap.getBoolean("emailAlerts") ?: true,
                        whatsappAlerts = snap.getBoolean("whatsappAlerts") ?: true
                    )
                )
            } else {
                ref.set(UserSettings())
                trySend(UserSettings())
            }
        }
        awaitClose { reg.remove() }
    }

    /** Mirrors listening to `emergencies` collection where userId == uid && status active/dispatched */
    fun activeEmergencyIdFlow(uid: String): Flow<String?> = callbackFlow {
        val reg = db.collection("emergencies").whereEqualTo("userId", uid)
            .addSnapshotListener { snap, _ ->
                var activeId: String? = null
                snap?.documents?.forEach { d ->
                    val status = d.getString("status")
                    if (status == "active" || status == "dispatched") activeId = d.id
                }
                trySend(activeId)
            }
        awaitClose { reg.remove() }
    }

    suspend fun addContact(uid: String, contact: EmergencyContact) {
        db.collection("users").document(uid).collection("contacts").add(
            mapOf("name" to contact.name, "phone" to contact.phone, "relation" to contact.relation, "email" to contact.email)
        ).await()
    }

    suspend fun deleteContact(uid: String, contactId: String) {
        db.collection("users").document(uid).collection("contacts").document(contactId).delete().await()
    }

    suspend fun updateSettings(uid: String, settings: UserSettings) {
        db.collection("users").document(uid).collection("settings").document("default")
            .set(settings).await()
    }

    suspend fun createEmergency(uid: String, userName: String, userPhone: String, reason: String, loc: GeoPoint, mapsLink: String): Pair<String, String> {
        val userAlertRef = db.collection("users").document(uid).collection("alerts").add(
            mapOf(
                "type" to reason, "timestamp" to System.currentTimeMillis(), "riskLevel" to "CRITICAL",
                "location" to mapOf("lat" to loc.lat, "lng" to loc.lng), "smsStatus" to "PENDING",
                "emailStatus" to "PENDING", "mapsLink" to mapsLink
            )
        ).await()

        val globalRef = db.collection("emergencies").add(
            mapOf(
                "userId" to uid, "userName" to userName, "userPhone" to userPhone, "reason" to reason,
                "location" to mapOf("lat" to loc.lat, "lng" to loc.lng), "mapsLink" to mapsLink,
                "status" to "active", "timestamp" to System.currentTimeMillis(),
                "smsStatus" to "PENDING", "emailStatus" to "PENDING"
            )
        ).await()
        return Pair(globalRef.id, userAlertRef.id)
    }

    suspend fun updateEmergencyStatus(uid: String?, alertId: String?, globalEmergencyId: String?, smsStatus: String, emailStatus: String) {
        if (uid != null && alertId != null) {
            runCatching {
                db.collection("users").document(uid).collection("alerts").document(alertId)
                    .update(mapOf("smsStatus" to smsStatus, "emailStatus" to emailStatus)).await()
            }
        }
        if (globalEmergencyId != null) {
            runCatching {
                db.collection("emergencies").document(globalEmergencyId)
                    .update(mapOf("smsStatus" to smsStatus, "emailStatus" to emailStatus)).await()
            }
        }
    }

    suspend fun resolveEmergency(emergencyId: String) {
        db.collection("emergencies").document(emergencyId).update("status", "resolved").await()
    }

    /** Mirrors setDoc(doc(db,'users',uid), fields, {merge:true}) in updateUserProfile() */
    suspend fun updateUserProfile(uid: String, fields: Map<String, Any?>) {
        db.collection("users").document(uid).set(fields, com.google.firebase.firestore.SetOptions.merge()).await()
    }

    /** All active/dispatched emergencies, for Police/Admin dashboards (PoliceDashboard.jsx / PoliceMap.jsx) */
    fun allActiveEmergenciesFlow(): Flow<List<Map<String, Any?>>> = callbackFlow {
        val reg = db.collection("emergencies").whereIn("status", listOf("active", "dispatched"))
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.map { it.data.orEmpty() + mapOf("id" to it.id) } ?: emptyList()
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    /** ALL emergencies regardless of status (active/dispatched/resolved) — feeds TacticalCommand's historic case ledger. */
    fun allEmergenciesFlow(): Flow<List<Map<String, Any?>>> = callbackFlow {
        val reg = db.collection("emergencies")
            .addSnapshotListener { snap, _ ->
                val list = (snap?.documents?.map { it.data.orEmpty() + mapOf("id" to it.id) } ?: emptyList())
                    .sortedByDescending { (it["timestamp"] as? Number)?.toLong() ?: 0L }
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    /** All citizen profiles, for PoliceDashboard/TacticalCommand's "Profiles" view. */
    fun allCitizenProfilesFlow(): Flow<List<SentinelUser>> = callbackFlow {
        val reg = db.collection("users").whereEqualTo("role", "citizen")
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.map { d ->
                    SentinelUser(
                        uid = d.id,
                        email = d.getString("email") ?: "",
                        name = d.getString("name") ?: "Citizen",
                        phone = d.getString("phone") ?: "",
                        role = d.getString("role") ?: "citizen",
                        photoUrl = d.getString("photoUrl") ?: ""
                    )
                } ?: emptyList()
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    // ---- Chat: one thread per citizen (conversationId == citizen uid), shared by the citizen's
    // Police Chat screen and every officer's Chat inbox. Officers can open a thread for any
    // registered citizen (Tactical → Profiles → Message) even with no active emergency, and a
    // citizen's active-SOS chat is the same thread — matching the web app's single dispatch
    // uplink per citizen.

    fun chatMessagesFlow(conversationId: String): Flow<List<ChatMessage>> = callbackFlow {
        val reg = db.collection("chats").document(conversationId).collection("messages")
            .addSnapshotListener { snap, _ ->
                val list = (snap?.documents?.map { d ->
                    ChatMessage(
                        senderId = d.getString("senderId") ?: "",
                        senderRole = d.getString("senderRole") ?: "",
                        text = d.getString("text") ?: "",
                        timestamp = d.getLong("timestamp") ?: 0L,
                        status = d.getString("status") ?: "sent"
                    )
                } ?: emptyList()).sortedBy { it.timestamp }
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    suspend fun sendChatMessage(conversationId: String, citizenName: String, message: ChatMessage) {
        db.collection("chats").document(conversationId).collection("messages").add(
            mapOf(
                "senderId" to message.senderId, "senderRole" to message.senderRole,
                "text" to message.text, "timestamp" to message.timestamp, "status" to "sent"
            )
        ).await()
        // Parent doc powers the police inbox list (thread preview + ordering).
        db.collection("chats").document(conversationId).set(
            mapOf(
                "citizenUid" to conversationId, "citizenName" to citizenName,
                "lastMessage" to message.text, "lastSenderRole" to message.senderRole,
                "lastTimestamp" to message.timestamp
            ),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
    }

    /** All chat threads, newest first — feeds the police Chat tab's inbox list. */
    fun chatThreadsFlow(): Flow<List<Map<String, Any?>>> = callbackFlow {
        val reg = db.collection("chats")
            .addSnapshotListener { snap, _ ->
                val list = (snap?.documents?.map { it.data.orEmpty() + mapOf("id" to it.id) } ?: emptyList())
                    .sortedByDescending { (it["lastTimestamp"] as? Number)?.toLong() ?: 0L }
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    /** Contacts + alert history for one citizen (used when an officer expands a profile card). */
    fun contactsOnce(uid: String): Flow<List<EmergencyContact>> = contactsFlow(uid)
    fun alertsOnce(uid: String): Flow<List<AlertRecord>> = alertsFlow(uid)

    suspend fun dispatchEmergency(emergencyId: String) {
        db.collection("emergencies").document(emergencyId).update("status", "dispatched").await()
    }
}
