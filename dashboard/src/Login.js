import React, { useState } from 'react'
import { supabase } from './supabase'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }

    const { data: userData, error: userError } = await supabase
      .from('department_users')
      .select('*')
      .eq('email', email)
      .single()

    if (userData) {
      onLogin(userData)
    } else {
      setError('User not found in system')
    }
    setLoading(false)
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8FAFC',
      fontFamily: "'Inter', -apple-system, sans-serif"
    }}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '16px',
        padding: '40px',
        width: '380px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: '#1E40AF',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px'
          }}>🏙️</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>SwachhBot</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>BBMP Official Dashboard</div>
          </div>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>
            Sign in
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Access your department's complaint queue
          </p>
        </div>

        <div style={{ height: '1px', background: '#F1F5F9', margin: '20px 0' }} />

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@bbmp.demo"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#0F172A',
              background: '#F8FAFC',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#0F172A',
              background: '#F8FAFC',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#DC2626'
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px',
            background: loading ? '#93C5FD' : '#1E40AF',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s'
          }}
        >
          {loading ? 'Signing in...' : 'Sign in →'}
        </button>

        {/* Demo credentials */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#F8FAFC',
          borderRadius: '8px',
          border: '1px solid #E2E8F0'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Demo credentials
          </div>
          {[
            { label: 'Solid Waste Dept', email: 'swm@bbmp.demo' },
            { label: 'Roads Dept', email: 'roads@bbmp.demo' },
            { label: 'Electrical Dept', email: 'electrical@bbmp.demo' },
            { label: 'Ward Councillor', email: 'councillor@bbmp.demo' },
            { label: 'Commissioner', email: 'commissioner@bbmp.demo' },
          ].map(c => (
            <div
              key={c.email}
              onClick={() => setEmail(c.email)}
              style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid #F1F5F9',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: '12px', color: '#374151' }}>{c.label}</span>
              <span style={{ fontSize: '12px', color: '#1E40AF', fontFamily: 'monospace' }}>{c.email}</span>
            </div>
          ))}
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>
            Password: Demo@1234 · Click email to autofill
          </div>
        </div>
      </div>
    </div>
  )
}