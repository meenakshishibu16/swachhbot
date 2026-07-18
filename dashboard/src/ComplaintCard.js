import React, { useState } from 'react'
import { supabase } from './supabase'

const API_URL = 'https://swachhbot-production.up.railway.app'

export default function ComplaintCard({ complaint: c, user, onUpdate, statusColors, statusLabels, issueIcons }) {
  const [note, setNote] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [showPhoto, setShowPhoto] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  // Department — starts action and owns the lock
  const handleStartAction = async () => {
    setLoading(true)
    const res = await fetch(`${API_URL}/complaint/${c.ticket_id}/start-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ started_by: user.name, role: user.role })
    })
    const data = await res.json()
    if (data.error) setActionMessage(data.error)
    else onUpdate()
    setLoading(false)
  }

  // Councillor — directs department
  const handleDirectDepartment = async () => {
    setLoading(true)
    const res = await fetch(`${API_URL}/complaint/${c.ticket_id}/direct-department`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directed_by: user.name })
    })
    if (res.ok) {
      setActionMessage('Department has been directed to act immediately.')
      onUpdate()
    }
    setLoading(false)
  }

  // Commissioner — issues directive
  const handleIssueDirective = async () => {
    setLoading(true)
    const res = await fetch(`${API_URL}/complaint/${c.ticket_id}/issue-directive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directed_by: user.name })
    })
    if (res.ok) {
      setActionMessage('Formal directive issued to department and councillor.')
      onUpdate()
    }
    setLoading(false)
  }

  // Resolve — all roles but different labels
  const handleResolve = async () => {
    setLoading(true)
    let photoUrl = null

    if (photoFile) {
      const fileName = `${c.ticket_id}-resolved-${Date.now()}.jpg`
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

  // Department owns the lock always
  const deptIsActioning = c.action_started_at && c.status === 'action_started'

  // Button visibility per role
  const showStartAction = user.role === 'department' &&
    (c.status === 'filed' || c.status === 'reactivated' || c.status === 'action_incomplete') &&
    !deptIsActioning

  const showDirectDept = user.role === 'councillor' &&
    c.escalation_level >= 1 &&
    c.status !== 'resolved' &&
    c.status !== 'resolved_certified' &&
    c.status !== 'pending_citizen'

  const showIssueDirective = user.role === 'commissioner' &&
    c.status !== 'resolved' &&
    c.status !== 'resolved_certified' &&
    c.status !== 'pending_citizen'

  const showResolveButton = (
    c.status !== 'resolved' &&
    c.status !== 'resolved_certified' &&
    c.status !== 'pending_citizen'
  ) && (
    (user.role === 'department' && deptIsActioning) ||
    user.role === 'councillor' ||
    user.role === 'commissioner'
  )

  const resolveLabel = {
    department: '✅ Mark Resolved',
    councillor: '✅ Confirm Resolution',
    commissioner: '✅ Close Complaint'
  }

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
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
          {c.escalation_level > 0 && (
            <span style={{
              fontSize: '11px', padding: '3px 8px',
              background: '#FEF2F2', color: '#DC2626',
              borderRadius: '999px', fontWeight: '500'
            }}>
              ⚠️ Level {c.escalation_level}
            </span>
          )}
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
                width: '100%', maxHeight: '200px',
                objectFit: 'cover', borderRadius: '8px',
                border: '1px solid #E2E8F0'
              }}
              onError={e => { e.target.style.display = 'none' }}
            />
          )}
        </div>
      )}

      {/* Decision Agent output */}
      {c.decision_recommendation && (
        <div style={{
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: '8px', padding: '10px 12px', marginBottom: '12px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#1E40AF', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🧠 AI Decision
          </div>
          <div style={{ fontSize: '12px', color: '#1E3A8A', marginBottom: '4px' }}>
            <strong>Recommendation:</strong>{' '}
            {c.decision_recommendation === 'permanent_fix' ? '🔧 Permanent Fix' : '🩹 Patch Repair'}
          </div>
          {c.failure_probability !== null && c.failure_probability !== undefined && (
            <div style={{ fontSize: '12px', color: '#1E3A8A', marginBottom: '4px' }}>
              <strong>Failure probability:</strong>
              <span style={{
                marginLeft: '6px', padding: '1px 6px',
                background: c.failure_probability > 70 ? '#FEF2F2' : '#FFFBEB',
                color: c.failure_probability > 70 ? '#DC2626' : '#B45309',
                borderRadius: '4px', fontWeight: '600'
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

      {/* Complaint details */}
      <div style={{
        background: '#F8FAFC', borderRadius: '6px',
        padding: '10px 12px', marginBottom: '12px',
        fontSize: '12px', color: '#374151'
      }}>
        <div style={{ marginBottom: '4px' }}>📍 {c.ward}</div>
        <div style={{ marginBottom: '4px' }}>🕐 Filed: {new Date(c.filed_at).toLocaleString('en-IN')}</div>
        {c.action_started_at && (
          <div style={{ marginBottom: '4px', color: '#B45309' }}>
            ⚡ Action started: {new Date(c.action_started_at).toLocaleString('en-IN')}
          </div>
        )}
        {c.action_started_by && (
          <div style={{ marginBottom: '4px' }}>
            👤 Actioned by: <strong>{c.action_started_by}</strong>
          </div>
        )}
        {c.status === 'action_incomplete' && (
          <div style={{ color: '#DC2626', fontWeight: '500' }}>
            ⏱️ Action started but not resolved within SLA
          </div>
        )}
        {c.reactivated_count > 0 && (
          <div style={{ color: '#DC2626' }}>
            🔄 Reactivated {c.reactivated_count} times
          </div>
        )}
      </div>

      {/* Dept actioning indicator for councillor/commissioner */}
      {deptIsActioning && user.role !== 'department' && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FCD34D',
          borderRadius: '6px', padding: '8px 12px', marginBottom: '12px',
          fontSize: '12px', color: '#92400E'
        }}>
          ⚡ Department is currently working on this
        </div>
      )}

      {/* Action message feedback */}
      {actionMessage && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #BBF7D0',
          borderRadius: '6px', padding: '8px 12px', marginBottom: '12px',
          fontSize: '12px', color: '#15803D'
        }}>
          ✅ {actionMessage}
        </div>
      )}

      {/* Resolved info */}
      {c.resolved_note && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #BBF7D0',
          borderRadius: '6px', padding: '10px 12px', marginBottom: '12px',
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
                  width: '100%', maxHeight: '150px',
                  objectFit: 'cover', borderRadius: '6px',
                  border: '1px solid #BBF7D0'
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>

        {/* Department — Start Action */}
        {showStartAction && (
          <button onClick={handleStartAction} disabled={loading} style={{
            padding: '8px 16px', background: '#F59E0B',
            color: '#fff', border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontSize: '13px', fontWeight: '500'
          }}>
            ⚡ Start Action
          </button>
        )}

        {/* Councillor — Direct Department */}
        {showDirectDept && (
          <button onClick={handleDirectDepartment} disabled={loading} style={{
            padding: '8px 16px', background: '#7C3AED',
            color: '#fff', border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontSize: '13px', fontWeight: '500'
          }}>
            📢 Direct Department
          </button>
        )}

        {/* Commissioner — Issue Directive */}
        {showIssueDirective && (
          <button onClick={handleIssueDirective} disabled={loading} style={{
            padding: '8px 16px', background: '#DC2626',
            color: '#fff', border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontSize: '13px', fontWeight: '500'
          }}>
            📋 Issue Directive
          </button>
        )}

        {/* Resolve button — all roles */}
        {showResolveButton && !showResolveForm && (
          <button onClick={() => setShowResolveForm(true)} style={{
            padding: '8px 16px', background: '#10B981',
            color: '#fff', border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontSize: '13px', fontWeight: '500'
          }}>
            {resolveLabel[user.role] || '✅ Mark Resolved'}
          </button>
        )}
      </div>

        {/* Location button */}
        {c.lat && c.lng && (
        <div
            onClick={() => onViewOnMap && onViewOnMap(c)}
            style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: '#1E40AF',
            cursor: 'pointer',
            marginTop: '4px',
            padding: '3px 8px',
            background: '#EFF6FF',
            borderRadius: '4px',
            border: '1px solid #BFDBFE',
            width: 'fit-content'
            }}
        >
            🗺️ View on map
        </div>
        )}

      {/* Resolve form */}
      {showResolveForm && (
        <div style={{
          marginTop: '12px', padding: '14px',
          background: '#F8FAFC', border: '1px solid #E2E8F0',
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
              type="file" accept="image/*"
              onChange={e => setPhotoFile(e.target.files[0])}
              style={{ fontSize: '12px', color: '#374151' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
              {user.role === 'department' ? 'What was done' : user.role === 'councillor' ? 'Verification note' : 'Directive note'}
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={
                user.role === 'department'
                  ? 'Describe what was done to fix the issue...'
                  : user.role === 'councillor'
                  ? 'Confirm the issue has been resolved...'
                  : 'Issue formal closure directive...'
              }
              rows={3}
              style={{
                width: '100%', padding: '8px 10px',
                border: '1px solid #E2E8F0', borderRadius: '6px',
                fontSize: '13px', color: '#0F172A', background: '#fff',
                boxSizing: 'border-box', resize: 'vertical', outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleResolve} disabled={loading} style={{
              padding: '8px 18px', background: '#10B981',
              color: '#fff', border: 'none', borderRadius: '6px',
              cursor: 'pointer', fontSize: '13px', fontWeight: '500'
            }}>
              {loading ? 'Submitting...' : resolveLabel[user.role] || '✅ Submit'}
            </button>
            <button onClick={() => setShowResolveForm(false)} style={{
              padding: '8px 14px', background: '#fff',
              color: '#64748B', border: '1px solid #E2E8F0',
              borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}