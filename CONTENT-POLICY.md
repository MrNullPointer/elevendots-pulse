# ElevenDots Pulse — Content Policy & Legal Compliance Guide

## Version 2.0 Alpha — Last Updated: March 2026

---

## Executive Summary

ElevenDots Pulse is a **discovery-and-routing layer**, not a content platform.
We surface headlines, short previews, and metadata from publicly exposed sources,
then send readers to the original publisher for the full article. This is the
same established pattern used by Google News, Apple News, Feedly, Techmeme,
Flipboard, and hundreds of other aggregators.

We never host, reproduce, cache, or substitute for the original source content.

---

## 1. Content Boundary Rules

### 1.1 What We Store

For each article, we store ONLY:

| Field | Max Length | Source | Notes |
|-------|-----------|--------|-------|
| title | 300 chars | RSS `<title>` or HTML `<h1>`-`<h3>` | Not copyrightable (short phrase) |
| intro | 300 chars | RSS `<description>`, `og:description`, or `<meta description>` | Publicly exposed for SEO/social |
| url | 2000 chars | RSS `<link>` or HTML `<a href>` | Direct link to publisher |
| source | 100 chars | Config file | Publisher name only |
| section | 50 chars | Config file | Our editorial categorization |
| subsections | 10 items | Config file | Our editorial tags |
| tier | 10 chars | Config file | free / freemium / paid |
| published | ISO 8601 | RSS or HTML | Publication timestamp |
| age_hours | number | Computed | Hours since publication |
| also_from | 5 items | Deduplication | Other sources covering same story |
| id | 16 chars | SHA-256 of URL | Deterministic identifier |

### 1.2 What We NEVER Store

The following are explicitly forbidden in the codebase:

- **Article body text** — never fetched, parsed, cached, or displayed
- **Full article HTML** — the crawler reads only the first 20KB of `<head>` for metadata
- **Publisher images** — no `og:image`, hero images, thumbnails, or media content
- **Publisher logos/favicons** — not hotlinked or cached (we use text-only source names)
- **Cached HTML pages** — no mirroring, proxying, or archiving of publisher content
- **User-generated content from publisher sites** — no comments, ratings, or discussions
- **Paywalled content** — no attempt to bypass authentication, cookies, or subscription walls

### 1.3 Intro Text: The 300-Character Rule

All article preview text (the `intro` field) is capped at **300 characters maximum**.
This cap is enforced at multiple points in the pipeline:

1. `feed_parser.py` — RSS `<description>` extraction capped at 300 chars
2. `html_scraper.py` — HTML summary extraction capped at 300 chars
3. `intro_fetcher.py` — `og:description` and `<meta description>` capped at 300 chars
4. `main.py` — final safety cap before writing to `articles.json`

If ANY code path can produce intro text longer than 300 characters, that is a bug
and must be fixed immediately.

### 1.4 Outbound Links Only

Every article card in the frontend links directly to the publisher's URL. Articles
open in a new tab (`target="_blank"` with `rel="noopener noreferrer"`). We never:

- Render article content inside an iframe
- Proxy publisher pages through our domain
- Display article content in a modal or embedded view
- Cache or serve publisher page content from our infrastructure

The user always leaves our site to read the full article on the publisher's site.

---

## 2. Crawler Compliance

### 2.1 robots.txt Respect

Before crawling any HTML source (non-RSS), the crawler checks the publisher's
`robots.txt` file. If our User-Agent or the target path is disallowed, we skip
that source entirely and log a warning.

RSS/Atom feeds are exempt from robots.txt checks because RSS is explicitly
designed for programmatic consumption by third-party readers.

### 2.2 Snippet Control Directives

The crawler checks for and respects these publisher directives:

