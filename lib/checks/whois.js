/**
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
/**
 * WHOIS via RDAP — no API key needed, completely free
 * https://www.iana.org/help/rdap-faq
 */
export async function checkWhois(domain) {
  const flags = []; let score = 0
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`)
    if (!res.ok) return { flags, score }
    const data = await res.json()

    // Domain age check
    const events = data.events || []
    const registered = events.find(e => e.eventAction === 'registration')
    if (registered?.eventDate) {
      const ageInDays = Math.floor((Date.now() - new Date(registered.eventDate).getTime()) / 86400000)
      if (ageInDays < 14) {
        flags.push({ icon:'🕐', label:'Very New Domain', detail:`Registered only ${ageInDays} days ago`, severity:'high', category:'domain_age' })
        score -= 40
      } else if (ageInDays < 90) {
        flags.push({ icon:'🕐', label:'New Domain', detail:`Registered ${ageInDays} days ago (under 3 months)`, severity:'medium', category:'domain_age' })
        score -= 25
      } else if (ageInDays < 180) {
        flags.push({ icon:'🕐', label:'Young Domain', detail:`Registered ${ageInDays} days ago (under 6 months)`, severity:'medium', category:'domain_age' })
        score -= 10
      }
    }

    // Redacted/hidden registrant
    const entities = data.entities || []
    const registrant = entities.find(e => e.roles?.includes('registrant'))
    const name = registrant?.vcardArray?.[1]?.find(v => v[0]==='fn')?.[3] || ''
    if (!name || ['redacted','privacy','whoisguard','withheld'].some(w => name.toLowerCase().includes(w))) {
      flags.push({ icon:'🕵️', label:'Hidden Owner', detail:'Registrant identity hidden behind privacy shield', severity:'medium', category:'whois_privacy' })
      score -= 15
    }

  } catch (err) { console.error('[WHOIS/RDAP]', err.message) }
  return { flags, score }
}/**
 * WHOIS via RDAP — no API key needed, completely free
 * https://www.iana.org/help/rdap-faq
 */
export async function checkWhois(domain) {
  const flags = []; let score = 0
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`)
    if (!res.ok) return { flags, score }
    const data = await res.json()

    // Domain age check
    const events = data.events || []
    const registered = events.find(e => e.eventAction === 'registration')
    if (registered?.eventDate) {
      const ageInDays = Math.floor((Date.now() - new Date(registered.eventDate).getTime()) / 86400000)
      if (ageInDays < 14) {
        flags.push({ icon:'🕐', label:'Very New Domain', detail:`Registered only ${ageInDays} days ago`, severity:'high', category:'domain_age' })
        score -= 30
      } else if (ageInDays < 90) {
        flags.push({ icon:'🕐', label:'New Domain', detail:`Registered ${ageInDays} days ago (under 3 months)`, severity:'medium', category:'domain_age' })
        score -= 15
      }
    }

    // Redacted/hidden registrant
    const entities = data.entities || []
    const registrant = entities.find(e => e.roles?.includes('registrant'))
    const name = registrant?.vcardArray?.[1]?.find(v => v[0]==='fn')?.[3] || ''
    if (!name || ['redacted','privacy','whoisguard','withheld'].some(w => name.toLowerCase().includes(w))) {
      flags.push({ icon:'🕵️', label:'Hidden Owner', detail:'Registrant identity hidden behind privacy shield', severity:'medium', category:'whois_privacy' })
      score -= 10
    }

  } catch (err) { console.error('[WHOIS/RDAP]', err.message) }
  return { flags, score }
}
