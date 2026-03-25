# ElevenDots Pulse — Source Strategy: World News, Politics, Economics & Science Expansion

**Date:** 2026-03-25
**Auditor:** Claude Opus 4.6 (automated feed validation)
**Branch:** `feat/source-strategy-world-news-expansion`

---

## Executive Summary

The current catalog (155 sources, 126 enabled) is heavily skewed toward **tech** (60%) and **science** (24%). There is **zero dedicated coverage** of world news, U.S. politics, geopolitics, macroeconomics, or public health. The `misc` section is an overloaded catch-all carrying policy, defense, cybersecurity, energy, and podcasts under one label.

This audit identifies **20 new Grade-A sources** — all validated via live feedparser with confirmed RSS/Atom feeds returning proper timestamps and descriptions. These sources fill five critical gaps:

1. **World headlines** (BBC, DW, Al Jazeera, Guardian)
2. **U.S. politics** (NPR Politics, Politico, Guardian US)
3. **Geopolitics / conflict** (Crisis Group, Foreign Affairs)
4. **Economics** (NPR Economy)
5. **Medicine / public health / research** (Nature, Science AAAS, PNAS, Lancet, WHO, CDC, medRxiv, bioRxiv)

We recommend creating a new top-level section **`world`** to house news, politics, economics, and geopolitics. This decongests `misc` and gives the front page a proper news section.

---

## Part 1: Current Source Catalog Audit

### Inventory Summary

| Metric | Count |
|--------|-------|
| Total sources | 155 |
| Enabled | 126 |
| Disabled | 29 |
| RSS/Atom | 135 (116 enabled) |
| HTML | 20 (10 enabled) |

### By Section

| Section | Total | Enabled | Disabled | % of Enabled |
|---------|-------|---------|----------|-------------|
| tech | 95 | 74 | 21 | 59% |
| science | 37 | 30 | 7 | 24% |
| misc | 15 | 14 | 1 | 11% |
| philosophy | 8 | 8 | 0 | 6% |

### Structural Issues

1. **No world news section.** Zero coverage of world headlines, U.S. politics, geopolitics, or macroeconomics.
2. **`misc` is overloaded.** Currently carries: policy (6), cybersecurity (8), space-exploration (7), energy (5), defense (1), podcasts (8), maker (1). These are unrelated domains forced into one bucket.
3. **Science skewed toward astro/climate.** Astronomy has 17 sources. Medicine has 0. Public health has 0. Institutional research news has 0.
4. **Disabled YouTube block (17 sources)** clutters the config. All return 404.
5. **8 enabled podcasts** occupy crawl time but are poor freshness-first fits (low cadence, long content).
6. **121/155 sources have `robots_txt_checked: false`** — a compliance debt.

### Sources Currently Covering Policy/Defense/Economics

| Source | Section | Subsections |
|--------|---------|-------------|
| Lawfare | misc | policy, cybersecurity |
| War on the Rocks | misc | policy, defense |
| Rest of World | misc | policy |
| CISA Advisories | misc | cybersecurity, policy |
| The Space Review | misc | space-exploration, policy |
| SIA Blog | tech | semiconductor, policy |

**Total policy-adjacent sources: 6.** None are dedicated news organizations. None cover world affairs, U.S. politics, or economics.

---

## Part 2: Taxonomy Recommendations

### Proposal: Add `world` Section

Create a new top-level section for news, politics, economics, and geopolitics.

**Rationale:**
- The project goal is a "knowledge navigator." Knowledge includes understanding what's happening in the world, not just in tech.
- `misc` currently absorbs policy/defense/geopolitics by default. This is unsustainable.
- World news sources publish at high cadence with reliable timestamps — ideal for freshness-first aggregation.

**Proposed `world` subsections:**

| Subsection | Description |
|------------|-------------|
| `world-news` | Global headlines, breaking news |
| `us-politics` | U.S. domestic policy and governance |
| `geopolitics` | International relations, conflict, diplomacy |
| `economics` | Macroeconomics, trade, development |
| `public-policy` | Institutional policy analysis |

### Proposed Science Subsection Additions

| Subsection | Description |
|------------|-------------|
| `medicine` | Medical research, clinical news |
| `public-health` | Epidemiology, WHO/CDC, health policy |
| `preprints` | Pre-peer-review research (medRxiv, bioRxiv) |
| `physics` | Dedicated physics coverage (Nature Physics already exists, subsection does not) |

---

## Part 3: Validated Source Additions

All sources below were validated with **live feedparser** on 2026-03-25. Every feed returned HTTP 200, valid XML, items with `pubDate`/`published` timestamps, and descriptions > 30 chars.

### Tier 1: Add Now (Grade A, fully validated)

#### World / Politics / Geopolitics

| # | Source | Feed URL | Items | Avg Desc | Cadence | Confidence |
|---|--------|----------|-------|----------|---------|------------|
| 1 | BBC World News | `feeds.bbci.co.uk/news/world/rss.xml` | 40 | 115c | Hourly | A |
| 2 | Deutsche Welle | `rss.dw.com/rdf/rss-en-all` | 136 | 181c | Hourly | A |
| 3 | Al Jazeera | `aljazeera.com/xml/rss/all.xml` | 25 | 112c | Hourly | A |
| 4 | The Guardian World | `theguardian.com/world/rss` | 45 | 1070c | Hourly | A |
| 5 | The Guardian US News | `theguardian.com/us-news/rss` | 33 | 1102c | Hourly | A |
| 6 | NPR World | `feeds.npr.org/1004/rss.xml` | 10 | 178c | Daily+ | A |
| 7 | NPR Politics | `feeds.npr.org/1014/rss.xml` | 10 | 156c | Daily+ | A |
| 8 | NPR Economy | `feeds.npr.org/1017/rss.xml` | 10 | 176c | Daily+ | A |
| 9 | Politico | `rss.politico.com/politics-news.xml` | 30 | 134c | Daily+ | A |
| 10 | Foreign Affairs | `foreignaffairs.com/rss.xml` | 20 | 53c | Weekly+ | A |
| 11 | International Crisis Group | `crisisgroup.org/rss.xml` | 10 | 1920c | Weekly+ | A |

