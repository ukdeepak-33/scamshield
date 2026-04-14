export async function checkAiAnalysis(url) {
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

    const imgFilenames = (pageHtml.match(/\/files\/([^"?]+\.(jpg|png|jpeg|webp))/gi) || []).slice(0, 15).join('
')
    const socialLinks = (pageHtml.match(/https?:\/\/(www\.)?(facebook|instagram|twitter|youtube)\.com\/[^"]+/gi) || []).slice(0, 8).join('
')
    const vendorFields = (pageHtml.match(/vendor.*?<\/[^>]+>/gi) || []).slice(0, 5).join('
')
    const prices = (pageHtml.match(/Rs\.\s?\d+[\.,]?\d*/gi) || []).slice(0, 10).join(', ')
    const reviews = pageText.match(/([A-Z][a-z]+\s[A-Z][a-z]+)[\s\S]{0,200}(⭐|star|review)/gi)?.slice(0, 3).join(' | ') || ''

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: `You are an expert Indian e-commerce scam investigator. Analyze this website with extreme scrutiny.

URL: ${url}
Page content: ${pageText.slice(0, 3000)}

SPECIFIC EVIDENCE FOUND:
Image filenames: ${imgFilenames}
Social media links: ${socialLink