| Directive | Location | Our behavior |
|-----------|----------|-------------|
| `<meta name="robots" content="nosnippet">` | HTML `<head>` | Return empty intro (title + link only) |
| `<meta name="robots" content="max-snippet:N">` | HTML `<head>` | Cap intro at N characters |
| `data-nosnippet` attribute | HTML elements | Skip that element for intro extraction |
| `X-Robots-Tag: nosnippet` | HTTP header | Return empty intro |

These checks are performed BEFORE extracting `og:description` or any other
preview text. The checks are case-insensitive.

### 2.3 User-Agent Identification

Every HTTP request from the crawler includes a descriptive User-Agent:

```
ElevenDotsPulse/1.0 (News Aggregator; https://elevendots.dev; contact@elevendots.dev)
```

This User-Agent is consistent across ALL crawler modules (feed_parser, html_scraper,
intro_fetcher, robots_checker). It allows publishers to:

- Identify our traffic in their server logs
- Contact us if they want changes or removal
- Add specific rules for us in their `robots.txt`

### 2.4 Rate Limiting

The crawler enforces a minimum of **1.5 seconds** between requests to the same domain.
This applies to all HTTP requests: HTML page fetches, intro text fetches, and
robots.txt checks.

No domain receives more than one request per 1.5-second window, regardless of how
many articles or pages we need from that domain.

### 2.5 Timeout Enforcement

Every HTTP request has an explicit timeout of **30 seconds**. No request can hang
indefinitely. Failed requests are logged and the crawler continues to the next source.

### 2.6 Error Isolation

A single source failure cannot crash the entire crawl. Each source is crawled inside
a try/except block. Failed sources are logged in `source_health` with status "error"
and the crawler continues. The `articles.json` output is always written, even if
some sources fail.

---

## 3. Per-Source Policy Registry

Every source in `config/sources.yaml` includes a `policy` block that documents
the compliance posture for that source:

```yaml
policy:
  preview_mode: rss_description    # What we use for intro text
  robots_txt_checked: true         # Have we verified robots.txt?
  tos_reviewed: true               # Have we reviewed their ToS?
  tos_notes: "RSS feed is public"  # Optional notes
```

### 3.1 Preview Mode Options

| Mode | Description | When to use |
|------|-------------|-------------|
| `rss_description` | Use RSS `<description>` tag only | Default for RSS sources (safest) |
| `og_description` | Fetch `og:description` from page `<head>` | For HTML-scraped sources |
| `title_only` | No preview text — title + source + link only | When rights are unclear or restricted |
| `manual` | Manually written summary | For sources requiring editorial control |

### 3.2 Decision Tree

```
Does the source provide an RSS/Atom feed?
├─ YES → Does the feed include <description>?
│        ├─ YES → preview_mode: rss_description (SAFEST)
│        └─ NO  → preview_mode: og_description
└─ NO  → Is the source paywalled?
         ├─ YES → preview_mode: title_only
         └─ NO  → Does robots.txt allow crawling?
                   ├─ YES → preview_mode: og_description
                   └─ NO  → DO NOT CRAWL. Remove source.
```

### 3.3 Source Types with Special Handling

**YouTube channels:** We crawl YouTube's RSS feeds only
(`youtube.com/feeds/videos.xml?channel_id=...`). We extract video title, URL,
and description from the RSS. We never embed, download, or cache video content.

**Podcasts:** We crawl podcast RSS feeds for episode metadata (title, URL,
description). We never download, cache, or serve audio files.

**Paid sources (The Information, SemiAnalysis, WSJ, etc.):** We fetch only
the publicly exposed RSS `<description>`. We never attempt to bypass paywalls,
use cookies, sessions, or authentication tokens.

**Academic research papers (arXiv, OpenAlex):** We ingest metadata only — title,
authors, venue, abstract excerpt (≤300 chars), and a link to the canonical page.
We never store, host, or serve full-text PDFs. arXiv papers link to arxiv.org.
OpenAlex papers link to the publisher's DOI landing page. OpenAlex data is CC0.
arXiv RSS is permissive for metadata use. We do not automate Google Scholar
access or scrape behind access controls.

