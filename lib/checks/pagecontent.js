export async function checkPageContent(url) {
  const flags = []
  let score = 0

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url.startsWith('http') ? url : `https://${url}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScamShieldBot/1.0)' }
    })
    clearTimeout(timeout)

    if (!res.ok) {
      flags.push({
        icon: '🚫',
        label: 'Page Fetch Failed',
        detail: `Website returned HTTP ${res.status} during content inspection`,
        severity: 'medium',
        category: 'page_content'
      })
      score -= 8
      return { flags, score }
    }

    const html = await res.text()
    const text = html.toLowerCase()

    const addFlag = (flag, deduction) => {
      flags.push(flag)
      score -= deduction
    }

    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || ''
    const footerBrandMatch = html.match(/©\s*\d{4}[\s\-–|]*([^<\n\.]{2,50})/i)
    const footerBrand = footerBrandMatch?.[1]?.trim() || ''

    const whatsappImgs = (html.match(/WhatsApp[_\s-]?Image/gi) || []).length
    if (whatsappImgs >= 3) {
      addFlag({ icon:'📱', label:'Product Photos from WhatsApp', detail:`${whatsappImgs} image references include "WhatsApp Image" filenames`, severity:'high', category:'page_content' }, 30)
    } else if (whatsappImgs >= 1) {
      addFlag({ icon:'📱', label:'WhatsApp Images Found', detail:'Site uses WhatsApp-style image filenames for product photos', severity:'medium', category:'page_content' }, 15)
    }

    const aiImgPatterns = ['chatgpt_image', 'copilot_', 'dall-e', 'dalle_', 'midjourney', 'aigenerated', 'ai_image']
    const aiImgFound = aiImgPatterns.filter(p => text.includes(p))
    if (aiImgFound.length > 0) {
      addFlag({ icon:'🤖', label:'AI-Generated Store Images', detail:`Store content references AI-generated asset naming (${aiImgFound[0]})`, severity:'high', category:'page_content' }, 25)
    }

    const fakeRatingPattern = /\.4\.\d⭐|vendor.*⭐.*\d{3,}|\(\d{2,6}\).*⭐|4\.9⭐/i
    if (fakeRatingPattern.test(html)) {
      addFlag({ icon:'⭐', label:'Fake Ratings in Wrong Fields', detail:'Star ratings appear stuffed into vendor or taxonomy fields instead of a proper review system', severity:'high', category:'fake_reviews' }, 22)
    }

    if (footerBrand && title) {
      const footerToken = footerBrand.toLowerCase().split(/\s+/)[0]
      const titleLower = title.toLowerCase()
      if (footerToken.length > 2 && !titleLower.includes(footerToken)) {
        addFlag({ icon:'🏢', label:'Brand Identity Mismatch', detail:`Title suggests one brand while footer references "${footerBrand}"`, severity:'high', category:'identity' }, 25)
      }
    }

    const shopifySocialLinks = (html.match(/facebook\.com\/shopify|instagram\.com\/shopify|twitter\.com\/shopify|youtube\.com\/user\/shopify/gi) || []).length
    if (shopifySocialLinks >= 1) {
      addFlag({ icon:'📱', label:'Fake Social Media Links', detail:`${shopifySocialLinks} social media link(s) point to Shopify defaults instead of the merchant`, severity: shopifySocialLinks >= 2 ? 'high' : 'medium', category:'identity' }, shopifySocialLinks >= 2 ? 20 : 12)
    }

    const discounts = [...html.matchAll(/(?:sale|save|off)\s*[-–:]?\s*(\d+)%|(?:(\d+)%\s*off)/gi)]
      .map(m => parseInt(m[1] || m[2]))
      .filter(Boolean)
    const extremeDiscounts = discounts.filter(d => d >= 60)
    if (extremeDiscounts.length >= 3) {
      addFlag({ icon:'💸', label:'Extreme Discounts on Multiple Products', detail:`Found ${extremeDiscounts.length} discounts of 60% or higher`, severity:'high', category:'price' }, 25)
    }

    const urgencyPatterns = [
      { pattern: /\d+\s*sold in last\s*\d+\s*min/i, msg: 'Fake sold counter' },
      { pattern: /hurrify|hurry.*only.*left|only \d+ left/i, msg: 'Fake stock countdown' },
      { pattern: /\d{2,}\s*customers are viewing|people are viewing/i, msg: 'Fake live viewer counter' },
      { pattern: /buy\s*1\s*get\s*1|bogo/i, msg: 'Aggressive BOGO urgency offer' },
    ]
    const foundUrgency = urgencyPatterns.filter(u => u.pattern.test(html))
    if (foundUrgency.length >= 2) {
      addFlag({ icon:'⏰', label:'Multiple Fake Urgency Tactics', detail:`Detected ${foundUrgency.map(u => u.msg).join(', ')}`, severity:'high', category:'pressure' }, 20)
    } else if (foundUrgency.length === 1) {
      addFlag({ icon:'⏰', label:'Pressure Tactic Detected', detail:foundUrgency[0].msg, severity:'medium', category:'pressure' }, 10)
    }

    const reviewNames = ['riya bansal', 'ayush', 'kshitiz', 'harsh agarwal', 'rahul sharma']
    const foundReviewers = reviewNames.filter(n => text.includes(n))
    const reviewCount = (html.match(/customer.*review|testimonial|⭐.*⭐/gi) || []).length
    if (foundReviewers.length >= 2 && reviewCount >= 3) {
      addFlag({ icon:'👥', label:'Copy-Pasted Fake Reviews', detail:`Reviewer names repeated across products: ${foundReviewers.slice(0, 3).join(', ')}`, severity:'high', category:'fake_reviews' }, 20)
    }

    const hasPhone = /(\+91|0)?[\s-]?[6-9]\d{9}/.test(text)
    const hasEmail = /[a-z0-9._%+-]+@(?!shopify)[a-z0-9.-]+\.[a-z]{2,}/.test(text)
    const hasAddress = /\d+.*?(road|street|nagar|colony|lane|floor|building|area|district|city)/i.test(text)
    if (!hasPhone && !hasEmail && !hasAddress) {
      addFlag({ icon:'📞', label:'No Real Contact Information', detail:'No phone number, business email, or physical address was found', severity:'high', category:'contact' }, 25)
    }

    const techKeywords = ['ssd','1tb','2tb','iphone','macbook','airpods','ps5','gpu','rtx','smartwatch','laptop']
    const hasTech = techKeywords.some(k => text.includes(k))
    const allPrices = [...text.matchAll(/(?:rs\.?|₹)\s?(\d+)/g)].map(m => parseInt(m[1])).filter(p => p > 0)
    const veryLowPrices = allPrices.filter(p => p < 2000)
    if (hasTech && veryLowPrices.length > 0) {
      addFlag({ icon:'💻', label:'Impossible Tech Product Pricing', detail:`Tech products appear priced as low as ₹${Math.min(...veryLowPrices)}`, severity:'high', category:'price' }, 30)
    }

    const gibberishSku = /sku.*[A-Z]{4,}\s+[A-Z]{2,}|bgbvbvc|xyzabc/i.test(html)
    if (gibberishSku) {
      addFlag({ icon:'🔢', label:'Gibberish Product SKUs', detail:'Product SKU strings contain random or nonsensical character patterns', severity:'medium', category:'page_content' }, 10)
    }

    const hasCod = text.includes('cash on delivery') || text.includes(' cod ')
    const hasOnlinePay = ['upi', 'razorpay', 'stripe', 'credit card', 'debit card', 'net banking', 'paytm'].some(p => text.includes(p))
    if (hasCod && !hasOnlinePay) {
      addFlag({ icon:'💰', label:'Cash on Delivery Only', detail:'Cash on Delivery is present without clear online payment options', severity:'high', category:'payment' }, 20)
    }

    const suspiciousVendorPath = /\/collections\/vendors\?filter\.p\.vendor=.*⭐/i.test(html)
    if (suspiciousVendorPath) {
      addFlag({ icon:'🧾', label:'Suspicious Vendor Rating URL', detail:'Vendor collection URLs include embedded star-rating text instead of clean brand names', severity:'high', category:'fake_reviews' }, 20)
    }

    const shopifyBoilerplate = /(all rights reserved|refund policy|privacy policy|shipping policy|terms of service)/gi
    const boilerplateCount = (text.match(shopifyBoilerplate) || []).length
    if (boilerplateCount >= 4 && !hasPhone && !hasEmail) {
      addFlag({ icon:'🛍️', label:'Template Storefront with Weak Identity', detail:'Store relies on generic policy boilerplate while lacking clear merchant identity details', severity:'medium', category:'identity' }, 12)
    }

  } catch (err) {
    console.error('[PageContent]', err.message)
  }

  return { flags, score }
}
