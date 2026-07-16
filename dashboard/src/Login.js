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

    // Get user role from department_users table
    const { data: userData } = await supabase
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
      background: '#0f0a1e'
    }}>
      <div style={{
        background: '#1a1040',
        border: '1px solid #534AB7',
        borderRadius: '12px',
        padding: '40px',
        width: '360px'
      }}>
        <h1 style={{ color: '#fff', margin: '0 0 8px', fontSize: '22px' }}>
          🗑️ SwachhBot
        </h1>
        <p style={{ color: '#9b97c9', margin: '0 0 32px', fontSize: '13px' }}>
          BBMP Official Dashboard
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: '#9b97c9', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@bbmp.demo"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#0f0a1e',
              border: '1px solid #534AB7',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ color: '#9b97c9', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
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
              background: '#0f0a1e',
              border: '1px solid #534AB7',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {error && (
          <p style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: loading ? '#3a3180' : '#534AB7',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '500'
          }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <div style={{ marginTop: '24px', padding: '12px', background: '#0f0a1e', borderRadius: '6px' }}>
          <p style={{ color: '#6b6799', fontSize: '11px', margin: '0 0 8px' }}>Demo credentials:</p>
          <p style={{ color: '#9b97c9', fontSize: '11px', margin: '2px 0' }}>swm@bbmp.demo / Demo@1234</p>
          <p style={{ color: '#9b97c9', fontSize: '11px', margin: '2px 0' }}>councillor@bbmp.demo / Demo@1234</p>
          <p style={{ color: '#9b97c9', fontSize: '11px', margin: '2px 0' }}>commissioner@bbmp.demo / Demo@1234</p>
        </div>
      </div>
    </div>
  )
}