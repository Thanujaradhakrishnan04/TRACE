package com.streetsentinel.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streetsentinel.app.theme.SentinelColors
import com.streetsentinel.app.viewmodel.SentinelViewModel
import kotlinx.coroutines.launch

private val fieldColors: TextFieldColors
    @Composable get() = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = SentinelColors.PrimaryRed,
        focusedLabelColor = SentinelColors.PrimaryRed,
        cursorColor = SentinelColors.PrimaryRed,
        unfocusedBorderColor = SentinelColors.Slate200,
        unfocusedLabelColor = SentinelColors.Slate400
    )

@Composable
private fun RoleBadge(role: String) {
    Surface(color = SentinelColors.Red50, shape = RoundedCornerShape(50)) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                when (role) { "police" -> Icons.Filled.LocalPolice; "admin" -> Icons.Filled.AdminPanelSettings; else -> Icons.Filled.Person },
                contentDescription = null, tint = SentinelColors.PrimaryRed, modifier = Modifier.size(14.dp)
            )
            Spacer(Modifier.width(6.dp))
            Text(role.uppercase() + " ACCESS", color = SentinelColors.PrimaryRed, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp)
        }
    }
}

@Composable
private fun AuthCard(content: @Composable ColumnScope.() -> Unit) {
    Box(
        Modifier.fillMaxSize()
            .background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(SentinelColors.Slate900, SentinelColors.Slate800)))
            .verticalScroll(rememberScrollState()),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(24.dp),
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
        ) {
            Column(Modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, content = content)
        }
    }
}

/** Port of pages/auth/Login.jsx — redesigned as a floating elevated card. */
@Composable
fun LoginScreen(role: String, viewModel: SentinelViewModel, onSuccess: () -> Unit, onSwitchToSignup: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AuthCard {
        Box(Modifier.size(64.dp).clip(CircleShape).background(SentinelColors.Red50), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Shield, contentDescription = null, tint = SentinelColors.PrimaryRed, modifier = Modifier.size(32.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text("Welcome Back", fontSize = 26.sp, fontWeight = FontWeight.Black, color = SentinelColors.Slate900)
        Text("Log in to continue to Street Sentinel", color = SentinelColors.Slate500, fontSize = 13.sp)
        Spacer(Modifier.height(14.dp))
        RoleBadge(role)
        Spacer(Modifier.height(28.dp))

        OutlinedTextField(
            value = email, onValueChange = { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, shape = RoundedCornerShape(14.dp), colors = fieldColors,
            leadingIcon = { Icon(Icons.Filled.Email, contentDescription = null, tint = SentinelColors.Slate400) }
        )
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it }, label = { Text("Password") }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, shape = RoundedCornerShape(14.dp), colors = fieldColors,
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            leadingIcon = { Icon(Icons.Filled.Lock, contentDescription = null, tint = SentinelColors.Slate400) },
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility, contentDescription = "Toggle password visibility", tint = SentinelColors.Slate400)
                }
            }
        )

        error?.let {
            Spacer(Modifier.height(12.dp))
            Surface(color = SentinelColors.Red50, shape = RoundedCornerShape(12.dp)) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.ErrorOutline, contentDescription = null, tint = SentinelColors.PrimaryRed, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(it, color = SentinelColors.Red600, fontSize = 12.sp)
                }
            }
        }

        Spacer(Modifier.height(22.dp))
        Button(
            onClick = {
                loading = true; error = null
                scope.launch {
                    val result = viewModel.login(email.trim(), password)
                    loading = false
                    result.onSuccess { onSuccess() }.onFailure { error = it.message ?: "Login failed" }
                }
            },
            enabled = !loading && email.isNotBlank() && password.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(54.dp),
            colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.PrimaryRed, disabledContainerColor = SentinelColors.Slate200),
            shape = RoundedCornerShape(16.dp),
            elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp)
        ) {
            if (loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
            else Text("Log In", fontWeight = FontWeight.Black, fontSize = 15.sp, letterSpacing = 0.5.sp)
        }
        Spacer(Modifier.height(18.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            Text("Don't have an account? ", color = SentinelColors.Slate500, fontSize = 13.sp)
            Text(
                "Sign up", color = SentinelColors.PrimaryRed, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.clickable(onClick = onSwitchToSignup)
            )
        }
    }
}

/** Port of pages/auth/Signup.jsx — redesigned as a floating elevated card. */
@Composable
fun SignupScreen(role: String, viewModel: SentinelViewModel, onSuccess: () -> Unit, onSwitchToLogin: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AuthCard {
        Box(Modifier.size(64.dp).clip(CircleShape).background(SentinelColors.Red50), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.PersonAddAlt, contentDescription = null, tint = SentinelColors.PrimaryRed, modifier = Modifier.size(30.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text("Create Account", fontSize = 26.sp, fontWeight = FontWeight.Black, color = SentinelColors.Slate900)
        Text("Join the Street Sentinel safety network", color = SentinelColors.Slate500, fontSize = 13.sp)
        Spacer(Modifier.height(14.dp))
        RoleBadge(role)
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = name, onValueChange = { name = it }, label = { Text("Full Name") }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, shape = RoundedCornerShape(14.dp), colors = fieldColors,
            leadingIcon = { Icon(Icons.Filled.Person, contentDescription = null, tint = SentinelColors.Slate400) }
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = email, onValueChange = { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, shape = RoundedCornerShape(14.dp), colors = fieldColors,
            leadingIcon = { Icon(Icons.Filled.Email, contentDescription = null, tint = SentinelColors.Slate400) }
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, shape = RoundedCornerShape(14.dp), colors = fieldColors,
            leadingIcon = { Icon(Icons.Filled.Call, contentDescription = null, tint = SentinelColors.Slate400) }
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it }, label = { Text("Password") }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, shape = RoundedCornerShape(14.dp), colors = fieldColors,
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            leadingIcon = { Icon(Icons.Filled.Lock, contentDescription = null, tint = SentinelColors.Slate400) },
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility, contentDescription = "Toggle password visibility", tint = SentinelColors.Slate400)
                }
            }
        )

        error?.let {
            Spacer(Modifier.height(12.dp))
            Surface(color = SentinelColors.Red50, shape = RoundedCornerShape(12.dp)) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.ErrorOutline, contentDescription = null, tint = SentinelColors.PrimaryRed, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(it, color = SentinelColors.Red600, fontSize = 12.sp)
                }
            }
        }

        Spacer(Modifier.height(20.dp))
        Button(
            onClick = {
                loading = true; error = null
                scope.launch {
                    val result = viewModel.signup(email.trim(), password)
                    result.onSuccess { firebaseUser ->
                        viewModel.completeSignupProfile(
                            firebaseUser.uid,
                            mapOf("name" to name, "phone" to phone, "role" to role, "email" to email)
                        )
                        loading = false
                        onSuccess()
                    }.onFailure { loading = false; error = it.message ?: "Signup failed" }
                }
            },
            enabled = !loading && email.isNotBlank() && password.isNotBlank() && name.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(54.dp),
            colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.PrimaryRed, disabledContainerColor = SentinelColors.Slate200),
            shape = RoundedCornerShape(16.dp),
            elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp)
        ) {
            if (loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
            else Text("Create Account", fontWeight = FontWeight.Black, fontSize = 15.sp, letterSpacing = 0.5.sp)
        }
        Spacer(Modifier.height(18.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            Text("Already have an account? ", color = SentinelColors.Slate500, fontSize = 13.sp)
            Text(
                "Log in", color = SentinelColors.PrimaryRed, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.clickable(onClick = onSwitchToLogin)
            )
        }
    }
}
