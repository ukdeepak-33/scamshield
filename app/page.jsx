'use client'
import { useState } from 'react'
import TrustScore from '@/components/TrustScore'
import FlagList from '@/components/FlagList'
import CommunityReports from '@/components/CommunityReports'
import AuthorityGuide from '@/components/AuthorityGuide'

const SCAN_STEPS = [
  'Resolving domain...',
  'Checking WHOIS registry...',
  'Scanning blacklists...',
  'Running VirusTotal check...',
  'Analyzing with Google Safe Browsing...',
  'Checking hosting location...',
  'Running AI content analysis...',
  'Compiling trust score...',
]

export default function Home() {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState('idle') // idle | scanning | result | error
  const [scanStep, setScanStep] = useState('')
  const [result, setResult] = useState(null)
  const [activeTab, setActiveTab] = useState('flags')
  const [errorMsg, setErrorMsg] = useState('')
  const [showDebug, setShowDebug] = useState(false)

  const displayUrl = url.replace(/^https?:\/\//i, '')

  const handleScan = async () => {
    if (!url.trim()) return
    setPhase('scanning')
    setResult(null)
    setErrorMsg('')
    setShowDebug(false)

    let stepIdx = 0
    const stepInterval = setInterval(() => {
      setScanStep(SCAN_STEPS[stepIdx % SCAN_STEPS.length])
      stepIdx++
    }, 600)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      clearInterval(stepInterval)

      if (!res.ok) throw new Error(data.error || 'Scan failed')

      setResult(data)
      setPhase('result')
      setActiveTab('flags')
    } catch (err) {
      clearInterval(stepInterval)
      setErrorMsg(err.message)
      setPhase('error')
    }
  }

  const verdictColor = result
    ? result.verdict === 'safe' ? 'var(--green)'
    : result.verdict === 'suspicious' ? 'var(--yellow)'
    : 'var(--red)'
    : 'var(--muted)'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56, position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6,
            background: 'linear-gradient(135deg, var(--accent), #dc2626)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>🛡</div>
          <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
            SCAM<span style={{ color: 'var(--accent)' }}>SHIELD</span>
          </span>
        </div>
        <nav style={{ display: 'flex', gap: 24 }}>
          {['Reports', 'About'].map(item => (
            <span key={item} style={{
              fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)',
              cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
            }}>{item}</span>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px' }}>
        {phase === 'idle' && (
          <div className="fade-in" style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: 4, color: 'var(--accent)', marginBottom: 16 }}>
              ● LIVE SCAM DETECTION
            </div>
            <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 700, lineHeight: 1.1, marginBottom: 16 }}>
              Is this website<br />
              <span style={{ color: 'var(--accent)' }}>trying to scam you?</span>
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 16, maxWidth: 460, margin: '0 auto 32px', lineHeight: 1.6 }}>
              Paste any suspicious URL. We'll check it across security databases,
              analyze it with AI, and give you a trust verdict in seconds.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginBottom: 8 }}>
              {[['12+', 'Checks Run'], ['Free', 'Always'], ['AI-Powered', 'Analysis']].map(([v, l]) => (
                <div key={l}>
                  <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{
          background: 'var(--surface)',
          border: `1px solid ${phase === 'result' ? verdictColor + '55' : 'var(--border)'}`,
          borderRadius: 12, padding: 20, marginBottom: 28,
          transition: 'border-color 0.5s',
        }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)', letterSpacing: 2, marginBottom: 12 }}>
            ENTER WEBSITE URL TO VERIFY
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '0 14px',
            }}>
              <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: 12, flexShrink: 0 }}>https://</span>
              <input
                value={displayUrl}
                onChange={e => setUrl(e.target.value.replace(/^https?:\/\//i, ''))}
                onKeyDown={e => e.key === 'Enter' && handleScan()}
                placeholder="suspicious-site.com"
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--text)', fontSize: 15, fontFamily: 'monospace', padding: '13px 0',
                }}
              />
            </div>
            <button
              onClick={handleScan}
              disabled={phase === 'scanning'}
              style={{
                background: 'linear-gradient(135deg, var(--accent), #dc2626)',
                border: 'none', borderRadius: 8, padding: '0 24px',
                color: 'white', fontFamily: 'monospace', fontSize: 12,
                fontWeight: 700, letterSpacing: 2, cursor: phase === 'scanning' ? 'not-allowed' : 'pointer',
                opacity: phase === 'scanning' ? 0.7 : 1, whiteSpace: 'nowrap',
              }}>
              {phase === 'scanning' ? 'SCANNING...' : 'SCAN SITE →'}
            </button>
          </div>

          {phase === 'scanning' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
                  animation: 'pulse 0.8s ease-in-out infinite',
                }} />
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>{scanStep}</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 2, height: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent), #dc2626)',
                  animation: 'scan 8s linear forwards',
                  borderRadius: 2,
                }} />
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div style={{ marginTop: 12, color: 'var(--red)', fontFamily: 'monospace', fontSize: 12 }}>
              ⚠ {errorMsg}
            </div>
          )}
        </div>

        {phase === 'result' && result && (
          <div className="fade-in" style={{ display: 'grid', gap: 20 }}>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 24,
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'center',
            }}>
              <TrustScore score={result.trust_score ?? result.trustScore} verdict={result.verdict} />
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)', letterSpacing: 2, marginBottom: 6 }}>
                  SCANNED: {result.domain}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: verdictColor }}>
                  {result.verdict === 'safe' && '✅ This site looks legitimate'}
                  {result.verdict === 'suspicious' && '⚠️ This site has some red flags'}
                  {result.verdict === 'dangerous' && '🚨 High risk — likely a scam site'}
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <button
                    onClick={() => setActiveTab('report-authority')}
                    style={{
                      background: 'var(--red)', border: 'none', borderRadius: 6,
                      padding: '8px 16px', color: 'white', fontFamily: 'monospace',
                      fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: 'pointer',
                    }}>
                    🚨 REPORT THIS SITE
                  </button>
                  <button
                    onClick={() => { setUrl(''); setPhase('idle'); setShowDebug(false) }}
                    style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                      padding: '8px 16px', color: 'var(--muted)', fontFamily: 'monospace',
                      fontSize: 10, letterSpacing: 1, cursor: 'pointer',
                    }}>
                    ← SCAN ANOTHER
                  </button>
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex', gap: 4, background: 'var(--surface)',
              borderRadius: 8, padding: 4, bor
