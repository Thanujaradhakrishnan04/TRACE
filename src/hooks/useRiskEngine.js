import { useState, useCallback } from 'react';

export const useRiskEngine = () => {
  const [riskScore, setRiskScore] = useState(0);

  const calculateRisk = useCallback(({
    audioConfidence = 0,
    dbSeverity = 0,
    movementAnomaly = 0,
    geoSafetyScore = 50 // 0-100 from safetyScoreService, 100=Safe
  }) => {
    // 1. Geospatial Risk (0-1) — inverted safety score
    const geoRisk = 1 - (geoSafetyScore / 100);

    // 2. Audio Risk (0-1)
    const audioRisk = Math.min((audioConfidence * 0.7) + (dbSeverity * 0.3), 1);

    // 3. Time-of-day factor (0-1)
    const hour = new Date().getHours();
    const isNight = hour >= 22 || hour <= 5;
    const timeRisk = isNight ? 1.0 : 0.0;

    // Combined score: Geo 60%, Audio 25%, Time 15%
    const score = (geoRisk * 0.6) + (audioRisk * 0.25) + (timeRisk * 0.15);

    // Bound between 0 and 1
    const finalScore = Math.min(Math.max(score, 0), 1);
    setRiskScore(finalScore);

    // Determine level
    let level = 'SAFE';
    if (finalScore >= 0.85) level = 'EMERGENCY';
    else if (finalScore >= 0.70) level = 'HIGH_RISK';
    else if (finalScore >= 0.50) level = 'WARNING';

    return { score: finalScore, level };
  }, []);

  return { riskScore, calculateRisk };
};
