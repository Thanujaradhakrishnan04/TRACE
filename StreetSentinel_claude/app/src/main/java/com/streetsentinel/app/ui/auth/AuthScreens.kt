package com.streetsentinel.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streetsentinel.app.theme.SentinelColors
import kotlinx.coroutines.delay

/** Port of pages/auth/Splash.jsx — 3s auto-advance splash screen. */
@Composable
fun SplashScreen(onFinished: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(3000)
        onFinished()
    }
    Box(Modifier.fillMaxSize().background(SentinelColors.BgLight), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier.size(88.dp).background(SentinelColors.PrimaryRed, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Filled.NotificationImportant, contentDescription = null, tint = Color.White, modifier = Modifier.size(44.dp))
            }
            Spacer(Modifier.height(24.dp))
            Text("STREET", fontWeight = FontWeight.ExtraBold, fontSize = 34.sp, color = SentinelColors.Slate900)
            Text("SENTINEL", fontWeight = FontWeight.Light, fontSize = 34.sp, color = SentinelColors.PrimaryRed, letterSpacing = 4.sp)
            Spacer(Modifier.height(20.dp))
            Text("YOUR SAFETY. AMPLIFIED.", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = SentinelColors.Slate500, letterSpacing = 2.sp)
        }
    }
}

/** Port of pages/auth/Onboarding.jsx — swipeable feature intro, condensed to a single pager-style screen. */
@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    val slides = listOf(
        Triple(Icons.Filled.Shield, "AI Guardian", "Passive monitoring detects distress signals before you even press a button."),
        Triple(Icons.Filled.Navigation, "SafeWalk Routing", "Real-time safest-route guidance using live community risk data."),
        Triple(Icons.Filled.NotificationImportant, "One-Tap SOS", "Instantly alert contacts and dispatch with your exact live location.")
    )
    var index by remember { mutableStateOf(0) }
    Box(Modifier.fillMaxSize().background(SentinelColors.BgLight)) {
        Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            val (icon, title, desc) = slides[index]
            Box(Modifier.size(96.dp).background(SentinelColors.Red50, CircleShape), contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, tint = SentinelColors.PrimaryRed, modifier = Modifier.size(48.dp))
            }
            Spacer(Modifier.height(32.dp))
            Text(title, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
            Spacer(Modifier.height(12.dp))
            Text(desc, fontSize = 15.sp, color = SentinelColors.Slate500, textAlign = TextAlign.Center)
            Spacer(Modifier.height(40.dp))
            Row { slides.indices.forEach { i ->
                Box(
                    Modifier.padding(4.dp).size(if (i == index) 10.dp else 8.dp)
                        .background(if (i == index) SentinelColors.PrimaryRed else SentinelColors.Slate300, CircleShape)
                )
            } }
        }
        Button(
            onClick = { if (index < slides.lastIndex) index++ else onDone() },
            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(24.dp).height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.PrimaryRed),
            shape = RoundedCornerShape(16.dp)
        ) { Text(if (index < slides.lastIndex) "Next" else "Get Started", fontWeight = FontWeight.Bold) }
    }
}

/** Port of pages/auth/RoleSelection.jsx */
@Composable
fun RoleSelectionScreen(onRoleSelected: (role: String) -> Unit) {
    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(48.dp))
        Text("Select Access Level", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
        Text("Identify your network clearance.", color = SentinelColors.Slate500, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(40.dp))

        RoleCard(Icons.Filled.Person, "Citizen Protocol", "Public safety network & AI monitoring", SentinelColors.Slate100, SentinelColors.Slate600, SentinelColors.Slate800) { onRoleSelected("citizen") }
        Spacer(Modifier.height(16.dp))
        RoleCard(Icons.Filled.Shield, "Tactical Command", "Officer dispatch & real-time intercepts", SentinelColors.Red50, SentinelColors.PrimaryRed, SentinelColors.PrimaryRed) { onRoleSelected("police") }
        Spacer(Modifier.height(16.dp))
        RoleCard(Icons.Filled.Insights, "Overwatch", "Smart city analytics & system control", SentinelColors.Slate800, Color.White, SentinelColors.Slate800) { onRoleSelected("admin") }
    }
}

@Composable
private fun RoleCard(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String, iconBg: Color, iconTint: Color, titleColor: Color, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onClick() },
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(56.dp).background(iconBg, CircleShape), contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, tint = iconTint)
            }
            Spacer(Modifier.width(18.dp))
            Column {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = titleColor)
                Text(subtitle, fontSize = 13.sp, color = SentinelColors.Slate500)
            }
        }
    }
}

/** Port of pages/auth/AuthLanding.jsx — Login vs Signup chooser for the selected role. */
@Composable
fun AuthLandingScreen(role: String, onLogin: () -> Unit, onSignup: () -> Unit) {
    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Icon(Icons.Filled.Shield, contentDescription = null, tint = SentinelColors.PrimaryRed, modifier = Modifier.size(64.dp))
        Spacer(Modifier.height(16.dp))
        Text("Welcome to Street Sentinel", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
        Text("Signed in as: ${role.uppercase()}", color = SentinelColors.Slate500)
        Spacer(Modifier.height(32.dp))
        Button(onClick = onLogin, modifier = Modifier.fillMaxWidth().height(52.dp), colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.PrimaryRed), shape = RoundedCornerShape(16.dp)) {
            Text("Log In", fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = onSignup, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp)) {
            Text("Create Account", fontWeight = FontWeight.Bold)
        }
    }
}
