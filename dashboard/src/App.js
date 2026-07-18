import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import axios from 'axios'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase } from './supabase'
import Login from './Login'
import ComplaintCard from './ComplaintCard'
import { useMap } from 'react-leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
})

const API_URL = 'https://swachhbot-production.up.railway.app'

const STATUS_COLORS = {
  'filed': '#3B82F6',
  'action_started': '#F59E0B',
  'action_incomplete': '#EF4444', 
  'pending_citizen': '#8B5CF6',
  'resolved': '#10B981',
  'resolved_certified': '#059669',
  'reactivated': '#EF4444',
  'stuck': '#94A3B8'
}

const STATUS_LABELS = {
  'filed': 'Filed',
  'action_started': 'In Progress',
  'action_incomplete': 'Action Incomplete', 
  'pending_citizen': 'Awaiting Citizen',
  'resolved': 'Resolved',
  'resolved_certified': 'Certified ✓',
  'reactivated': 'Reactivated',
  'stuck': 'No Response ⚠️'
}

const ISSUE_ICONS = {
  'garbage': '🗑️',
  'pothole': '🚧',
  'streetlight': '💡',
  'drainage': '🌊',
  'other': '📋'
}

const highlightIcon = L.divIcon({
  className: '',
  html: `<div style="
    background: #EF4444;
    width: 20px; height: 20px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 8px rgba(239,68,68,0.6)
  "></div>`,
  iconSize: [20, 20]
})

const getIcon = (status) => L.divIcon({
  className: '',
  html: `<div style="
    background:${STATUS_COLORS[status] || '#3B82F6'};
    width:12px;height:12px;
    border-radius:50%;
    border:2px solid white;
    box-shadow:0 2px 4px rgba(0,0,0,0.3)
  "></div>`,
  iconSize: [12, 12]
})

function MapRecenter({ lat, lng, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], zoom)
    }
  }, [lat, lng, zoom, map])
  return null
}

