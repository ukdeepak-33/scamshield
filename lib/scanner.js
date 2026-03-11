import { checkWhois } from './checks/whois.js'
import { checkSafeBrowsing } from './checks/safebrowsing.js'
import { checkVirusTotal } from './checks/virustotal.js'
import { checkIpGeo } from './checks/ipgeo.js'
import { checkAiAnalysis } from './checks/ai-analysis.js'
import { checkPageContent } from './checks/pagecontent.js'

export function normalizeDomain(input) {
  try {
    const withProtocol = input.startsWith('http') ? input : `https://${input}`
    const url = new URL(withProtocol)
    return { domain: url.hostname.replace(/^www\./, ''), fullUrl: withProtocol }
  } catch { return null }
}

export function computeVerdict(score) {
  if (score >= 70) return 'safe'
  if (score >= 40) return 'suspicious'
  return 'dangerous'
}

export async function runScan(rawInput) {
  const normalized = normalizeDomain(rawInput)
  if (!normalized) throw new Error('Invalid URL')
  const { domain, fullUrl } = normalized

  const [whois, safeBrowsing, virusTotal, ipGeo, aiAnalysis, pageContent] = await Promise.allSettled([
    checkWhois(domain),
    checkSafeBrowsing(fullUrl),
    checkVirusTotal(fullUrl),
    checkIpGeo(domain),
    checkAiAnalysis(fullUrl),
    checkPageContent(fullUrl),
  ])

  const results = [whois, safeBrowsing, virusTotal, ipGeo, aiAnalysis, pageContent]
    .map(r => r.status === 'fulfilled' ? r.value : { flags: [], score: 0 })

  const allFlags = results.flatMap(r => r.flags)
  const totalDeduction = results.reduce((sum, r) => sum + (r.score || 0), 0)
  const highCount = allFlags.filter(f => f.severity === 'high').length
  const medCount = allFlags.filter(f => f.severity === 'medium').length
  const extraPenalty = (highCount * 10) + (medCount * 5)
  const trustScore = Math.max(0, Math.min(100, 100 + totalDeduction - extraPenalty))

  return { domain, fullUrl, trustScore, verdict: computeVerdict(trustScore), flags: allFlags }
}
