# 🛡️ ScamShield — Full Architecture Plan
> Stack: Next.js · Supabase · Vercel · Free Tier Only · GitHub-first workflow

---

## 📐 High-Level Architecture

```
User Browser
     │
     ▼
┌─────────────────────────────┐
│     FRONTEND (Next.js)      │  ← Hosted on Vercel (free)
│  /app  — React pages        │
│  /components — UI           │
│  /lib  — API helpers        │
└────────────┬────────────────┘
             │ API Routes (Next.js /api/*)
             ▼
┌─────────────────────────────┐
│   BACKEND (Next.js API)     │  ← Same Vercel project (no separate server needed)
│  /api/scan     — scan URL   │
│  /api/report   — submit     │
│  /api/lookup   — authority  │
└────┬──────────┬─────────────┘
     │          │
     ▼          ▼
┌─────────┐  ┌──────────────────────────┐
│ EXTERNAL│  │   SUPABASE (free tier)   │
│  APIs   │  │                          │
│         │  │  Tables:                 │
│ • Google│  │  - scans                 │
│   Safe  │  │  - reports               │
│   Browse│  │  - sites                 │
│ • WHOIS │  │  - flags                 │
│ • Virus │  │  - authorities           │
│   Total │  │                          │
│ • ip-api│  │  Auth: Supabase Auth     │
│ (all    │  │  Storage: screenshots    │
│  free)  │  └──────────────────────────┘
└─────────┘
```

---

## 🗂️ Repository Structure

```
scamshield/                         ← Single GitHub repo
├── .github/
│   └── workflows/
│       └── deploy.yml              ← Auto-deploy to Vercel on push
├── app/                            ← Next.js App Router
│   ├── page.jsx                    ← Home (URL scanner)
│   ├── reports/page.jsx            ← Community reports feed
│   ├── site/[domain]/page.jsx      ← Per-site detail page
│   └── layout.jsx
├── components/
│   ├── Scanner.jsx                 ← URL input + scan trigger
│   ├── TrustScore.jsx              ← Gauge widget
│   ├── FlagList.jsx                ← AI red flags
│   ├── CommunityReports.jsx        ← Reports feed + submit form
│   └── AuthorityGuide.jsx          ← Report-to-authority panel
├── lib/
│   ├── supabase.js                 ← Supabase client
│   ├── scanner.js                  ← Orchestrates all checks
│   ├── checks/
│   │   ├── whois.js                ← Domain age / registrar
│   │   ├── safebrowsing.js         ← Google Safe Browsing
│   │   ├── virustotal.js           ← VirusTotal lookup
│   │   ├── ipgeo.js                ← Hosting location
│   │   └── ai-analysis.js          ← Claude API for content scan
│   └── authorities.js              ← Country → authority mapping
├── app/api/
│   ├── scan/route.js               ← POST /api/scan
│   ├── report/route.js             ← POST /api/report
│   └── site/[domain]/route.js      ← GET /api/site/:domain
├── supabase/
│   └── migrations/
│       └── 001_init.sql            ← DB schema (run once in Supabase dashboard)
├── .env.example                    ← Template for all env vars
├── next.config.js
└── package.json
```

---

## 🗃️ Supabase Database Schema

