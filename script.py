from pathlib import Path
p=Path('output')
p.mkdir(exist_ok=True)
page = ''''use client'

import { useState } from 'react'

const SCAN_STEPS = [
  'Resolving domain...',
  'Checking WHOIS registry...',
  'Scanning blacklists...',
  'Running VirusTotal check...',
  'Analyzing with Google Safe Browsing...',
  'Checking hosting location...',
  'Running AI content analysis...',
  'Compiling trust score...'
]

export default function Home() {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState('idle')
  const [scanStep, setScanStep] = useState('')
  const [result, setResult] = useState(null)
  const [activeTab, setActiveTab] = useState('flags')
  const [errorMsg, setErrorMsg] = useState('')

  const handleScan = async () => {
    if (!url.trim()) return
    setPhase('scanning')
    setResult(null)
    setErrorMsg('')
    let stepIdx = 0
    const stepInterval = setInterval(() => {
      setScanStep(SCAN_STEPS[stepIdx % SCAN_STEPS.length])
      stepIdx++
    }, 600)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
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
    ? result.verdict === 'safe'
      ? 'var(--green)'
      : result.verdict === 'suspicious'
        ? 'var(--yellow)'
        : 'var(--red)'
    : 'var(--muted)'

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <h1>Is this website trying to scam you?</h1>
        <p>Paste any suspicious URL. We'll check it across security databases, analyze it with AI, and give you a trust verdict in seconds.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Enter URL"
            style={{ flex: 1, padding: 12, border: '1px solid #ccc', borderRadius: 8 }}
          />
          <button onClick={handleScan} style={{ padding: '12px 16px', borderRadius: 8 }}>Scan</button>
        </div>
        {phase === 'scanning' && <p style={{ marginTop: 16 }}>{scanStep}</p>}
        {phase === 'error' && <p style={{ marginTop: 16, color: 'crimson' }}>{errorMsg}</p>}
        {phase === 'result' && result && (
          <section style={{ marginTop: 24, border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <strong>Verdict</strong>
              <span style={{ color: verdictColor }}>{result.verdict}</span>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button onClick={() => setActiveTab('flags')}>Flags</button>
              <button onClick={() => setActiveTab('details')}>Details</button>
            </div>
            <div style={{ marginTop: 16 }}>
              {activeTab === 'flags' ? (
                <ul>
                  {(result.flags || []).map((flag, idx) => (
                    <li key={idx}>{flag.label}: {flag.detail}</li>
                  ))}
                </ul>
              ) : (
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
'''
(Path('output/page.jsx')).write_text(page)
ai = '''export async function checkAiAnalysis(url) {
  const flags = []
  let score = 0
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 12000)

    let pageText = ''
    let pageHtml = ''
    try {
      const pageRes = await fetch(url.startsWith('http') ? url : `https://${url}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScamShieldBot/1.0)' }
      })
      pageHtml = await pageRes.text()
      pageText = pageHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000)
    } catch {
      flags.push({ icon: '🚫', label: 'Page Unreachable', detail: 'Website did not respond — site may be taken down or blocking checks', severity: 'medium', category: 'ai_analysis' })
      score -= 10
      return { flags, score }
    }

    const imgFilenames = (pageHtml.match(/\/files\/([^"?]+\.(jpg|png|jpeg|webp))/gi) || []).slice(0, 15).join('\n')
    const socialLinks = (pageHtml.match(/https?:\/\/(www\.)?(facebook|instagram|twitter|youtube)\.com\/[^"]+/gi) || []).slice(0, 8).join('\n')
    const vendorFields = (pageHtml.match(/vendor.*?<\/[^>]+>/gi) || []).slice(0, 5).join('\n')
    const prices = (pageHtml.match(/Rs\.\s?\d+[\.,]?\d*/gi) || []).slice(0, 10).join(', ')
    const reviews = pageText.match(/([A-Z][a-z]+\s[A-Z][a-z]+)[\s\S]{0,200}(⭐|star|review)/gi)?.slice(0, 3).join(' | ') || ''

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: `You are an expert Indian e-commerce scam investigator. Analyze this website with extreme scrutiny.\n\nURL: ${url}\nPage content: ${pageText.slice(0, 3000)}\n\nSPECIFIC EVIDENCE FOUND:\nImage filenames: ${imgFilenames}\nSocial media links: ${socialLinks}\nVendor fields: ${vendorFields}\nPrices on page: ${prices}\nReviews found: ${reviews}\n\nINVESTIGATE EACH OF THESE SPECIFICALLY:\n1. IMAGE FILENAMES: Do filenames contain \"WhatsApp_Image\", \"ChatGPT_Image\", \"Copilot_\", \"DALL-E\"? These prove stolen/AI images.\n2. SOCIAL LINKS: Do social media links point to facebook.com/shopify, instagram.com/shopify? That means no real social presence.\n3. BRAND MISMATCH: Does the header brand name differ from footer brand name? (e.g. \"ZENVYRA\" header vs \"ASTHA\" footer)\n4. FAKE RATINGS: Are star ratings (⭐) stuffed into vendor/brand name fields instead of a real review system?\n5. PRICE FRAUD: Are premium tech products (SSD, iPhone, smartwatch) priced under ₹1000? Real market price?\n6. RECYCLED REVIEWS: Are the same reviewer names appearing for completely different product categories?\n7. IMPOSSIBLE DISCOUNTS: Are ALL products showing 60-80%+ discounts permanently?\n8. PRESSURE TACTICS: Fake \"sold in last X minutes\", fake stock counters, fake \"customers viewing\"?\n9. COD ONLY: Is Cash on Delivery the only payment option?\n10. CONTACT INFO: Is there a real phone number, email, physical address?\n\nRespond ONLY with raw JSON (no markdown, no backticks, no explanation):\n{\"scam_probability\":<0-100>,\"flags\":[{\"label\":\"\",\"detail\":\"\",\"severity\":\"\",\"icon\":\"\",\"category\":\"ai_analysis\"}]}\n\nBe extremely specific. Quote exact filenames, exact prices, exact brand names as evidence. Max 5 flags.` }]
      })
    })

    const aiData = await aiRes.json()
    const rawText = aiData?.content?.[0]?.text || ''
    let parsed = null
    try { parsed = JSON.parse(rawText.trim()) } catch {}
    if (!parsed) { try { parsed = JSON.parse(rawText.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim()) } catch {} }
    if (!parsed) { try { const m = rawText.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]) } catch {} }

    if (parsed?.flags) {
      flags.push(...parsed.flags)
      const prob = parsed.scam_probability || 0
      if (prob > 85) score -= 40
      else if (prob > 70) score -= 30
      else if (prob > 50) score -= 20
      else if (prob > 30) score -= 10
    }
  } catch (err) {
    console.error('[AI Analysis]', err.message)
  }
  return { flags, score }
}
'''
(Path('output/ai-analysis.js')).write_text(ai)
whois = '''/**
 * WHOIS via RDAP — no API key needed, completely free
 * https://www.iana.org/help/rdap-faq
 */
export async function checkWhois(domain) {
  const flags = []
  let score = 0
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`)
    if (!res.ok) return { flags, score }
    const data = await res.json()

    const events = data.events || []
    const registered = events.find(e => e.eventAction === 'registration')
    if (registered?.eventDate) {
      const ageInDays = Math.floor((Date.now() - new Date(registered.eventDate).getTime()) / 86400000)
      if (ageInDays < 14) {
        flags.push({ icon: '🕐', label: 'Very New Domain', detail: `Registered only ${ageInDays} days ago`, severity: 'high', category: 'domain_age' })
        score -= 30
      } else if (ageInDays < 90) {
        flags.push({ icon: '🕐', label: 'New Domain', detail: `Registered ${ageInDays} days ago (under 3 months)`, severity: 'medium', category: 'domain_age' })
        score -= 15
      } else if (ageInDays < 180) {
        flags.push({ icon: '🕐', label: 'Young Domain', detail: `Registered ${ageInDays} days ago (under 6 months)`, severity: 'medium', category: 'domain_age' })
        score -= 10
      }
    }

    const entities = data.entities || []
    const registrant = entities.find(e => e.roles?.includes('registrant'))
    const name = registrant?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || ''
    if (!name || ['redacted', 'privacy', 'whoisguard', 'withheld'].some(w => name.toLowerCase().includes(w))) {
      flags.push({ icon: '🕵️', label: 'Hidden Owner', detail: 'Registrant identity hidden behind privacy shield', severity: 'medium', category: 'whois_privacy' })
      score -= 10
    }
  } catch (err) {
    console.error('[WHOIS/RDAP]', err.message)
  }
  return { flags, score }
}
'''
(Path('output/whois.js')).write_text(whois)
