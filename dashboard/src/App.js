import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import axios from 'axios'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase } from './supabase'
import Login from './Login'
import ComplaintCard from './ComplaintCard'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
})

const API_URL = 'https://swachhbot-production.up.railway.app'

const STATUS_COLORS = {
  'filed': '#534AB7',
  'action_started': '#F5A623',
  'pending_citizen': '#4B9EF5',
  'resolved': '#4CAF50',
  'resolved_certified': '#2E7D32',
  'reactivated': '#ff6b6b'
}

const getIcon = (status) => L.divIcon({
  className: '',
  html: `<div style="background:${STATUS_COLORS[status] || '#534AB7'};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [14, 14]
})

export default function App() {
  const [user, setUser] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('list')

  const fetchComplaints = async () => {
    try {
      const res = await axios.get(`${API_URL}/complaints`)
      setComplaints(res.data)
      setLoading(false)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchComplaints()
      const interval = setInterval(fetchComplaints, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  // Filter complaints based on role
  const getFilteredComplaints = () => {
    if (!user) return []
    if (user.role === 'department') {
      return complaints.filter(c => c.issue_type === user.department)
    }
    if (user.role === 'councillor') {
      return complaints.filter(c =>
        c.ward === user.ward && c.escalation_level >= 1
      )
    }
    if (user.role === 'commissioner') {
      return complaints.filter(c => c.escalation_level >= 2)
    }
    return complaints
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const filtered = getFilteredComplaints()

  const stats = {
    total: filtered.length,
    active: filtered.filter(c => c.status === 'filed' || c.status === 'reactivated').length,
    inProgress: filtered.filter(c => c.status === 'action_started').length,
    resolved: filtered.filter(c => c.status === 'resolved' || c.status === 'resolved_certified').length,
  }

  if (!user) return <Login onLogin={setUser} />

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0a1e' }}>

      {/* Header */}
      <div style={{ background: '#1a1040', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #534AB7' }}>
        <div>
          <h1 style={{ color: '#fff', margin: 0, fontSize: '18px' }}>🗑️ SwachhBot — BBMP Dashboard</h1>
          <p style={{ color: '#9b97c9', margin: 0, fontSize: '12px' }}>
            Logged in as <strong style={{ color: '#F5A623' }}>{user.name}</strong> ·
            Role: <strong style={{ color: '#534AB7' }}>{user.role.toUpperCase()}</strong>
            {user.department && ` · ${user.department.toUpperCase()}`}
            {user.ward && ` · ${user.ward}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchComplaints} style={{ background: '#534AB7', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            🔄 Refresh
          </button>
          <button onClick={handleLogout} style={{ background: 'transparent', color: '#9b97c9', border: '1px solid #534AB7', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            Logout
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px', padding: '12px 24px', background: '#1a1040', borderBottom: '1px solid #2a2060' }}>
        {[
          { label: 'Total', value: stats.total, color: '#9b97c9' },
          { label: 'Active', value: stats.active, color: '#534AB7' },
          { label: 'In Progress', value: stats.inProgress, color: '#F5A623' },
          { label: 'Resolved', value: stats.resolved, color: '#4CAF50' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0f0a1e', border: '1px solid #2a2060', borderRadius: '8px', padding: '10px 20px', textAlign: 'center', minWidth: '80px' }}>
            <div style={{ color: s.color, fontSize: '22px', fontWeight: 'bold' }}>{s.value}</div>
            <div style={{ color: '#6b6799', fontSize: '11px' }}>{s.label}</div>
          </div>
        ))}

        {/* Tabs */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {['list', 'map'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: activeTab === tab ? '#534AB7' : 'transparent',
              color: '#fff', border: '1px solid #534AB7',
              padding: '6px 16px', borderRadius: '6px', cursor: 'pointer',
              textTransform: 'capitalize', fontSize: '13px'
            }}>
              {tab === 'list' ? '📋 List' : '🗺️ Map'}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* List view */}
        {activeTab === 'list' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {loading && <p style={{ color: '#9b97c9', textAlign: 'center' }}>Loading...</p>}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9b97c9', marginTop: '60px' }}>
                <p style={{ fontSize: '32px' }}>✅</p>
                <p>No complaints in your queue right now.</p>
              </div>
            )}
            {filtered.map(c => (
              <ComplaintCard
                key={c.ticket_id}
                complaint={c}
                user={user}
                onUpdate={fetchComplaints}
              />
            ))}
          </div>
        )}

        {/* Map view */}
        {activeTab === 'map' && (
          <div style={{ flex: 1 }}>
            <MapContainer center={[12.9716, 77.5946]} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {filtered.map(c => (
                <Marker
                  key={c.ticket_id}
                  position={[c.lat || 12.9716, c.lng || 77.5946]}
                  icon={getIcon(c.status)}
                >
                  <Popup>
                    <strong>#{c.ticket_id}</strong><br />
                    {c.issue_type?.toUpperCase()} · {c.severity}<br />
                    {c.ward}<br />
                    Status: {c.status}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ background: '#1a1040', padding: '8px 24px', borderTop: '1px solid #534AB7', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
            <span style={{ color: '#9b97c9', fontSize: '11px', textTransform: 'capitalize' }}>
              {status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}