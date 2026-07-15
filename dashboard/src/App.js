import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const API_URL = 'https://swachhbot-production.up.railway.app';

// Color codes for different statuses
const getColor = (status, escalation) => {
  if (status === 'resolved') return 'green';
  if (escalation >= 2) return 'red';
  if (escalation >= 1) return 'orange';
  return 'blue';
};

const getIcon = (status, escalation) => {
  const color = getColor(status, escalation);
  return L.divIcon({
    className: '',
    html: `<div style="
      background: ${color};
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 4px rgba(0,0,0,0.4)
    "></div>`,
    iconSize: [14, 14],
  });
};

function App() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchComplaints = async () => {
    try {
      const res = await axios.get(`${API_URL}/complaints`);
      setComplaints(res.data);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch complaints:', e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    // Refresh every 30 seconds
    const interval = setInterval(fetchComplaints, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'all'
    ? complaints
    : complaints.filter(c => c.status === filter);

  const stats = {
    total: complaints.length,
    filed: complaints.filter(c => c.status === 'filed').length,
    escalated: complaints.filter(c => c.escalation_level > 0).length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0a1e' }}>

      {/* Header */}
      <div style={{ background: '#1a1040', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #534AB7' }}>
        <div>
          <h1 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>🗑️ SwachhBot Dashboard</h1>
          <p style={{ color: '#9b97c9', margin: 0, fontSize: '12px' }}>Bengaluru Civic Grievance Monitor</p>
        </div>
        <button onClick={fetchComplaints} style={{ background: '#534AB7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '12px', padding: '12px 24px', background: '#1a1040' }}>
        {[
          { label: 'Total', value: stats.total, color: '#9b97c9' },
          { label: 'Active', value: stats.filed, color: '#4B9EF5' },
          { label: 'Escalated', value: stats.escalated, color: '#F5A623' },
          { label: 'Resolved', value: stats.resolved, color: '#4CAF50' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0f0a1e', border: '1px solid #534AB7', borderRadius: '8px', padding: '10px 20px', textAlign: 'center' }}>
            <div style={{ color: s.color, fontSize: '24px', fontWeight: 'bold' }}>{s.value}</div>
            <div style={{ color: '#9b97c9', fontSize: '12px' }}>{s.label}</div>
          </div>
        ))}

        {/* Filter buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {['all', 'filed', 'resolved'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? '#534AB7' : 'transparent',
              color: '#fff', border: '1px solid #534AB7',
              padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
              textTransform: 'capitalize'
            }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Map */}
        <div style={{ flex: 2 }}>
          <MapContainer
            center={[12.9716, 77.5946]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {filtered.map(c => (
              <Marker
                key={c.ticket_id}
                position={[c.lat || 12.9716, c.lng || 77.5946]}
                icon={getIcon(c.status, c.escalation_level)}
              >
                <Popup>
                  <div style={{ minWidth: '180px' }}>
                    <strong>#{c.ticket_id}</strong><br />
                    🔍 {c.issue_type?.toUpperCase()}<br />
                    📍 {c.ward}<br />
                    🏢 {c.department}<br />
                    📊 Status: <strong>{c.status}</strong><br />
                    ⚠️ Escalation: Level {c.escalation_level}<br />
                    🕐 {new Date(c.filed_at).toLocaleString('en-IN')}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Complaint feed */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#1a1040', borderLeft: '1px solid #534AB7' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #534AB7' }}>
            <h3 style={{ color: '#fff', margin: 0, fontSize: '14px' }}>Live Complaint Feed</h3>
          </div>

          {loading && <div style={{ color: '#9b97c9', padding: '20px', textAlign: 'center' }}>Loading...</div>}

          {filtered.length === 0 && !loading && (
            <div style={{ color: '#9b97c9', padding: '20px', textAlign: 'center' }}>
              No complaints yet.<br />Send a photo on WhatsApp to get started!
            </div>
          )}

          {filtered.map(c => (
            <div key={c.ticket_id} style={{
              padding: '12px 16px',
              borderBottom: '1px solid #2a2060',
              borderLeft: `3px solid ${c.status === 'resolved' ? '#4CAF50' : c.escalation_level > 0 ? '#F5A623' : '#534AB7'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>#{c.ticket_id}</span>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                  background: c.status === 'resolved' ? '#1a4a1a' : c.escalation_level > 0 ? '#4a3a1a' : '#1a1a4a',
                  color: c.status === 'resolved' ? '#4CAF50' : c.escalation_level > 0 ? '#F5A623' : '#9b97c9'
                }}>
                  {c.status === 'resolved' ? '✅ Resolved' : c.escalation_level >= 2 ? '🔴 L2 Escalated' : c.escalation_level >= 1 ? '🟠 L1 Escalated' : '🔵 Active'}
                </span>
              </div>
              <div style={{ color: '#9b97c9', fontSize: '12px' }}>
                {c.issue_type?.toUpperCase()} · {c.severity} severity
              </div>
              <div style={{ color: '#9b97c9', fontSize: '12px' }}>📍 {c.ward}</div>
              <div style={{ color: '#6b6799', fontSize: '11px', marginTop: '4px' }}>
                {new Date(c.filed_at).toLocaleString('en-IN')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ background: '#1a1040', padding: '8px 24px', borderTop: '1px solid #534AB7', display: 'flex', gap: '20px' }}>
        {[
          { color: 'blue', label: 'Active' },
          { color: 'orange', label: 'L1 Escalated' },
          { color: 'red', label: 'L2 Escalated' },
          { color: 'green', label: 'Resolved' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color }}></div>
            <span style={{ color: '#9b97c9', fontSize: '12px' }}>{l.label}</span>
          </div>
        ))}
        <span style={{ color: '#6b6799', fontSize: '12px', marginLeft: 'auto' }}>
          Auto-refreshes every 30 seconds
        </span>
      </div>

    </div>
  );
}

export default App;