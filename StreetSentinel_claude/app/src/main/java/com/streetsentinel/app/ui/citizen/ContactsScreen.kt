package com.streetsentinel.app.ui.citizen

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streetsentinel.app.data.model.EmergencyContact
import com.streetsentinel.app.theme.SentinelColors
import com.streetsentinel.app.viewmodel.SentinelViewModel

/** Port of pages/citizen/Contacts.jsx */
@Composable
fun ContactsScreen(viewModel: SentinelViewModel) {
    val contacts by viewModel.contacts.collectAsState()
    val context = LocalContext.current
    var showAddDialog by remember { mutableStateOf(false) }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }, containerColor = SentinelColors.PrimaryRed) {
                Icon(Icons.Filled.Add, contentDescription = "Add contact", tint = Color.White)
            }
        },
        containerColor = SentinelColors.BgLight
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Column(Modifier.padding(20.dp)) {
                Text("Emergency Contacts", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
                Text("${contacts.size} contacts saved", color = SentinelColors.Slate500, fontSize = 13.sp)
            }
            val missingEmailCount = contacts.count { it.email.isBlank() }
            if (missingEmailCount > 0) {
                Card(
                    shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = SentinelColors.Amber500.copy(alpha = 0.12f)),
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp)
                ) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Warning, contentDescription = null, tint = SentinelColors.Amber500, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "$missingEmailCount contact${if (missingEmailCount > 1) "s" else ""} missing an email — they won't receive SOS email alerts. Delete and re-add with an email.",
                            fontSize = 11.sp, color = SentinelColors.Amber500, fontWeight = FontWeight.SemiBold
                        )
                    }
                }
                Spacer(Modifier.height(4.dp))
            }
            LazyColumn(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(contacts) { c ->
                    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(44.dp).background(SentinelColors.Red50, CircleShape), contentAlignment = Alignment.Center) {
                                Text(c.name.take(1), color = SentinelColors.PrimaryRed, fontWeight = FontWeight.Black)
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(c.name, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
                                Text(c.relation, fontSize = 12.sp, color = SentinelColors.Slate500)
                                if (c.email.isNotBlank()) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Filled.Email, contentDescription = null, tint = Color(0xFFA855F7), modifier = Modifier.size(12.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text(c.email, fontSize = 11.sp, color = SentinelColors.Slate500)
                                    }
                                }
                            }
                            IconButton(onClick = { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${c.phone}"))) }) {
                                Icon(Icons.Filled.Call, contentDescription = "Call", tint = SentinelColors.Emerald500)
                            }
                            IconButton(onClick = { viewModel.deleteContact(c.id) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Delete", tint = SentinelColors.PrimaryRed)
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }

    if (showAddDialog) {
        AddContactDialog(onDismiss = { showAddDialog = false }, onSave = { name, phone, email, relation ->
            viewModel.addContact(EmergencyContact(name = name, phone = phone, email = email, relation = relation))
            showAddDialog = false
        })
    }
}

@Composable
private fun AddContactDialog(onDismiss: () -> Unit, onSave: (String, String, String, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var relation by remember { mutableStateOf("") }
    val emailValid = android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()
    val canSave = name.isNotBlank() && phone.isNotBlank() && emailValid

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Emergency Contact") },
        text = {
            Column {
                Text(
                    "Email is required — this is where SOS location alerts are sent when this contact is notified.",
                    fontSize = 11.sp, color = SentinelColors.Slate500
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Full Name *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone Number *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = email, onValueChange = { email = it }, label = { Text("Email Address *") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    isError = email.isNotBlank() && !emailValid,
                    supportingText = { if (email.isNotBlank() && !emailValid) Text("Enter a valid email address", color = SentinelColors.PrimaryRed) }
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(value = relation, onValueChange = { relation = it }, label = { Text("Relation") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = { TextButton(onClick = { if (canSave) onSave(name, phone, email, relation) }, enabled = canSave) { Text("Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