---

## 4. Publisher Relations

### 4.1 Removal / Opt-Out Process

The site footer includes:
```
Sources can request changes or removal: contact@elevendots.dev
```

**Response SLA:** Within 48 hours for removal requests.

**Removal process:**
1. Immediately remove the source from `config/sources.yaml`
2. Trigger a manual crawl-and-deploy to remove their content from the live site
3. The next automated crawl (within 1 hour) ensures removal persists
4. Add the source domain to `config/blocked_domains.yaml` to prevent re-addition
5. Respond to the publisher confirming removal
6. Note: cached `articles.json` data is overwritten every hour; any residual
   articles from the removed source will be purged within one crawl cycle

**What we do NOT do:**
- We do not argue fair use with publishers
- We do not ignore removal requests
- We do not require legal justification from publishers
- If they don't want to be listed, we remove them. Period.

### 4.2 Logo and Branding Policy

- We do NOT display publisher logos, favicons, or brand marks
- We use text-only source names (e.g., "DigiTimes", "SemiAnalysis")
- We never modify, crop, recolor, or create derivative versions of publisher branding
- We never use publisher branding in a way that implies endorsement or partnership
- If a publisher explicitly grants permission to use their logo, we document it in
  their `policy` block and store the approved asset in `site/public/logos/`

---

## 5. Data Output Security

### 5.1 Article Schema Validation

The `articles.json` output is validated before deployment:

- All articles must have required fields: `id`, `title`, `url`, `source`, `section`
- All `intro` fields must be ≤ 300 characters
- All `url` fields must start with `https://` or `http://`
- No forbidden fields may exist: `body`, `content`, `full_text`, `image_url`,
  `thumbnail`, `og_image`, `cached_html`
- The `article_count` must be > 0 (zero-article deploys are blocked)

### 5.2 Input Sanitization

- All HTML tags are stripped from `title` and `intro` fields before storage
- The `clean_html()` function removes ALL HTML markup including `<script>`, `<img>`,
  `<iframe>`, and event handlers
- The React frontend renders article data as text nodes only — no `dangerouslySetInnerHTML`
- URL validation rejects `javascript:`, `data:`, and other non-HTTP schemes

### 5.3 No Tracking or Analytics

ElevenDots Pulse does not include any:
- Third-party analytics scripts (no Google Analytics, Mixpanel, etc.)
- Tracking pixels or beacons
- Advertising scripts or ad networks
- Social media tracking widgets
- User behavior analytics beyond browser-native functionality

The only client-side storage used is:
- `localStorage['elevendots-theme']` — light/dark mode preference
- `localStorage['elevendots-visited']` — first-visit animation flag

No personal data is collected, stored, or transmitted.

### 5.4 No Secrets in Repository

The repository must not contain:
- API keys, tokens, or passwords
- Authentication credentials
- Private keys or certificates
- Environment files (`.env`) — must be in `.gitignore`

GitHub Actions secrets are accessed via `${{ secrets.GITHUB_TOKEN }}` only.

---

## 6. GitHub Actions Security

### 6.1 Workflow Permissions

Permissions are scoped to minimum required:
- `contents: write` — for committing `articles.json`
- `pages: write` — for deploying to GitHub Pages
- `id-token: write` — for Pages deployment

No `permissions: write-all` or overly broad permissions.

### 6.2 Deployment Validation

The workflow validates `articles.json` before deploying:
1. JSON must be valid (parseable)
2. `article_count` must be > 0
3. If validation fails, deployment is skipped (no stale/broken data)

### 6.3 Concurrency Control

The workflow uses `concurrency` settings to prevent parallel runs.
Two simultaneous crawls could corrupt `articles.json`.

---

## 7. Frontend Security

### 7.1 Content Rendering

