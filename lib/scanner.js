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
  const overrides = []

  if (hasNewDomain && hasHiddenOwner && adjustedScore >= 75) {
    adjustedScore = 59
    verdict = 'suspicious'
    overrides.push('new_domain_plus_hidden_owner_blocked_safe_verdict')
  }

  if (hasBlacklistHit) {
    adjustedScore = Math.min(adjustedScore, 24)
    verdict = 'dangerous'
    overrides.push('blacklist_or_security_engine_forced_dangerous')
  }

  if (highCount >= 2) {
    adjustedScore = Math.min(adjustedScore, 29)
    verdict = 'dangerous'
    overrides.push('two_or_more_high_severity_flags_forced_dangerous')
  }

  if (hasNewDomain && hasHiddenOwner && hasContentRisk) {
    adjustedScore = Math.min(adjustedScore, 34)
    verdict = 'dangerous'
    overrides.push('new_domain_hidden_owner_plus_content_risk_forced_dangerous')
  }

  if (medCount >= 3 && verdict === 'safe') {
    adjustedScore = Math.min(adjustedScore, 59)
    verdict = 'suspicious'
    overrides.push('three_or_more_medium_flags_blocked_safe_verdict')
  }

  return {
    trustScore: Math.max(0, Math.min(100, adjustedScore)),
    verdict,
    overrides,
  }
}

export async function runScan(rawInput) {
  const normalized = normalizeDomain(rawInput)
  if (!normalized) throw new Error('Invalid URL')

  const { domain, fullUrl } = normalized

  const checks = [
    { key: 'whois', run: () => checkWhois(domain) },
    { key: 'safeBrowsing', run: () => checkSafeBrowsing(fullUrl) },
    { key: 'virusTotal', run: () => checkVirusTotal(fullUrl) },
    { key: 'ipGeo', run: () => checkIpGeo(domain) },
    { key: 'aiAnalysis', run: () => checkAiAnalysis(fullUrl) },
    { key: 'pageContent', run: () => checkPageContent(fullUrl) },
  ]

  const settled = await Promise.allSettled(checks.map(c => c.run()))

  const debugChecks = settled.map((result, index) => {
    const key = checks[index].key
    if (result.status === 'fulfilled') {
      return {
        key,
        ok: true,
        scoreDelta: result.value?.score || 0,
        flagCount: (result.value?.flags || []).length,
        flags: result.value?.flags || [],
      }
    }

    return {
      key,
      ok: false,
      scoreDelta: 0,
      flagCount: 0,
      flags: [],
      error: result.reason?.message || 'Unknown check error',
    }
  })

  const results = debugChecks.map(c => ({ flags: c.flags, score: c.scoreDelta }))
  const allFlags = results.flatMap(r => r.flags || [])

  const totalDeduction = results.reduce((sum, r) => sum + (r.score || 0), 0)
  const highCount = countBySeverity(allFlags, 'high')
  const medCount = countBySeverity(allFlags, 'medium')
  const lowCount = countBySeverity(allFlags, 'low')

  const extraPenalty =
    (highCount * 12) +
    (medCount * 6) +
    (lowCount * 2)

  const rawScore = Math.max(0, Math.min(100, 100 + totalDeduction - extraPenalty))
  const overrideResult = applyVerdictOverrides(rawScore, allFlags)

  return {
    domain,
    fullUrl,
    trustScore: overrideResult.trustScore,
    verdict: overrideResult.verdict,
    flags: allFlags,
    debug: {
      normalizedInput: { rawInput, domain, fullUrl },
      checks: debugChecks,
      totals: {
        totalFlags: allFlags.length,
        highCount,
        medCount,
        lowCount,
        totalDeduction,
        extraPenalty,
        rawScore,
        finalScore: overrideResult.trustScore,
        finalVerdict: overrideResult.verdict,
      },
      overrides: overrideResult.overrides,
    },
  }
}
