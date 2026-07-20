package com.streetsentinel.app.ui.citizen

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import com.streetsentinel.app.theme.SentinelColors
import com.streetsentinel.app.viewmodel.SentinelViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

/** Port of pages/citizen/Profile.jsx */
@Composable
fun ProfileScreen(viewModel: SentinelViewModel, onLogout: () -> Unit) {
    val user by viewModel.currentUser.collectAsState()
    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight).padding(20.dp)) {
        Spacer(Modifier.height(12.dp))
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            if (user?.photoUrl?.isNotEmpty() == true) {
                AsyncProfileImage(
                    url = user!!.photoUrl,
                    modifier = Modifier.size(88.dp).background(SentinelColors.Red50, CircleShape).clip(CircleShape)
                )
            } else {
                Box(Modifier.size(88.dp).background(SentinelColors.Red50, CircleShape), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Person, contentDescription = null, tint = SentinelColors.PrimaryRed, modifier = Modifier.size(44.dp))
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(user?.name ?: "Citizen", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
            Text(user?.email ?: "", color = SentinelColors.Slate500, fontSize = 13.sp)
        }
        Spacer(Modifier.height(28.dp))
        ProfileField("Full Name", user?.name.orEmpty())
        ProfileField("Phone", user?.phone.orEmpty())
        ProfileField("Role", user?.role?.uppercase().orEmpty())
        Spacer(Modifier.height(28.dp))
        OutlinedButton(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = SentinelColors.PrimaryRed)
        ) {
            Icon(Icons.Filled.Logout, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Sign Out", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ProfileField(label: String, value: String) {
    Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)) {
        Column(Modifier.padding(14.dp)) {
            Text(label, fontSize = 11.sp, color = SentinelColors.Slate400, fontWeight = FontWeight.Bold)
            Text(value.ifBlank { "—" }, fontSize = 15.sp, color = SentinelColors.Slate800, fontWeight = FontWeight.Medium)
        }
    }
}

/** Port of pages/citizen/Settings.jsx */
@Composable
fun SettingsScreen(viewModel: SentinelViewModel) {
    val settings by viewModel.settings.collectAsState()
    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight).padding(20.dp)) {
        Text("Settings", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
        Spacer(Modifier.height(20.dp))
        SettingsToggle("Microphone Monitoring", "Detect distress via ambient audio", settings.mic) { viewModel.updateSettings(settings.copy(mic = it)) }
        SettingsToggle("GPS Tracking", "Share live location during alerts", settings.gps) { viewModel.updateSettings(settings.copy(gps = it)) }
        SettingsToggle("Push Notifications", "Receive alert & chat notifications", settings.notifications) { viewModel.updateSettings(settings.copy(notifications = it)) }
        SettingsToggle("Email Alerts", "Notify contacts via email", settings.emailAlerts) { viewModel.updateSettings(settings.copy(emailAlerts = it)) }
        SettingsToggle("WhatsApp Alerts", "Notify contacts via WhatsApp", settings.whatsappAlerts) { viewModel.updateSettings(settings.copy(whatsappAlerts = it)) }
    }
}

@Composable
private fun SettingsToggle(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.SemiBold, color = SentinelColors.Slate800, fontSize = 14.sp)
                Text(subtitle, fontSize = 11.sp, color = SentinelColors.Slate500)
            }
            Switch(checked = checked, onCheckedChange = onChange, colors = SwitchDefaults.colors(checkedTrackColor = SentinelColors.PrimaryRed))
        }
    }
}

@Composable
fun AsyncProfileImage(url: String, modifier: Modifier = Modifier) {
    var bitmap by remember { mutableStateOf<android.graphics.Bitmap?>(null) }
    LaunchedEffect(url) {
        withContext(Dispatchers.IO) {
            try {
                val client = okhttp3.OkHttpClient()
                val request = okhttp3.Request.Builder().url(url).build()
                val response = client.newCall(request).execute()
                val stream = response.body?.byteStream()
                if (stream != null) {
                    bitmap = android.graphics.BitmapFactory.decodeStream(stream)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
    if (bitmap != null) {
        androidx.compose.foundation.Image(
            bitmap = bitmap!!.asImageBitmap(),
            contentDescription = "Profile Picture",
            modifier = modifier,
            contentScale = ContentScale.Crop
        )
    } else {
        Box(modifier = modifier, contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Person, contentDescription = null, tint = SentinelColors.PrimaryRed, modifier = Modifier.fillMaxSize(0.5f))
        }
    }
}