- Article titles and intros are rendered as **text nodes only**
- No `dangerouslySetInnerHTML` on any article data
- No `innerHTML` assignments from article data
- No `eval()` anywhere in the codebase
- No `document.write()` anywhere in the codebase

### 7.2 External Link Safety

All links to publisher URLs include:
- `target="_blank"` (opens in new tab)
- `rel="noopener noreferrer"` (prevents referrer leakage and opener access)

### 7.3 Static Site Guarantee

The site is 100% static. At runtime, it makes NO external HTTP requests except:
- Loading Google Fonts (fonts.googleapis.com / fonts.gstatic.com)
- Loading the static `articles.json` from the same domain

No fetch() calls to external APIs, no WebSocket connections, no third-party scripts.

---

## 8. Privacy Statement

ElevenDots Pulse does not collect personal data. We do not use cookies for tracking.
We do not run analytics. We do not serve ads. The only data stored in the user's
browser is the theme preference and first-visit flag in localStorage.

We do not track which articles users click, which sections they visit, or how long
they spend on the site. All interaction is between the user's browser and our static
files served from GitHub Pages CDN.

When a user clicks an article link, they leave our site and visit the publisher's
site directly. We have no visibility into that subsequent interaction.

---

## 9. AI Disclosure

This site was built with assistance from AI tools (Claude, ChatGPT) for code
generation, design, and content architecture. The editorial curation — selection
of sources, categorization into sections and subsections, and ongoing maintenance —
is performed by the site's human operator.

No AI is used to generate, summarize, rewrite, or modify article content. All
article titles and intro text come directly from the publishers' own RSS feeds
and HTML metadata, unmodified except for HTML tag stripping and character length
capping.

---

## 10. Future Considerations

### If affiliate links or sponsored placements are added

The FTC requires clear disclosure of material connections. Any affiliate links
or paid source placements must include visible disclosure:
```
[Sponsored] This source placement is a paid partnership.
```

### If AI-generated summaries are added

Using an LLM to summarize articles (beyond the publisher's own preview text)
changes the legal calculus. AI-generated summaries of copyrighted articles may
not qualify as "publicly exposed metadata." Consult an IP attorney before adding
this feature.

### If the site grows to significant traffic

At scale (>100k monthly visitors), invest in:
- Formal partnership agreements with major sources
- A media/IP attorney on retainer
- Publisher referral analytics (show publishers how much traffic you send)

---

## 11. Pre-Launch Compliance Checklist

- [ ] Every source has a `policy` block in `sources.yaml`
- [ ] Crawler respects `robots.txt` for all HTML-scraped sources
- [ ] Crawler checks for `nosnippet`, `max-snippet`, and `data-nosnippet`
- [ ] Crawler User-Agent is consistent across all modules and includes contact email
- [ ] Rate limiting enforced (1.5s minimum between same-domain requests)
- [ ] All HTTP requests have explicit timeouts (≤ 30 seconds)
- [ ] Preview text capped at 300 characters at ALL code paths
- [ ] No publisher images stored or displayed
- [ ] No publisher logos/favicons hotlinked or cached
- [ ] No article body text stored anywhere in the pipeline
- [ ] HTML tags stripped from all stored text (title, intro)
- [ ] No `dangerouslySetInnerHTML` on article data in frontend
- [ ] All external links use `target="_blank" rel="noopener noreferrer"`
- [ ] Footer includes removal contact email
- [ ] `articles.json` validated before deployment (valid JSON, count > 0)
- [ ] GitHub Actions permissions are minimally scoped
- [ ] No secrets or credentials committed to the repository
- [ ] `.gitignore` excludes `.env` files
- [ ] `localStorage` used only for theme and visited flag
- [ ] No third-party analytics, tracking, or advertising scripts
- [ ] One-hour legal review with IP attorney (recommended)

---

## Summary

ElevenDots Pulse is a **discovery surface**, not a content platform.
We help publishers reach readers. We help readers find publishers.
We never substitute for the original source.

That is a legitimate, well-established business model.
