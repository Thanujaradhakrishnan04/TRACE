package com.streetsentinel.app.services

import java.util.Calendar
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

enum class RiskLevel { SAFE, WARNING, HIGH_RISK, EMERGENCY }
data class RiskResult(val score: Double, val level: RiskLevel)

/** Direct port of hooks/useRiskEngine.js's calculateRisk() — combines geo/audio/time-of-day signals. */
object RiskEngine {
    fun calculateRisk(
        audioConfidence: Double = 0.0,
        dbSeverity: Double = 0.0,
        movementAnomaly: Double = 0.0,
        geoSafetyScore: Double = 50.0 // 0-100, 100 = safest
    ): RiskResult {
        val geoRisk = 1 - (geoSafetyScore / 100)
        val audioRisk = min((audioConfidence * 0.7) + (dbSeverity * 0.3), 1.0)
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val isNight = hour >= 22 || hour <= 5
        val timeRisk = if (isNight) 1.0 else 0.0

        val score = (geoRisk * 0.6) + (audioRisk * 0.25) + (timeRisk * 0.15)
        val finalScore = score.coerceIn(0.0, 1.0)

        val level = when {
            finalScore >= 0.85 -> RiskLevel.EMERGENCY
            finalScore >= 0.70 -> RiskLevel.HIGH_RISK
            finalScore >= 0.50 -> RiskLevel.WARNING
            else -> RiskLevel.SAFE
        }
        return RiskResult(finalScore, level)
    }
}

enum class SafetyLevel { VERY_SAFE, SAFE, MODERATE, HIGH_RISK }
data class NearbyZone(val lat: Double, val lng: Double, val type: String, val distanceMeters: Double, val name: String = "")
data class SafetyScoreResult(val score: Int, val level: SafetyLevel, val reasons: List<String>)

/**
 * Direct port of services/safetyScoreService.js's calculateLocationSafetyScore().
 * Consumes nearby amenities (from OverpassService) + landuse tags + hour-of-day.
 */
object SafetyScoreService {
    fun calculateLocationSafetyScore(
        nearbyZones: List<NearbyZone> = emptyList(),
        landuse: List<String> = emptyList(),
        hour: Int = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    ): SafetyScoreResult {
        var score = 100
        val reasons = mutableListOf<String>()

        val police = nearbyZones.filter { it.type == "police" }
        val closestPolice = police.minOfOrNull { it.distanceMeters } ?: Double.POSITIVE_INFINITY
        when {
            closestPolice <= 500 -> { score += 15; reasons.add("✓ Police Station ${formatDist(closestPolice)} away") }
            closestPolice <= 1000 -> { score += 10; reasons.add("✓ Police Station ${formatDist(closestPolice)} away") }
            closestPolice <= 2000 -> { score += 5; reasons.add("✓ Police Station ${formatDist(closestPolice)} away") }
            else -> reasons.add("⚠ No police station within 2 km")
        }

        val hospitals = nearbyZones.filter { it.type == "hospital" || it.type == "clinic" }
        val closestHospital = hospitals.minOfOrNull { it.distanceMeters } ?: Double.POSITIVE_INFINITY
        when {
            closestHospital <= 500 -> { score += 10; reasons.add("✓ Hospital ${formatDist(closestHospital)} away") }
            closestHospital <= 1000 -> { score += 7; reasons.add("✓ Hospital ${formatDist(closestHospital)} away") }
            closestHospital <= 2000 -> { score += 3; reasons.add("✓ Hospital ${formatDist(closestHospital)} away") }
            else -> reasons.add("⚠ No hospital within 2 km")
        }

        val closestPharmacy = nearbyZones.filter { it.type == "pharmacy" }.minOfOrNull { it.distanceMeters } ?: Double.POSITIVE_INFINITY
        if (closestPharmacy <= 500) { score += 5; reasons.add("✓ Pharmacy ${formatDist(closestPharmacy)} away") }

        val hasCommercial = landuse.any { it in listOf("commercial", "retail", "residential") }
        if (hasCommercial) { score += 10; reasons.add("✓ Active populated area") }

        if (landuse.contains("industrial")) { score -= 10; reasons.add("⚠ Industrial area") }

        val hasWilderness = landuse.any { it in listOf("forest", "farmland", "meadow", "scrub") }
        if (hasWilderness) { score -= 25; reasons.add("⚠ Forest / empty land nearby") }

        val totalNearby = nearbyZones.count { it.distanceMeters <= 2000 }
        if (totalNearby <= 1 && !hasCommercial) { score -= 20; reasons.add("⚠ Isolated area — few nearby facilities") }

        if (hour >= 22 || hour < 6) { score -= 10; reasons.add("⚠ Night time — reduced visibility") }

        score = score.coerceIn(0, 100)
        val level = when {
            score >= 90 -> SafetyLevel.VERY_SAFE
            score >= 70 -> SafetyLevel.SAFE
            score >= 50 -> SafetyLevel.MODERATE
            else -> SafetyLevel.HIGH_RISK
        }
        return SafetyScoreResult(score, level, reasons)
    }

    private fun formatDist(meters: Double): String =
        if (meters < 1000) "${meters.roundToInt()}m" else "%.1fkm".format(meters / 1000)
}