#### Science / Medicine / Research

| # | Source | Feed URL | Items | Avg Desc | Cadence | Confidence |
|---|--------|----------|-------|----------|---------|------------|
| 12 | Nature | `nature.com/nature.rss` | 75 | 242c | Daily | A |
| 13 | Nature Medicine | `nature.com/nm.rss` | 8 | 398c | Weekly | A |
| 14 | Science / AAAS News | `science.org/rss/news_current.xml` | 10 | 105c | Daily | A |
| 15 | PNAS | `pnas.org/action/showFeed?type=etoc&feed=rss&jc=pnas` | 103 | 291c | Weekly | A |
| 16 | The Lancet | `thelancet.com/rssfeed/lancet_current.xml` | 27 | 559c | Weekly | A |
| 17 | WHO News | `who.int/rss-feeds/news-english.xml` | 25 | 2327c | Daily | A |
| 18 | CDC Newsroom | `tools.cdc.gov/api/v2/resources/media/316422.rss` | 54 | 297c | Daily | A |
| 19 | medRxiv | `connect.medrxiv.org/medrxiv_xml.php?subject=all` | 30 | 1986c | Daily | A |
| 20 | bioRxiv | `connect.biorxiv.org/biorxiv_xml.php?subject=all` | 30 | 1553c | Daily | A |

### Tier 2: Validate First (Operationally uncertain)

| Source | Issue | Recommendation |
|--------|-------|----------------|
| Chatham House | All feed URLs return 403. | Defer. No public RSS. |
| CFR | Feed returned 0 items from feedparser. | Defer until content confirmed. |
| IMF Blog/News | All URLs return 403. Blocks crawlers. | Defer. |
| VoxEU / CEPR | All URLs return 404. Site restructured. | Defer. |
| Bruegel | All URLs return 404. | Defer. |
| PIIE | All URLs return 403. | Defer. |
| World Bank | Feed returns HTML, not XML. | Defer. |
| OECD | All URLs return 403. | Defer. |
| NIH News | Feed URL returns 404. | Defer. |
| EurekAlert | API returns 404. | Defer. |
| Reuters | Requires authentication (401). Licensed feed. | Skip. |
| AP News | Only available via 3rd-party mirror (feedx.net). | Skip — not official. |

### Tier 3: Skip

| Source | Reason |
|--------|--------|
| Reuters | No public RSS. Licensed product. |
| AP News | No official public feed. 3rd-party mirror unreliable. |
| heise.de / Golem.de | German language — not aligned with English-first catalog. |
| ITmedia | Japanese language. |
| Xataka | Spanish language. |

---

## Part 4: Crawl Budget Impact

| Metric | Current | After Addition |
|--------|---------|----------------|
| Enabled sources | 126 | 146 |
| New RSS sources | — | +20 |
| New HTML sources | — | 0 |
| Estimated new crawl time | — | +12s (20 × 0.6s median) |
| Estimated total crawl time | ~265s | ~277s |
| Budget headroom (480s) | 215s | 203s |

All 20 new sources are RSS with `rss_description` preview mode — zero page fetches, minimal crawl cost.

---

## Part 5: Risks and Assumptions

1. **Foreign Affairs is freemium.** Some articles are paywalled. The RSS feed provides titles and short descriptions for all articles. Marked as `tier: freemium`.
2. **medRxiv/bioRxiv are preprints.** Not peer-reviewed. Clear labeling with `preprints` subsection.
3. **Deutsche Welle uses RDF 1.0 format.** feedparser handles it correctly (validated).
4. **Nature uses RDF with 303 redirects.** feedparser follows redirects correctly (validated).
5. **BBC World is high-volume.** 40+ items per fetch. MAX_ARTICLES_PER_SOURCE=50 cap will apply.
6. **Al Jazeera editorial perspective** may differ from other outlets. Included for geographic diversity.
7. **Guardian has generous RSS.** Full descriptions (~1000 chars). Good freshness fit.

---

## Part 6: Files Changed

| File | Change |
|------|--------|
| `config/sources.yaml` | +20 sources, +1 section (`world`), +5 subsections |
| `reports/source-strategy-world-news-2026-03-25.md` | This report |

---

## Part 7: Rollout Plan

1. Merge this PR with the config patch.
2. Trigger a crawl run.
3. Verify on the live site that:
   - New `world` section appears with articles from BBC, DW, Guardian, etc.
   - Science section gains Nature, Lancet, WHO, CDC articles.
   - No existing sources are broken.
4. Monitor crawl time — should remain under 300s.
5. In a future PR, consider:
   - Moving Lawfare, War on the Rocks, Rest of World from `misc` to `world` section.
   - Moving CISA from `misc` to `world` under `public-policy` + `cybersecurity`.
   - Retiring disabled YouTube block entirely.

---

*Report generated by Claude Opus 4.6 automated analysis pipeline.*
