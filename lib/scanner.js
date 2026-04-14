import { checkWhois } from './checks/whois.js'
import { checkSafeBrowsing } from './checks/safebrowsing.js'
import { checkVirusTotal } from './checks/virustotal.js'
import { checkIpGeo } from './checks/ipgeo.js'
import { checkAiAnalysis } from './checks/ai-analysis.js'
import { checkPageContent } from './checks/pagecontent.js'

export function normalizeDomain(input) {
  try {
    const cleaned = input.trim()
    const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`
    const url = new URL(withProtocol)
    return {
      domain: url.hostname.replace(/^www\./, ''),
      fullUrl: withProtocol,
    }
  } catch {
    return null
  }
}

export function computeVerdict(score) {
  if (score >= 75) return 'safe'
  if (score >= 45) return 'suspicious'
  return 'dangerous'
}

function countBySeverity(flags, severity) {
  return flags.filter(f => f.severity === severity).length
}

function hasCategory(flags, category) {
  return flags.some(f => f.category === category)
}

function hasLabel(flags, text) {
  return flags.some(f => (f.label || '').toLowerCase().includes(text.toLowerCase()))
}

function applyVerdictOverrides(trustScore, flags) {
  const highCount = countBySeverity(flags, 'high')
  const medCount = countBySeverity(flags, 'medium')

  const hasNewDomain =
    hasCategory(flags, 'domain_age') ||
    hasLabel(flags, 'new domain') ||
    hasLabel(flags, 'very new domain') ||
    hasLabel(flags, 'young domain')

  const hasHiddenOwner =
    hasCategory(flags, 'whois_privacy') ||
    hasLabel(flags, 'hidden owner')

  const hasBlacklistHit =
    hasCategory(flags, 'blacklist') ||
    hasCategory(flags, 'virustotal') ||
    hasLabel(flags, 'phishing') ||
    hasLabel(flags, 'malware') ||
    hasLabel(flags, 'flagged by security engines')

  const hasContentRisk =
    hasCategory(flags, 'ai_analysis') ||
    hasCategory(flags, 'page_content')

  let verdict = computeVerdict(trustScore)
  let adjustedScore = trustScore

  if (hasNewDomain && hasHiddenOwner && adjustedScore >= 75) {
    adjustedScore = 59
    verdict = 'suspicious'
  }

  if (hasBlacklistHit) {
    adjustedScore = Math.min(adjustedScore, 24)
    verdict = 'dangerous'
  }

  if (highCount >= 2) {
    adjustedScore = Math.min(adjustedScore, 29)
    verdict = 'dangerous'
  }

  if (hasNewDomain && hasHiddenOwner && hasContentRisk) {
    adjustedScore = Math.min(adjustedScore, 34)
    verdict = 'dangerous'
  }

  if (medCount >= 3 && verdict === 'safe') {
    adjustedScore = Math.min(adjustedScore, 59)
    verdict = 'suspicious'
  }

  return {
    trustScore: Math.max(0, Math.min(100, adjustedScore)),
    verdict,
  }
}

export async function runScan(rawInput) {
  const normalized = normalizeDomain(rawInput)
  if (!normalized) throw new Error('Invalid URL')

  const { domain, fullUrl } = normalized

  const [whois, safeBrowsing, virusTotal, ipGeo, aiAnalysis, pageContent] =
    await Promise.allSettled([
      checkWhois(domain),
      checkSafeBrowsing(fullUrl),
      checkVirusTotal(fullUrl),
      checkIpGeo(domain),
      checkAiAnalysis(fullUrl),
      checkPageContent(fullUrl),
    ])

  const results = [whois, safeBrowsing, virusTotal, ipGeo, aiAnalysis, pageContent]
    .map(r => (r.status === 'fulfilled' ? r.value : { flags: [], score: 0 }))

  const allFlags = results.flatMap(r => r.flags || [])

  const totalDeduction = results.reduce((sum, r) => sum + (r.score || 0), 0)
  const highCount = countBySeverity(allFlags, 'high')
  const medCount = countBySeverity(allFlags, 'medium')
  const lowCount = countBySeverity(allFlags, 'low')

  const extraPenalty =
    (highCount * 12) +
    (medCount * 6) +
    (lowCount * 2)

  const rawScore = Math.max(
    0,
    Math.min(100, 100 + totalDeduction - extraPenalty)
  )

  const { trustScore, verdict } = applyVerdictOverrides(rawScore, allFlags)

  return {
    domain,
    fullUrl,
    trustScore,
    verdict,
    flags: allFlags,
  }
}
