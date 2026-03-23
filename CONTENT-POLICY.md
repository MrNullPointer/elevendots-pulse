# Elevendots-Pulse — Content Policy & Legal Compliance Guide

## Executive Summary

Elevendots-Pulse is a **discovery-and-routing layer**, not a content-mirroring layer.
We surface headlines, short previews, and metadata from publicly exposed sources,
then send readers to the original publisher for the full article. This is the
same pattern used by Google News, Apple News, Feedly, Techmeme, Flipboard,
and hundreds of other aggregators operating openly today.

This document codifies the rules that keep the product cleanly legitimate.

---

## Core Legal Principles

### What copyright does and does not protect (U.S. law)

- **Not protected**: Facts, ideas, titles, short phrases, and metadata.
  The U.S. Copyright Office explicitly states that titles and short phrases
  are generally not copyrightable.

- **Protected**: Substantial creative expression — article body text,
  editorial analysis, original photography, illustrations.

- **Gray zone**: Automated excerpt republishing without added commentary.
  In *AP v. Meltwater*, a court rejected fair use when an automated system
  copied and republished article excerpts without transformative value.

### Our safe position

We fetch ONLY what publishers deliberately expose for third-party consumption:
- RSS/Atom `<description>` fields (designed for external readers)
- `og:description` meta tags (designed for social sharing previews)
- `<meta name="description">` tags (designed for search engine snippets)
- Titles (not copyrightable as short phrases)
- Publication dates, author names, source URLs (facts, not expression)

We NEVER fetch, store, cache, or display:
- Article body text beyond the publicly exposed preview
- Full paragraphs or substantial excerpts
- Paywalled content
- Content behind authentication

---

## Per-Source Policy Registry

Every source in `sources.yaml` should include a `policy` block that documents
the legal and compliance posture for that source. This turns compliance into
a structured, auditable system.

### Schema

```yaml
sources:
  - name: "The Information"
    url: "https://www.theinformation.com/feed"
    type: rss
    section: tech
    subsections: [ai, software]
    tier: paid
    
    # Legal compliance fields
    policy:
      preview_mode: rss_description   # What we use for intro text
      # Options:
      #   rss_description  — Use RSS <description> (safest, intended for external use)
      #   og_description   — Use og:description meta tag (safe, intended for social previews)
      #   title_only       — Show only title + source + link (most conservative)
      #   manual           — Manually curated preview (you write the summary yourself)
      
      logo_allowed: false             # Do we have permission to display their logo?
      robots_txt_checked: true        # Have we verified robots.txt allows our crawler?
      tos_reviewed: true              # Have we reviewed their Terms of Service?
      tos_notes: "RSS feed is public. ToS prohibits scraping beyond RSS."
      max_snippet_respected: true     # Do we honor their max-snippet meta directive?
      contact_for_removal: "editor@theinformation.com"
      last_policy_review: "2026-03-23"
```

### Preview Mode Decision Tree

```
Does the source provide an RSS/Atom feed?
  ├─ YES → Does the feed include <description>?
  │         ├─ YES → preview_mode: rss_description (SAFEST)
  │         └─ NO  → preview_mode: og_description
  └─ NO  → Is the source paywalled?
            ├─ YES → preview_mode: title_only
            └─ NO  → Does robots.txt allow crawling?
                      ├─ YES → preview_mode: og_description
                      └─ NO  → DO NOT CRAWL. Remove source.
```

---

## Technical Compliance Rules

### 1. Respect robots.txt

Before crawling any HTML source (non-RSS), fetch and parse their `robots.txt`.
If our User-Agent or path is disallowed, skip that source entirely.

```python
from urllib.robotparser import RobotFileParser

def is_crawling_allowed(url, user_agent="ElevendotsPulse/1.0"):
    """Check if robots.txt allows us to crawl this URL."""
    rp = RobotFileParser()
    from urllib.parse import urlparse
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp.set_url(robots_url)
    rp.read()
    return rp.can_fetch(user_agent, url)
```

### 2. Respect snippet control directives

When fetching og:description, also check for these meta tags:

```html
<!-- Publisher says: don't show any snippet -->
<meta name="robots" content="nosnippet">

<!-- Publisher says: max 120 characters of snippet -->
<meta name="robots" content="max-snippet:120">

<!-- Publisher marks specific elements as no-snippet -->
<span data-nosnippet>This text should not be used as a snippet.</span>
```

