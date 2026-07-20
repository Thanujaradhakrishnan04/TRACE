package com.streetsentinel.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streetsentinel.app.data.model.ChatMessage
import com.streetsentinel.app.theme.SentinelColors
import kotlinx.coroutines.flow.Flow
import java.text.SimpleDateFormat
import java.util.*

/**
 * Real Firestore-backed chat thread (one conversation per citizen). Used by both
 * CitizenChatScreen (citizen's own uid as conversationId) and the police chat thread view
 * (any citizen uid, selected from Tactical→Profiles or Dispatch→Chat with Citizen). This is
 * what makes messages actually flow between citizen and police — the earlier version only
 * held messages in local, per-screen memory that neither side could actually see.
 */
@Composable
fun ChatThread(
    conversationId: String,
    citizenName: String,
    messagesFlow: Flow<List<ChatMessage>>,
    myRole: String, // "citizen" or "police"
    onSend: (String) -> Unit,
    headerContent: @Composable (() -> Unit)? = null
) {
    val messages by messagesFlow.collectAsState(initial = emptyList())
    var draft by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight)) {
        headerContent?.invoke()

        if (messages.isEmpty()) {
            Column(Modifier.weight(1f).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Text("No messages yet", color = SentinelColors.Slate400, fontSize = 13.sp)
                Text("Say hello to start the conversation", color = SentinelColors.Slate300, fontSize = 11.sp)
            }
        } else {
            LazyColumn(state = listState, modifier = Modifier.weight(1f).padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(messages) { m ->
                    val mine = m.senderRole == myRole
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
                        Column(horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
                            Card(
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = if (mine) SentinelColors.PrimaryRed else Color.White)
                            ) {
                                Text(m.text, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp), color = if (mine) Color.White else SentinelColors.Slate800, fontSize = 13.sp)
                            }
                            Text(
                                SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(m.timestamp)),
                                fontSize = 9.sp, color = SentinelColors.Slate400, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }
        }

        Row(Modifier.fillMaxWidth().background(Color.White).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = draft, onValueChange = { draft = it }, modifier = Modifier.weight(1f),
                placeholder = { Text(if (myRole == "citizen") "Message dispatch..." else "Message $citizenName...") },
                shape = RoundedCornerShape(20.dp), singleLine = true
            )
            Spacer(Modifier.width(8.dp))
            IconButton(
                onClick = { if (draft.isNotBlank()) { onSend(draft); draft = "" } },
                modifier = Modifier.background(SentinelColors.PrimaryRed, androidx.compose.foundation.shape.CircleShape)
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send", tint = Color.White)
            }
        }
    }
}
