package com.streetsentinel.app.theme

import androidx.compose.ui.graphics.Color

/**
 * Ported directly from web `src/index.css` (`@theme` block) — this is the ACTIVE theme
 * of the web app (the dark neon tokens in styles/themes/dark.css exist in the repo but
 * are not imported anywhere and are unused, so they are intentionally not ported here).
 */
object SentinelColors {
    val PrimaryRed = Color(0xFFE11D48)
    val PrimaryRedHover = Color(0xFFBE123C)
    val BgWhite = Color(0xFFFFFFFF)
    val BgLight = Color(0xFFF8FAFC)
    val TextMain = Color(0xFF0F172A)
    val TextMuted = Color(0xFF64748B)

    // Tailwind slate scale used throughout layouts/components
    val Slate50 = Color(0xFFF8FAFC)
    val Slate100 = Color(0xFFF1F5F9)
    val Slate200 = Color(0xFFE2E8F0)
    val Slate300 = Color(0xFFCBD5E1)
    val Slate400 = Color(0xFF94A3B8)
    val Slate500 = Color(0xFF64748B)
    val Slate600 = Color(0xFF475569)
    val Slate700 = Color(0xFF334155)
    val Slate800 = Color(0xFF1E293B)
    val Slate900 = Color(0xFF0F172A)

    // Tailwind red scale (SOS / emergency)
    val Red50 = Color(0xFFFEF2F2)
    val Red100 = Color(0xFFFEE2E2)
    val Red300 = Color(0xFFFCA5A5)
    val Red400 = Color(0xFFF87171)
    val Red500 = Color(0xFFEF4444)
    val Red600 = Color(0xFFDC2626)
    val Red700 = Color(0xFFB91C1C)

    // Status colors used across dashboards (Alerts, SystemHealth, TacticalCommand)
    val Emerald500 = Color(0xFF10B981)
    
    val Amber500 = Color(0xFFF59E0B)
    
    val Blue500 = Color(0xFF3B82F6)
    val Blue600 = Color(0xFF2563EB)

    val ShadowAlert = Color(0x80E11D48) // rgba(225,29,72,0.5)
}