```sql
-- 001_init.sql

-- All scanned sites + their cached scores
CREATE TABLE sites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain       TEXT UNIQUE NOT NULL,
  trust_score  INT,
  verdict      TEXT,            -- 'safe' | 'suspicious' | 'dangerous'
  last_scanned TIMESTAMPTZ DEFAULT now(),
  scan_count   INT DEFAULT 1
);

-- Individual red flags detected per scan
CREATE TABLE flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    UUID REFERENCES sites(id) ON DELETE CASCADE,
  category   TEXT,             -- 'domain_age' | 'ssl' | 'price' | 'images' | ...
  detail     TEXT,
  severity   TEXT,             -- 'high' | 'medium' | 'low'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Community scam reports submitted by users
CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES sites(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),   -- nullable (allow anonymous)
  description TEXT NOT NULL,
  amount_lost INT,                               -- in INR
  screenshot_url TEXT,
  upvotes     INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Authority directory (seeded once)
CREATE TABLE authorities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country     TEXT NOT NULL,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  description TEXT,
  type        TEXT             -- 'cybercrime' | 'consumer' | 'banking' | 'police'
);

-- Enable Row Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
-- Anyone can read reports
CREATE POLICY "public read" ON reports FOR SELECT USING (true);
-- Only authenticated users can insert
CREATE POLICY "auth insert" ON reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

---

## 🔌 Free API Integrations

| API | What it checks | Free limit | Key needed |
|-----|---------------|------------|------------|
| **Google Safe Browsing** | Malware / phishing blacklist | 10,000 req/day | Yes (Google Cloud) |
| **VirusTotal** | 70+ antivirus engines | 500 req/day | Yes (free signup) |
| **ip-api.com** | Hosting country + ISP | 45 req/min | No key needed |
| **whois.whoisxmlapi.com** | Domain age, registrar | 500 req/month | Yes (free plan) |
| **Claude API (Anthropic)** | AI content analysis | Pay-as-you-go | Yes |

---

## ⚙️ Environment Variables (.env.example)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# External APIs
GOOGLE_SAFE_BROWSING_KEY=your-key
VIRUSTOTAL_API_KEY=your-key
WHOIS_API_KEY=your-key
ANTHROPIC_API_KEY=your-key

# App
NEXT_PUBLIC_APP_URL=https://scamshield-io.vercel.app/
```

---

## 🔄 Scan Flow (Step by Step)

```
User submits URL
      │
      ▼
POST /api/scan
      │
      ├─ 1. Normalize & validate URL
      │
      ├─ 2. Check Supabase cache (scanned in last 24h? return cached)
      │
      ├─ 3. Run checks in PARALLEL:
      │     ├── WHOIS → domain age, registrar, privacy shield
      │     ├── Google Safe Browsing → blacklist check
      │     ├── VirusTotal → multi-engine scan
      │     ├── ip-api → hosting country, ISP
      │     └── Claude AI → fetch homepage, analyze for red flags
      │
      ├─ 4. Calculate trust score (weighted algorithm)
      │     ├── Domain < 30 days old     → -30 pts
      │     ├── On blacklist             → -40 pts
      │     ├── Anonymous WHOIS          → -10 pts
      │     ├── Offshore hosting         → -10 pts
      │     └── AI red flags             → -5 to -20 pts
      │
      ├─ 5. Save to Supabase (sites + flags tables)
      │
      └─ 6. Return JSON result to frontend
```

---

## 🚀 Deployment Setup

### Vercel (Frontend + API)
1. Push repo to GitHub
2. Connect GitHub repo on vercel.com → "New Project"
3. Framework: **Next.js** (auto-detected)
4. Add all `.env` variables in Vercel dashboard → Settings → Environment Variables
5. Every `git push` to `main` → auto deploys ✅

### Supabase (Database)
1. Create project on supabase.com (free tier = 500MB, 2 free projects)
2. Go to SQL Editor → paste `001_init.sql` → Run
3. Copy Project URL + anon key → paste into Vercel env vars
4. Enable Supabase Auth (Email signup, or Google OAuth)

### GitHub Actions (optional CI)
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

## 📦 Tech Stack Summary

| Layer | Tech | Hosting | Cost |
|-------|------|---------|------|
| Frontend | Next.js 14 (App Router) | Vercel | Free |
| Backend | Next.js API Routes | Vercel (same) | Free |
| Database | Supabase (PostgreSQL) | Supabase | Free |
| Auth | Supabase Auth | Supabase | Free |
| File storage | Supabase Storage | Supabase | Free (1GB) |
| Domain | Vercel subdomain | Vercel | Free |
| CI/CD | GitHub → Vercel auto-deploy | GitHub | Free |

---

## 🗺️ Build Phases

| Phase | What we build | Status |
|-------|--------------|--------|
| ✅ Phase 0 | UI Mockup | Done |
| ✅ Phase 1 | Architecture | Done |
| 🔜 Phase 2 | Next.js project scaffold + Supabase schema | Done |
| 🔜 Phase 3 | URL scanner API (real integrations) | Done |
| 🔜 Phase 4 | Community reports system | Done |
| 🔜 Phase 5 | AI analysis with Claude API | Done |
| 🔜 Phase 6 | Authority reporting guide | Done |
| 🔜 Phase 7 | Polish + launch | Done |
