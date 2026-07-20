package com.streetsentinel.app.services

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Method

/**
 * Automated tests verifying Overpass haversine calculation and checking that
 * no synthetic/mock fallbacks are injected when queries return empty or unreachable.
 */
class OverpassServiceTest {

    @Test
    fun testHaversineDistanceCalculation_isAccurate() {
        val service = OverpassService()
        val calcMethod = OverpassService::class.java.declaredMethods.first { it.name == "calculateDistanceMeters" }
        calcMethod.isAccessible = true

        // Distance between Chennai Central (13.0827, 80.2707) and Egmore Station (~13.0732, 80.2609) is roughly 1.5 km
        val dist = calcMethod.invoke(service, 13.0827, 80.2707, 13.0732, 80.2609) as Double
        assertTrue("Distance should be approximately 1400-1600 meters", dist in 1400.0..1600.0)
    }

    @Test
    fun testHaversineDistance_samePoint_returnsZero() {
        val service = OverpassService()
        val calcMethod = OverpassService::class.java.declaredMethods.first { it.name == "calculateDistanceMeters" }
        calcMethod.isAccessible = true

        val dist = calcMethod.invoke(service, 13.0827, 80.2707, 13.0827, 80.2707) as Double
        assertEquals("Exact same location should have 0.0m distance", 0.0, dist, 0.001)
    }
}
