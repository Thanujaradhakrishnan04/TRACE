import { Network } from '@capacitor/network';

class P2PMeshService {
  constructor() {
    this.isOnline = true;
    this.meshActive = false;
    this.nearbyNodes = 0;
    this.listeners = [];
  }

  async init() {
    console.log('[P2P Mesh] Initializing zero-network scaffolding...');
    
    // Check initial status
    const status = await Network.getStatus();
    this.updateStatus(status.connected);

    // Listen for network changes
    Network.addListener('networkStatusChange', status => {
      console.log('[P2P Mesh] Network status changed:', status.connected ? 'Online' : 'Offline');
      this.updateStatus(status.connected);
    });
  }

  updateStatus(connected) {
    this.isOnline = connected;
    
    if (!connected) {
      this.activateMesh();
    } else {
      this.deactivateMesh();
    }
    
    this.notifyListeners();
  }

  activateMesh() {
    if (this.meshActive) return;
    this.meshActive = true;
    console.log('[P2P Mesh] Activating local Bluetooth LE / Wi-Fi Direct scanning...');
    
    // Simulate finding nodes in a true offline scenario
    this.nearbyNodes = Math.floor(Math.random() * 3) + 1; // 1 to 3 nodes found
    console.log(`[P2P Mesh] Connected to ${this.nearbyNodes} Guardian node(s).`);
  }

  deactivateMesh() {
    this.meshActive = false;
    this.nearbyNodes = 0;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback({ isOnline: this.isOnline, meshActive: this.meshActive, nearbyNodes: this.nearbyNodes });
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners() {
    const state = { isOnline: this.isOnline, meshActive: this.meshActive, nearbyNodes: this.nearbyNodes };
    this.listeners.forEach(cb => cb(state));
  }

  /**
   * Scaffolding for sending a message over the mesh when offline.
   */
  async broadcastEmergency(payload) {
    if (this.isOnline) {
      console.log('[P2P Mesh] Device online. Bypassing mesh.');
      return false;
    }
    
    console.log('[P2P Mesh] 🔵 Broadcasting packet over BLE/WiFi Direct:', payload);
    // In a real implementation, this would chunk the payload and send over WebRTC/Bluetooth.
    return true; 
  }
}

export const p2pMeshService = new P2PMeshService();
