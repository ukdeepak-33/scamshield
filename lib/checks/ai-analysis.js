function createTimeoutSignal(ms) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timeout) }
}

function safeJsonParse(text) {
  if (!text) return null
  try { return JSON.parse(text.trim()) } catch {}
  try { return JSON.parse(text.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim()) } catch {}
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch {}
  return null
}

export async function checkAiAnalysis(url) {
  const flags = []
  let score = 0

  try {
    let pageText = ''
    let pageHtml = ''

    const pageRequest = createTimeoutSignal(10000)
    try {
      const pageRes = await fetch(url.startsWith('http') ? url : `https://${url}`, {
        signal: pageRequest.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScamShieldBot/1.0)' }
      })
      pageRequest.clear()

      if (!pageRes.ok) {
        flags.push({
          icon: '🚫',
          label: 'Page Fetch Failed',
          detail: `Website returned HTTP ${pageRes.status} during content inspection`,
          severity: 'medium',
          category: 'ai_analysis'
        })
        score -= 8
        return { flags, score }
      }

      pageHtml = await pageRes.text()
      pageText = pageHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000)
    } catch {
      pageRequest.clear()
      flags.push({
        icon: '🚫',
        label: 'Page Unreachable',
        detail: 'Website did not respond or blocked automated inspection',
        severity: 'medium',
        category: 'ai_analysis'
      })
      score -= 10
      return { flags, score }
    }

    const imgFilenames = (pageHtml.match(/\/files\/([^"?]+\.(jpg|png|jpeg|webp))/gi) || []).slice(0, 15).join('\n')
    const socialLinks = (pageHtml.match(/https?:\/\/(www\.)?(facebook|instagram|twitter|youtube)\.com\/[^"'\s]+/gi) || []).slice(0, 8).join('\n')
    const vendorFields = (pageHtml.match(/vendor.*?<\/[^>]+>/gi) || []).slice(0, 8).join('\n')
    const prices = (pageHtml.match(/(?:Rs\.?|₹)\s?\d+[\.,]?\d*/gi) || []).slice(0, 20).join(', ')
    const reviews = pageText.match(/([A-Z][a-z]+\s[A-Z][a-z]+)[\s\S]{0,180}(⭐|star|review)/gi)?.slice(0, 5).join(' | ') || ''
    const title = pageHtml.match(/<title>([^<]+)<\/title>/i)?.[1] || ''
    const footerText = pageHtml.match(/(?:copyright|©)[\s\S]{0,120}/i)?.[0] || ''

    if (!process.env.ANTHROPIC_API_KEY) {
      flags.push({
        icon: '🤖',
        label: 'AI Analysis Unavailable',
        detail: 'ANTHROPIC_API_KEY is missing, so AI-based content review could not run',
        severity: 'low',
        category: 'ai_analysis'
      })
      return { flags, score }
    }

    const prompt = `You are an expert Indian e-commerce scam investigator. Analyze this website with extreme scrutiny.

URL: ${url}
Title: ${title}
Footer snippet: ${footerText}
Page content: ${pageText.slice(0, 3500)}

SPECIFIC EVIDENCE FOUND:
Image filenames: ${imgFilenames}
Social media links: ${socialLinks}
Vendor fields: ${vendorFields}
Prices on page: ${prices}
Reviews found: ${reviews}

INVESTIGATE EACH OF THESE SPECIFICALLY:
1. IMAGE FILENAMES: Do filenames contain "WhatsApp_Image", "ChatGPT_Image", "Copilot_", "DALL-E"?
2. SOCIAL LINKS: Do social media links point to facebook.com/shopify, instagram.com/shopify or other default profiles?
3. BRAND MISMATCH: Does the header/title brand differ from footer brand/copyright text?
4. FAKE RATINGS: Are star ratings stuffed into vendor/brand fields instead of a real review system?
5. PRICE FRAUD: Are premium products absurdly underpriced?
6. RECYCLED REVIEWS: Are the same reviewer names reused across unrelated products?
7. IMPOSSIBLE DISCOUNTS: Are many products showing 60-80%+ discounts permanently?
8. PRESSURE TACTICS: Fake sold counters, fake stock counters, fake customers viewing?
9. COD ONLY: Is Cash on Delivery the only payment option?
10. CONTACT INFO: Is there a real phone number, email, physical address?

Respond ONLY with raw JSON:
{"scam_probability":<0-100>,"flags":[{"label":"<specific finding>","detail":"<exact evidence>","severity":"<high|medium|low>","icon":"<emoji>","category":"ai_analysis"}]}

Be specific. Quote exact evidence where possible. Max 5 flags.`

    const aiRequest = createTimeoutSignal(12000)
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: aiRequest.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    aiRequest.clear()

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      flags.push({
        icon: '🤖',
        label: 'AI Review Failed',
        detail: `Anthropic request failed with HTTP ${aiRes.status}`,
        severity: 'low',
        category: 'ai_analysis'
      })
      console.error('[AI Analysis] Anthropic error:', aiRes.status, errText)
      return { flags, score }
    }

    const aiData = await aiRes.json()
    const rawText = aiData?.content?.[0]?.text || ''
    const parsed = safeJsonParse(rawText)

    if (parsed?.flags?.length) {
      flags.push(...parsed.flags.map(flag => ({
        ...flag,
        category: flag.category || 'ai_analysis'
      })))

      const prob = parsed.scam_probability || 0
      if (prob >= 90) score -= 45
      else if (prob >= 75) score -= 35
      else if (prob >= 60) score -= 25
      else if (prob >= 40) score -= 15
    }
  } catch (err) {
    console.error('[AI Analysis]', err.message)
  }

  return { flags, score }
}export async function checkAiAnalysis(url) {
  const flags = []; let score = 0
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 12000)
    let pageText = ''; let pageHtml = ''
    try {
      const pageRes = await fetch(url.startsWith('http') ? url : `https://${url}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScamShieldBot/1.0)' }
      })
      pageHtml = await pageRes.text()
      pageText = pageHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000)
    } catch {
      flags.push({ icon:'🚫', label:'Page Unreachable', detail:'Website did not respond — site may be taken down or blocking checks', severity:'medium', category:'ai_analysis' })
      score -= 10; return { flags, score }
    }

    // Extract specific evidence for AI
    const imgFilenames = (pageHtml.match(/\/files\/([^"?]+\.(jpg|png|jpeg|webp))/gi) || []).slice(0, 15).join('\n')
    const socialLinks = (pageHtml.match(/https?:\/\/(www\.)?(facebook|instagram|twitter|youtube)\.com\/[^"]+/gi) || []).slice(0, 8).join('\n')
    const vendorFields = (pageHtml.match(/vendor.*?<\/[^>]+>/gi) || []).slice(0, 5).join('\n')
    const prices = (pageHtml.match(/Rs\.\s?\d+[\.,]?\d*/gi) || []).slice(0, 10).join(', ')
    const reviews = pageText.match(/([A-Z][a-z]+\s[A-Z][a-z]+)[\s\S]{0,200}(⭐|star|review)/gi)?.slice(0,3).join(' | ') || ''

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are an expert Indian e-commerce scam investigator. Analyze this website with extreme scrutiny.

URL: ${url}
Page content: ${pageText.slice(0, 3000)}

SPECIFIC EVIDENCE FOUND:
Image filenames: ${imgFilenames}
Social media links: ${socialLinks}
Vendor fields: ${vendorFields}
Prices on page: ${prices}
Reviews found: ${reviews}

INVESTIGATE EACH OF THESE SPECIFICALLY:
1. IMAGE FILENAMES: Do filenames contain "WhatsApp_Image", "ChatGPT_Image", "Copilot_", "DALL-E"? These prove stolen/AI images.
2. SOCIAL LINKS: Do social media links point to facebook.com/shopify, instagram.com/shopify? That means no real social presence.
3. BRAND MISMATCH: Does the header brand name differ from footer brand name? (e.g. "ZENVYRA" header vs "ASTHA" footer)
4. FAKE RATINGS: Are star ratings (⭐) stuffed into vendor/brand name fields instead of a real review system?
5. PRICE FRAUD: Are premium tech products (SSD, iPhone, smartwatch) priced under ₹1000? Real market price?
6. RECYCLED REVIEWS: Are the same reviewer names appearing for completely different product categories?
7. IMPOSSIBLE DISCOUNTS: Are ALL products showing 60-80%+ discounts permanently?
8. PRESSURE TACTICS: Fake "sold in last X minutes", fake stock counters, fake "customers viewing"?
9. COD ONLY: Is Cash on Delivery the only payment option?
10. CONTACT INFO: Is there a real phone number, email, physical address?

Respond ONLY with raw JSON (no markdown, no backticks, no explanation):
{"scam_probability":<0-100>,"flags":[{"label":"<specific finding with evidence>","detail":"<exact proof from the page>","severity":"<high|medium|low>","icon":"<emoji>","category":"ai_analysis"}]}

Be extremely specific. Quote exact filenames, exact prices, exact brand names as evidence. Max 5 flags.`
        }]
      })
    })

    const aiData = await aiRes.json()
    const rawText = aiData?.content?.[0]?.text || ''
    let parsed = null
    try { parsed = JSON.parse(rawText.trim()) } catch {}
    if (!parsed) { try { parsed = JSON.parse(rawText.replace(/^```(?:json)?/m,'').replace(/```$/m,'').trim()) } catch {} }
    if (!parsed) { try { const m = rawText.match(/\{[\s\S]*\}/); if(m) parsed = JSON.parse(m[0]) } catch {} }

    if (parsed?.flags) {
      flags.push(...parsed.flags)
      const prob = parsed.scam_probability || 0
      if (prob > 85) score -= 40
      else if (prob > 70) score -= 30
      else if (prob > 50) score -= 20
      else if (prob > 30) score -= 10
    }
  } catch (err) { console.error('[AI Analysis]', err.message) }
  return { flags, score }
}
