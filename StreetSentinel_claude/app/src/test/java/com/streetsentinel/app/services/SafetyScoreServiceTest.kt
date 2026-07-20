package com.streetsentinel.app.services

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Automated unit tests verifying the real-time baseline safety score calculations
 * and confirming zero-facility handling without synthetic mock fallbacks.
 */
class SafetyScoreServiceTest {

    @Test
    fun testSafetyScore_withPoliceWithin500m_addsHighBonus() {
        val zones = listOf(
            NearbyZone(lat = 13.0827, lng = 80.2707, type = "police", distanceMeters = 300.0)
        )
        val result = SafetyScoreService.calculateLocationSafetyScore(zones, emptyList(), hour = 12)
        assertTrue("Score should have police station bonus", result.reasons.any { it.contains("Police Station") && it.contains("away") })
        assertEquals(SafetyLevel.VERY_SAFE, result.level)
    }

    @Test
    fun testSafetyScore_noFacilities_returnsBaseScoreNoMock() {
        val zones = emptyList<NearbyZone>()
        val result = SafetyScoreService.calculateLocationSafetyScore(zones, emptyList(), hour = 12)
        assertTrue("Should report no police nearby within 2 km", result.reasons.any { it.contains("No police station within 2 km") })
        assertTrue("Should report no hospital nearby within 2 km", result.reasons.any { it.contains("No hospital within 2 km") })
        assertTrue("Should detect isolated area", result.reasons.any { it.contains("Isolated area") })
        assertEquals(SafetyLevel.SAFE, result.level)
    }

    @Test
    fun testSafetyScore_withMultipleFacilities() {
        val zones = listOf(
            NearbyZone(lat = 13.0827, lng = 80.2707, type = "police", distanceMeters = 800.0),
            NearbyZone(lat = 13.0827, lng = 80.2707, type = "hospital", distanceMeters = 400.0),
            NearbyZone(lat = 13.0827, lng = 80.2707, type = "pharmacy", distanceMeters = 200.0)
        )
        val result = SafetyScoreService.calculateLocationSafetyScore(zones, listOf("residential"), hour = 14)
        assertTrue("Should detect hospital within 500m", result.reasons.any { it.contains("Hospital") && it.contains("away") })
        assertTrue("Should detect pharmacy nearby", result.reasons.any { it.contains("Pharmacy") && it.contains("away") })
        assertEquals(SafetyLevel.VERY_SAFE, result.level)
    }
}