Our crawler should:
- If `nosnippet` is present → fall back to `title_only` mode
- If `max-snippet:N` is present → truncate preview to N characters
- If `data-nosnippet` is on the description element → skip it

### 3. Identify our crawler honestly

Every HTTP request includes:

```
User-Agent: ElevendotsPulse/1.0 (News Aggregator; https://elevendots.dev; support@elevendots.ai)
```

This lets publishers:
- Identify our traffic in their logs
- Reach out if they want changes
- Add specific rules for us in their robots.txt

### 4. Rate limiting

- RSS sources: fetch at most once per crawl cycle (every 3 hours)
- HTML sources: fetch at most once per crawl cycle
- Never make more than 1 request per second to any single domain
- Add a 1-2 second delay between requests to the same domain

```python
import time
from collections import defaultdict

last_request_time = defaultdict(float)

def rate_limited_fetch(url, domain):
    """Ensure at least 1.5 seconds between requests to the same domain."""
    elapsed = time.time() - last_request_time[domain]
    if elapsed < 1.5:
        time.sleep(1.5 - elapsed)
    response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    last_request_time[domain] = time.time()
    return response
```

### 5. Content limits

| Data Point          | Max Length | Source                  |
|---------------------|-----------|-------------------------|
| Title               | 300 chars | RSS title / HTML h1-h3  |
| Preview/intro text  | 300 chars | RSS description / og:description |
| Source name          | 100 chars | Config file             |
| Tags/subsections    | 10 items  | Config file             |
| Article body text   | **NEVER** | **NEVER STORED**        |
| Publisher images     | **NEVER** | **NEVER STORED** unless RSS media:content with explicit license |

---

## Publisher Relations

### Removal / Opt-Out Process

The site footer includes:
```
Sources can request changes or removal: contact@elevendots.dev
```

Response SLA: within 48 hours for removal requests.

### What we do when a publisher asks for removal

1. Immediately remove the source from `sources.yaml`
2. Trigger a rebuild to remove their content from the live site
3. Add them to a `blocked_sources.yaml` to prevent re-addition
4. Respond to confirm removal

### What we do NOT do

- We do not argue fair use with publishers
- We do not ignore removal requests
- We do not require legal justification from publishers
- If they don't want to be listed, we remove them. Period.

---

## Logo and Branding Policy

- By default, we do NOT display publisher logos (set `logo_allowed: false`)
- We use text-only source names (e.g., "DigiTimes", "SemiAnalysis")
- If a publisher provides explicit permission to use their logo, we set
  `logo_allowed: true` and store the logo in `site/public/logos/`
- We never modify, crop, or recolor publisher logos
- We never use logos in a way that implies endorsement or partnership

---

## Future Considerations

### If you add affiliate links or sponsored placements

The FTC requires clear disclosure of material connections. If any link is
an affiliate link or if any source placement is paid/sponsored, add a visible
disclosure like:

```
This link is an affiliate link. We may earn a commission at no cost to you.
```

or

```
[Sponsored] This source placement is a paid partnership.
```

### If you add AI-generated summaries

If you ever use an LLM to summarize articles (beyond the publisher's own
preview text), this changes the legal calculus significantly. AI-generated
summaries of copyrighted articles may not qualify as the "publicly exposed
metadata" safe harbor. Consult an attorney before adding this feature.

### If you grow to significant traffic

At scale (>100k monthly visitors), publishers may start paying attention.
This is actually good — it means you're driving meaningful referral traffic
to them. But it's also when you should invest in:
- Formal partnership agreements with major sources
- A media/IP attorney on retainer
- Publisher analytics dashboard (show them how much traffic you send)

---

## Pre-Launch Checklist

- [ ] Every source has a `policy` block in sources.yaml
- [ ] Crawler respects robots.txt for all HTML-scraped sources
- [ ] Crawler checks for nosnippet / max-snippet directives
- [ ] Crawler User-Agent includes contact email
- [ ] Rate limiting enforced (1.5s minimum between same-domain requests)
- [ ] Preview text capped at 300 characters from public metadata only
- [ ] No publisher images stored or displayed (unless RSS media:content)
- [ ] No article body text stored anywhere in the pipeline
- [ ] Footer includes removal contact email
- [ ] robots.txt on elevendots.dev allows search engines
- [ ] One-hour legal review with IP attorney (recommended but not required)

---

## Summary

The product is a **discovery surface**, not a content platform.
We help publishers reach readers. We help readers find publishers.
We never substitute for the original source.

That is a legitimate, well-established business model.
