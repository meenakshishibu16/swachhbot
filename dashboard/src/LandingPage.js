import React from 'react'
import './LandingPage.css'

const features = [
  {
    title: 'WhatsApp-first intake',
    text: 'Citizens can report a civic issue by sending a single photo and location through WhatsApp—no app install or portal login required.'
  },
  {
    title: 'Agentic follow-up',
    text: 'Vision, memory, decision, and execution agents work together to classify issues, recall prior failures, and escalate until resolution.'
  },
  {
    title: 'City-scale memory',
    text: 'Every public asset keeps a persistent history so the same pothole, drain, or streetlight does not get ignored repeatedly.'
  },
  {
    title: 'Role-based operations',
    text: 'Departments, councillors, and commissioners each view the complaints that matter to them through a live dashboard.'
  }
]

const workflow = [
  'Send a photo of the civic issue on WhatsApp',
  'SwachhBot classifies the problem and routes it to the right ward and department',
  'The system tracks progress, escalates automatically, and keeps the citizen updated',
  'The issue is resolved and verified through a simple confirmation step'
]

const whatsappUrl = 'https://wa.me/14155238886?text=join%20dark-comfortable'

export default function LandingPage({ onOpenDashboard }) {
  return (
    <div className="landing-page">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Autonomous civic grievance resolution</span>
          <h1>SwachhBot turns everyday civic complaints into a tracked, AI-managed resolution workflow.</h1>
          <p>
            SwachhBot is a WhatsApp-based agentic AI system for Indian cities that files,
            tracks, escalates, and verifies civic issues until they are genuinely fixed.
          </p>
          <div className="hero-actions">
            <a className="primary-btn" href={whatsappUrl} target="_blank" rel="noreferrer">
              Chat on WhatsApp
            </a>
            <button className="secondary-btn" onClick={onOpenDashboard}>
              Open dashboard
            </button>
          </div>
          <div className="hero-highlights">
            <div>
              <strong>One photo</strong>
              <span>to start a complaint</span>
            </div>
            <div>
              <strong>4 agents</strong>
              <span>working in parallel</span>
            </div>
            <div>
              <strong>No follow-up burden</strong>
              <span>for the citizen</span>
            </div>
          </div>
        </div>

        <div className="hero-panel">
          <div className="panel-badge">Powered by agentic AI</div>
          <h2>From a WhatsApp message to a city operations workflow</h2>
          <ul>
            <li>Vision agent detects the issue from the photo</li>
            <li>Memory agent checks whether the same location has failed before</li>
            <li>Decision agent recommends whether a patch or permanent fix is needed</li>
            <li>Execution agent files the complaint and escalates automatically</li>
          </ul>
        </div>
      </section>

      <section className="content-grid">
        <div className="feature-section">
          <h3>Why SwachhBot matters</h3>
          <div className="feature-list">
            {features.map((feature) => (
              <article key={feature.title} className="feature-card">
                <h4>{feature.title}</h4>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="workflow-section">
          <h3>How it works</h3>
          <ol>
            {workflow.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="mini-card">
            <p>
              SwachhBot is designed for Bengaluru-style civic operations, but it can be adapted
              to any city that needs smarter complaint resolution and accountability.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