export default function App() {
  const [user, setUser] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('list')
  const [filterStatus, setFilterStatus] = useState('all')
  const [highlightedComplaint, setHighlightedComplaint] = useState(null)

  const fetchComplaints = async () => {
    try {
      const res = await axios.get(`${API_URL}/complaints`)
      setComplaints(Array.isArray(res.data) ? res.data : [])
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

  const getFilteredComplaints = () => {
    if (!user) return []
    let filtered = complaints

    if (user.role === 'department') {
      // Department sees only their issue type at level 0
      // AND their complaints at any level (they do the work)
      filtered = filtered.filter(c => c.issue_type === user.department)
    } else if (user.role === 'councillor') {
      // Councillor sees complaints in their ward at level 1+
      filtered = filtered.filter(c =>
        c.ward === user.ward && c.escalation_level >= 1
      )
    } else if (user.role === 'commissioner') {
      // Commissioner sees all complaints at level 2+
      filtered = filtered.filter(c => c.escalation_level >= 2)
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(c => c.status === filterStatus)
    }

    return filtered
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const filtered = getFilteredComplaints()

  const stats = {
    total: getFilteredComplaints().length,
    active: getFilteredComplaints().filter(c => c.status === 'filed' || c.status === 'reactivated').length,
    inProgress: getFilteredComplaints().filter(c => c.status === 'action_started').length,
    resolved: getFilteredComplaints().filter(c => c.status === 'resolved' || c.status === 'resolved_certified').length,
  }

  if (!user) return <Login onLogin={setUser} />

  const roleLabel = {
    department: `${user.department?.toUpperCase()} Dept`,
    councillor: `Ward Councillor · ${user.ward}`,
    commissioner: 'Commissioner'
  }



  const handleViewOnMap = (complaint) => {
    setHighlightedComplaint(complaint)
    setActiveTab('map')  // switches to map view
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", height: '100vh', display: 'flex', flexDirection: 'column', background: '#F8FAFC' }}>

      {/* Header */}
      <div style={{
        background: '#FFFFFF',
        padding: '0 24px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px',
            background: '#1E40AF',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px'
          }}>🏙️</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#0F172A' }}>SwachhBot</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>BBMP Grievance Dashboard</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#0F172A' }}>{user.name}</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>{roleLabel[user.role]}</div>
          </div>
          <div style={{
            width: '32px', height: '32px',
            background: '#EFF6FF',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: '600', color: '#1E40AF'
          }}>
            {user.name.charAt(0)}
          </div>
          <button onClick={handleLogout} style={{
            padding: '6px 14px',
            background: 'transparent',
            color: '#64748B',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px'
          }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        background: '#FFFFFF',
        padding: '16px 24px',
        display: 'flex',
        gap: '16px',
        borderBottom: '1px solid #E2E8F0',
        alignItems: 'center'
      }}>
        {[
          { label: 'Total Complaints', value: stats.total, color: '#1E40AF', bg: '#EFF6FF' },
          { label: 'Active', value: stats.active, color: '#1E40AF', bg: '#EFF6FF' },
          { label: 'In Progress', value: stats.inProgress, color: '#B45309', bg: '#FFFBEB' },
          { label: 'Resolved', value: stats.resolved, color: '#065F46', bg: '#ECFDF5' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg,
            borderRadius: '8px',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '140px'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: s.color, opacity: 0.8 }}>{s.label}</div>
          </div>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding: '7px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#374151',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Status</option>
            <option value="filed">Filed</option>
            <option value="action_started">In Progress</option>
            <option value="pending_citizen">Awaiting Citizen</option>
            <option value="resolved">Resolved</option>
            <option value="resolved_certified">Certified</option>
            <option value="reactivated">Reactivated</option>
          </select>

          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: '6px', overflow: 'hidden' }}>
            {['list', 'map'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '7px 16px',
                background: activeTab === tab ? '#1E40AF' : '#fff',
                color: activeTab === tab ? '#fff' : '#374151',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab ? '500' : '400'
              }}>
                {tab === 'list' ? '☰ List' : '🗺 Map'}
              </button>
            ))}
          </div>

          <button onClick={fetchComplaints} style={{
            padding: '7px 14px',
            background: '#1E40AF',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px'
          }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* List view */}
        {activeTab === 'list' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

            {loading && (
              <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
                Loading complaints...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '60px',
                background: '#fff', borderRadius: '12px',
                border: '1px solid #E2E8F0'
              }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#0F172A' }}>
                  No complaints in your queue
                </div>
                <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                  All issues have been addressed
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {filtered.map(c => (
                <ComplaintCard
                  key={c.ticket_id}
                  complaint={c}
                  user={user}
                  onUpdate={fetchComplaints}
                  onViewOnMap={handleViewOnMap}
                  statusColors={STATUS_COLORS}
                  statusLabels={STATUS_LABELS}
                  issueIcons={ISSUE_ICONS}
                />
              ))}
            </div>
          </div>
        )}

        {/* Map view */}
        {activeTab === 'map' && (
          <div style={{ flex: 1 }}>
            <MapContainer
              center={
                highlightedComplaint
                  ? [highlightedComplaint.lat, highlightedComplaint.lng]
                  : [12.9716, 77.5946]
              }
              zoom={highlightedComplaint ? 15 : 12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              {/* ADD THIS HERE */}
              {highlightedComplaint && (
                <MapRecenter
                  lat={highlightedComplaint.lat}
                  lng={highlightedComplaint.lng}
                  zoom={15}
                />
              )}

              {filtered.map(c => (
                <Marker
                  key={c.ticket_id}
                  position={[c.lat || 12.9716, c.lng || 77.5946]}
                  icon={
                    highlightedComplaint?.ticket_id === c.ticket_id
                      ? highlightIcon
                      : getIcon(c.status)
                  }
                >
                  <Popup>
                    <div style={{ minWidth: '180px', fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
                      <div style={{ fontWeight: '600', marginBottom: '6px', color: '#0F172A' }}>
                        {ISSUE_ICONS[c.issue_type]} #{c.ticket_id}
                      </div>
                      <div style={{ color: '#374151', marginBottom: '3px' }}>
                        <strong>Issue:</strong> {c.issue_type?.toUpperCase()} · {c.severity}
                      </div>
                      <div style={{ color: '#374151', marginBottom: '3px' }}>
                        <strong>Ward:</strong> {c.ward}
                      </div>
                      <div style={{ color: '#374151', marginBottom: '3px' }}>
                        <strong>Dept:</strong> {c.department}
                      </div>
                      <div style={{ color: '#374151', marginBottom: '6px' }}>
                        <strong>Filed:</strong> {new Date(c.filed_at).toLocaleDateString('en-IN')}
                      </div>
                      <div style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: (STATUS_COLORS[c.status] || '#3B82F6') + '20',
                        color: STATUS_COLORS[c.status] || '#3B82F6',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        {STATUS_LABELS[c.status]}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
      </div>

      {/* Footer / Legend */}
      <div style={{
        background: '#FFFFFF',
        padding: '10px 24px',
        borderTop: '1px solid #E2E8F0',
        display: 'flex',
        gap: '20px',
        alignItems: 'center'
      }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ color: '#64748B', fontSize: '11px' }}>
              {STATUS_LABELS[status]}
            </span>
          </div>
        ))}
        <span style={{ color: '#CBD5E1', fontSize: '11px', marginLeft: 'auto' }}>
          Auto-refreshes every 30s
        </span>
      </div>
    </div>
  )
}