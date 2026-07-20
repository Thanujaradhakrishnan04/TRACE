import React, { createContext, useContext, useState, useEffect } from 'react';

const SimulationContext = createContext(null);

export const useSimulation = () => useContext(SimulationContext);

export const SimulationProvider = ({ children }) => {
  const [incidents, setIncidents] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [cityThreatLevel, setCityThreatLevel] = useState('Elevated');

  // Simulate real-time updates (removed mock generation for production)
  useEffect(() => {
    // In production, incidents and officers will come from real socket events.
    // For now, this is just a placeholder to keep the context structure intact.
  }, []);

  const triggerSOS = (location) => {
    const sosIncident = {
      id: `sos_${Date.now()}`,
      lat: location.lat,
      lng: location.lng,
      type: 'Manual SOS',
      confidence: 100,
      status: 'active',
      time: new Date().toISOString()
    };
    setIncidents(prev => [sosIncident, ...prev]);
  };

  const dispatchOfficer = (incidentId, officerId) => {
    setIncidents(prev => prev.map(inc => inc.id === incidentId ? { ...inc, status: 'dispatched' } : inc));
    setOfficers(prev => prev.map(off => off.id === officerId ? { ...off, status: 'Busy' } : off));
  };

  return (
    <SimulationContext.Provider value={{
      incidents,
      officers,
      cityThreatLevel,
      triggerSOS,
      dispatchOfficer
    }}>
      {children}
    </SimulationContext.Provider>
  );
};
