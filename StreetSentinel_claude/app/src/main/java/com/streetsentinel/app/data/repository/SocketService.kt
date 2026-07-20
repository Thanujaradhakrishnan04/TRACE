package com.streetsentinel.app.data.repository

import com.streetsentinel.app.BuildConfig
import com.streetsentinel.app.data.model.ChatMessage
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import org.json.JSONObject

/**
 * Native equivalent of initSocket(user) / disconnectSocket() in useStore.js.
 * Uses the `io.socket:socket.io-client` Java library against the same backend
 * Socket.IO server (server/socket) — no backend changes required.
 */
class SocketService {
    private var socket: Socket? = null

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected

    private val _incomingMessages = MutableSharedFlow<ChatMessage>(extraBufferCapacity = 16)
    val incomingMessages: SharedFlow<ChatMessage> = _incomingMessages

    fun connect(idToken: String, activeEmergencyId: String?, role: String) {
        disconnect()
        val opts = IO.Options().apply {
            auth = mapOf("token" to idToken)
            transports = arrayOf("websocket", "polling")
        }
        socket = IO.socket(java.net.URI.create(BuildConfig.SOCKET_URL), opts).also { s ->
            s.on(Socket.EVENT_CONNECT) {
                _isConnected.value = true
                if (activeEmergencyId != null) {
                    s.emit("join_emergency_chat", JSONObject(mapOf("alertId" to activeEmergencyId, "role" to role)))
                }
            }
            s.on(Socket.EVENT_DISCONNECT) { _isConnected.value = false }
            s.on("receive_emergency_message") { args ->
                val json = args.getOrNull(0) as? JSONObject ?: return@on
                _incomingMessages.tryEmit(
                    ChatMessage(
                        senderId = json.optString("senderId"),
                        senderRole = json.optString("senderRole"),
                        text = json.optString("text"),
                        timestamp = json.optLong("timestamp"),
                        status = "sent"
                    )
                )
            }
            s.connect()
        }
    }

    fun sendEmergencyMessage(alertId: String, message: ChatMessage) {
        socket?.emit(
            "send_emergency_message",
            JSONObject(
                mapOf(
                    "alertId" to alertId,
                    "senderId" to message.senderId,
                    "senderRole" to message.senderRole,
                    "text" to message.text,
                    "timestamp" to message.timestamp
                )
            )
        )
    }

    fun joinRoom(alertId: String, role: String) {
        socket?.emit("join_emergency_chat", JSONObject(mapOf("alertId" to alertId, "role" to role)))
    }

    fun leaveRoom(alertId: String) {
        socket?.emit("leave_emergency_chat", JSONObject(mapOf("alertId" to alertId)))
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        _isConnected.value = false
    }
}
