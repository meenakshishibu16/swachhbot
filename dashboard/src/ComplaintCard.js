import React, { useState } from 'react'
import { supabase } from './supabase'

const API_URL = 'https://swachhbot-production.up.railway.app'

export default function ComplaintCard({ complaint, user, onUpdate }) {
  const [note, setNote] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showResolveForm, setShowResolveForm] = useState(false)

  const handleStartAction = async () => {
    setLoading(true)
    const res = await fetch(`${API_URL}/complaint/${complaint.ticket_id}/start-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ started_by: user.name })
    })
    if (res.ok) onUpdate()
    setLoading(false)
  }

  const handleResolve = async () => {
    setLoading(true)
    let photoUrl = null

    // Upload photo to Supabase Storage
    if (photoFile) {
      const fileName = `${complaint.ticket_id}-${Date.now()}.jpg`
      const { data } = await supabase.storage
        .from('resolved-photos')
        .upload(fileName, photoFile, { upsert: true })

      if (data) {
        const { data: urlData } = supabase.storage
          .from('resolved-photos')
          .getPublicUrl(fileName)
        photoUrl = urlData.publicUrl
      }
    }

    const res = await fetch(`${API_URL}/complaint/${complaint.ticket_id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolved_by: user.name,
        resolved_note: note,
        resolved_photo_url: photoUrl
      })
    })
    if (res.ok) {
      setShowResolveForm(false)
      onUpdate()
    }
    setLoading(false)
  }

  const statusColor = {
    'filed': '#534AB7',
    'action_started': '#F5A623',
    'pending_citizen': '#4B9EF5',
    'resolved': '#4CAF50',
    'resolved_certified': '#2E7D32',
    'reactivated': '#ff6b6b'
  }

  const canStartAction = !complaint.action_started_at &&
    complaint.status === 'filed' ||
    complaint.status === 'reactivated'

  const canResolve = complaint.action_started_at &&
    complaint.status !== 'resolved' &&
    complaint.status !== 'resolved_certified' &&
    complaint.status !== 'pending_citizen'

  return (
    <div style={{
      background: '#0f0a1e',
      border: `1px solid ${statusColor[complaint.status] || '#534AB7'}`,
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
          #{complaint.ticket_id}
        </span>
        <span style={{
          fontSize: '11px',
          padding: '3px 10px',
          borderRadius: '999px',
          background: statusColor[complaint.status] + '33',
          color: statusColor[complaint.status]
        }}>
          {complaint.status?.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {/* Details */}
      <div style={{ color: '#9b97c9', fontSize: '12px', marginBottom: '12px' }}>
        <div>🔍 {complaint.issue_type?.toUpperCase()} · {complaint.severity} severity</div>
        <div>📍 {complaint.ward}</div>
        <div>🕐 Filed: {new Date(complaint.filed_at).toLocaleString('en-IN')}</div>
        {complaint.action_started_at && (
          <div>⚡ Action started: {new Date(complaint.action_started_at).toLocaleString('en-IN')}</div>
        )}
        {complaint.reactivated_count > 0 && (
          <div style={{ color: '#ff6b6b' }}>🔄 Reactivated {complaint.reactivated_count} times</div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {canStartAction && (
          <button
            onClick={handleStartAction}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: '#F5A623',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            ⚡ Start Action
          </button>
        )}

        {canResolve && !showResolveForm && (
          <button
            onClick={() => setShowResolveForm(true)}
            style={{
              padding: '8px 16px',
              background: '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            ✅ Mark Resolved
          </button>
        )}
      </div>

      {/* Resolve form */}
      {showResolveForm && (
        <div style={{ marginTop: '12px', padding: '12px', background: '#1a1040', borderRadius: '6px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ color: '#9b97c9', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Upload resolved photo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setPhotoFile(e.target.files[0])}
              style={{ color: '#9b97c9', fontSize: '12px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ color: '#9b97c9', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Add a note
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Describe what was done..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                background: '#0f0a1e',
                border: '1px solid #534AB7',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleResolve}
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: '#4CAF50',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {loading ? 'Submitting...' : 'Submit Resolution'}
            </button>
            <button
              onClick={() => setShowResolveForm(false)}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: '#9b97c9',
                border: '1px solid #534AB7',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}