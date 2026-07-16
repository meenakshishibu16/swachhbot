import React, { useState } from 'react'
import { supabase } from './supabase'

const API_URL = 'https://swachhbot-production.up.railway.app'

export default function ComplaintCard({ complaint: c, user, onUpdate, statusColors, statusLabels, issueIcons }) {
  const [note, setNote] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [showPhoto, setShowPhoto] = useState(false)

  const handleStartAction = async () => {
    setLoading(true)
    const res = await fetch(`${API_URL}/complaint/${c.ticket_id}/start-action`, {
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

    if (photoFile) {
      const fileName = `${c.ticket_id}-${Date.now()}.jpg`
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

    const res = await fetch(`${API_URL}/complaint/${c.ticket_id}/resolve`, {
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

  const color = statusColors[c.status] || '#3B82F6'
  const canStartAction = (c.status === 'filed' || c.status === 'reactivated') && !c.action_started_at
  const canResolve = c.action_started_at &&
    c.status !== 'resolved' &&
    c.status !== 'resolved_certified' &&
    c.status !== 'pending_citizen'

  const severityColor = {
    high: { bg: '#FEF2F2', text: '#DC2626' },
    medium: { bg: '#FFFBEB', text: '#B45309' },
    low: { bg: '#F0FDF4', text: '#15803D' }
  }
  const sev = severityColor[c.severity] || severityColor.medium

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderTop: `3px solid ${color}`,
      borderRadius: '10px',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>
            {issueIcons[c.issue_type]} #{c.ticket_id}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            {c.issue_type?.toUpperCase()} · {c.department}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{
            fontSize: '11px', padding: '3px 8px',
            background: sev.bg, color: sev.text,
            borderRadius: '999px', fontWeight: '500'
          }}>
            {c.severity}
          </span>
          <span style={{
            fontSize: '11px', padding: '3px 8px',
            background: color + '15', color: color,
            borderRadius: '999px', fontWeight: '500'
          }}>
            {statusLabels[c.status]}
          </span>
        </div>
      </div>

      {/* Citizen photo */}
      {c.photo_url && (
        <div style={{ marginBottom: '12px' }}>
          <div
            onClick={() => setShowPhoto(!showPhoto)}
            style={{
              fontSize: '12px', fontWeight: '500',
              color: '#1E40AF', cursor: 'pointer',
              marginBottom: '6px',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            📸 Citizen photo {showPhoto ? '▲ Hide' : '▼ View'}
          </div>
          {showPhoto && (
            <img
              src={c.photo_url}
              alt="Citizen complaint"
              style={{
                width: '100%',
                maxHeight: '200px',
                objectFit: 'cover',
                borderRadius: '8px',
                border: '1px solid #E2E8F0'
              }}
              onError={e => {
                e.target.style.display = 'none'
              }}
            />
          )}
        </div>
      )}

      {/* Decision Agent output */}
      {c.decision_recommendation && (
        <div style={{
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '8px',
          padding: '10px 12px',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#1E40AF', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🧠 AI Decision
          </div>
          <div style={{ fontSize: '12px', color: '#1E3A8A', marginBottom: '4px' }}>
            <strong>Recommendation:</strong> {c.decision_recommendation === 'permanent_fix' ? '🔧 Permanent Fix' : '🩹 Patch Repair'}
          </div>
          {c.failure_probability && (
            <div style={{ fontSize: '12px', color: '#1E3A8A', marginBottom: '4px' }}>
              <strong>Failure probability:</strong>
              <span style={{
                marginLeft: '6px',
                padding: '1px 6px',
                background: c.failure_probability > 70 ? '#FEF2F2' : '#FFFBEB',
                color: c.failure_probability > 70 ? '#DC2626' : '#B45309',
                borderRadius: '4px',
                fontWeight: '600'
              }}>
                {c.failure_probability}%
              </span>
            </div>
          )}
          {c.decision_action && (
            <div style={{ fontSize: '12px', color: '#1E3A8A', marginBottom: '4px' }}>
              <strong>Action:</strong> {c.decision_action}
            </div>
          )}
          {c.decision_reasoning && (
            <div style={{ fontSize: '11px', color: '#3B82F6', marginTop: '6px', fontStyle: 'italic' }}>
              "{c.decision_reasoning}"
            </div>
          )}
        </div>
      )}

      {/* Details */}
      <div style={{
        background: '#F8FAFC',
        borderRadius: '6px',
        padding: '10px 12px',
        marginBottom: '12px',
        fontSize: '12px',
        color: '#374151'
      }}>
        <div style={{ marginBottom: '4px' }}>📍 {c.ward}</div>
        <div style={{ marginBottom: '4px' }}>🕐 Filed: {new Date(c.filed_at).toLocaleString('en-IN')}</div>
        {c.action_started_at && (
          <div style={{ marginBottom: '4px', color: '#B45309' }}>
            ⚡ Action started: {new Date(c.action_started_at).toLocaleString('en-IN')}
          </div>
        )}
        {c.action_started_by && (
          <div style={{ marginBottom: '4px' }}>👤 By: {c.action_started_by}</div>
        )}
        {c.escalation_level > 0 && (
          <div style={{ color: '#DC2626', fontWeight: '500' }}>
            ⚠️ Escalation Level {c.escalation_level}
          </div>
        )}
        {c.reactivated_count > 0 && (
          <div style={{ color: '#DC2626' }}>🔄 Reactivated {c.reactivated_count} times</div>
        )}
      </div>

      {/* Resolved info */}
      {c.resolved_note && (
        <div style={{
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '6px',
          padding: '10px 12px',
          marginBottom: '12px',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: '500', color: '#15803D', marginBottom: '4px' }}>
            ✅ Resolution note:
          </div>
          <div style={{ color: '#374151' }}>{c.resolved_note}</div>
          {c.resolved_by && (
            <div style={{ color: '#64748B', marginTop: '4px' }}>— {c.resolved_by}</div>
          )}
          {c.resolved_photo_url && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '11px', color: '#15803D', marginBottom: '4px' }}>
                📸 Resolved photo:
              </div>
              <img
                src={c.resolved_photo_url}
                alt="Resolved"
                style={{
                  width: '100%',
                  maxHeight: '150px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  border: '1px solid #BBF7D0'
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {canStartAction && (
          <button
            onClick={handleStartAction}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: '#F59E0B',
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
              background: '#10B981',
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
        <div style={{
          marginTop: '12px',
          padding: '14px',
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#0F172A', marginBottom: '12px' }}>
            Resolution Details
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
              Upload resolved photo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setPhotoFile(e.target.files[0])}
              style={{ fontSize: '12px', color: '#374151' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
              Resolution note
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Describe what was done to resolve the issue..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#0F172A',
                background: '#fff',
                boxSizing: 'border-box',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleResolve}
              disabled={loading}
              style={{
                padding: '8px 18px',
                background: '#10B981',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              {loading ? 'Submitting...' : 'Submit Resolution'}
            </button>
            <button
              onClick={() => setShowResolveForm(false)}
              style={{
                padding: '8px 14px',
                background: '#fff',
                color: '#64748B',
                border: '1px solid #E2E8F0',
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