export async function checkAiAnalysis(url) {
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
        model: 'claude-haiku-4-5-20251001',
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
