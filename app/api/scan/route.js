import { NextResponse } from 'next/server'
import { runScan, normalizeDomain } from '@/lib/scanner'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request) {
  try {
    const { url } = await request.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const normalized = normalizeDomain(url.trim())
    if (!normalized) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    const { domain } = normalized
    const result = await runScan(url.trim())

    const { data: existing } = await supabaseAdmin
      .from('sites')
      .select('id, scan_count')
      .eq('domain', domain)
      .single()

    const { data: site, error: siteError } = await supabaseAdmin
      .from('sites')
      .upsert({
        domain: result.domain,
        trust_score: result.trustScore,
        verdict: result.verdict,
        last_scanned: new Date().toISOString(),
        scan_count: (existing?.scan_count || 0) + 1,
      }, { onConflict: 'domain' })
      .select()
      .single()

    if (siteError) throw siteError

    await supabaseAdmin.from('flags').delete().eq('site_id', site.id)

    if (result.flags.length > 0) {
      await supabaseAdmin.from('flags').insert(
        result.flags.map(f => ({
          site_id: site.id,
          category: f.category || 'general',
          label: f.label,
          detail: f.detail,
          severity: f.severity,
          icon: f.icon,
        }))
      )
    }

    return NextResponse.json({
      ...site,
      trustScore: result.trustScore,
      verdict: result.verdict,
      domain: result.domain,
      flags: result.flags,
      fromCache: false,
      debug: result.debug,
    })
  } catch (err) {
    console.error('[/api/scan] Error:', err)
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 })
  }
}
