package com.streetsentinel.app.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val SentinelLightColorScheme = lightColorScheme(
    primary = SentinelColors.PrimaryRed,
    onPrimary = SentinelColors.BgWhite,
    background = SentinelColors.BgLight,
    surface = SentinelColors.BgWhite,
    onBackground = SentinelColors.TextMain,
    onSurface = SentinelColors.TextMain,
    secondary = SentinelColors.Slate600,
    error = SentinelColors.Red600,
)

val SentinelTypography = Typography(
    headlineLarge = TextStyle(fontWeight = FontWeight.Black, fontSize = 28.sp),
    headlineMedium = TextStyle(fontWeight = FontWeight.Black, fontSize = 22.sp),
    titleLarge = TextStyle(fontWeight = FontWeight.Bold, fontSize = 18.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
    bodyLarge = TextStyle(fontWeight = FontWeight.Normal, fontSize = 15.sp),
    bodyMedium = TextStyle(fontWeight = FontWeight.Normal, fontSize = 13.sp),
    labelSmall = TextStyle(fontWeight = FontWeight.Bold, fontSize = 10.sp),
)

@Composable
fun StreetSentinelTheme(
    // The web app has no dark-mode toggle (only the unused legacy theme was dark),
    // so we force the light scheme regardless of system setting to match parity.
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = SentinelLightColorScheme,
        typography = SentinelTypography,
        content = content
    )
}
