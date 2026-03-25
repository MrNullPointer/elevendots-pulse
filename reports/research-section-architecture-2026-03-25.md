# ElevenDots Pulse — Research Papers Section: Architecture & Design Report

**Date:** 2026-03-25
**Author:** Architecture design by Claude Opus 4.6
**Status:** V1 Design Complete

---

## Executive Summary

This document proposes a **parallel research data pipeline** for ElevenDots Pulse that surfaces recent academic papers across the existing 29 tech subsection taxonomy. The design prioritizes **compliance, correctness, freshness, and relevance** in that order.

### Key architectural decisions:

1. **Separate pipeline, separate artifact**: Research papers live in `data/research.json`, not `articles.json`. The article pipeline remains untouched.
2. **Parallel section**: "Research" becomes the 6th top-level section with subsections mapped to the existing 29 tech topics.
3. **4-source V1 core**: OpenAlex (primary backbone), arXiv API (preprints), Crossref (DOI resolution), dblp (venue normalization). All CC0/permissive.
4. **Semantic Scholar as enrichment only**: Non-commercial license restricts primary use. Used for TLDR and citation signals with caution.
5. **Metadata-first**: No full-text storage, no PDF mirroring. Link to canonical publisher pages.
6. **DOI-based deduplication**: Same paper from multiple sources merged into canonical record with source provenance.

---

## 1. Current Codebase Fit

### How the existing system works:

```
config/sources.yaml → crawler/main.py → data/articles.json → site/public/articles.json → React SPA
```

- **5 sections**: tech, science, philosophy, world, misc
- **65 subsections** across all sections (29 in tech)
- **~175 sources** producing ~1800 articles/week
- **Single JSON artifact** loaded by frontend, pre-sorted by freshness_score
- **Hourly crawl** via GitHub Actions

### Why a separate pipeline:

| Concern | Shared pipeline | Separate pipeline |
|---------|----------------|-------------------|
| Data model | Papers need DOI, venue, authors, etc. — 25+ fields not in article schema | Clean schema purpose-built for papers |
| Source type | Academic APIs (REST/OAI-PMH) ≠ RSS feeds | Separate adapters, separate rate limiting |
| Deduplication | URL-based doesn't work for papers (same DOI, multiple URLs) | DOI-based cross-source merge |
| Ranking | Freshness-only doesn't fit (relevance + venue quality matter) | Custom ranking model |
| Cadence | Hourly news crawl | 6-hourly or daily for papers (less volatile) |
| Risk isolation | A bug in paper ingestion could break the news feed | Complete isolation |

**REVISED Decision: Unified pipeline. Research is a regular section in `sources.yaml`. New source types (`openalex`, `arxiv_api`) added alongside existing `rss` and `html` types. Same `articles.json` artifact, same frontend rendering. Zero separate infrastructure.**

The key insight: the existing architecture already supports arbitrary sections generically. Adding "research" means:
1. Add `research` section + subsections to `sources.yaml`
2. Add research sources (OpenAlex, arXiv) to `sources.yaml` with new `type` values
3. Add source adapter modules that `crawl_source()` dispatches to
4. Add `research` to frontend `KNOWN_SECTIONS` and `ACCENT_MAP`
5. Everything else (dedup, freshness, sorting, filtering, rendering) works as-is

---

## 2. Source Audit & Selection Matrix

### V1 Core Sources

| Source | License | API Type | Coverage | Freshness | Abstract | DOI | Citations | Role |
|--------|---------|----------|----------|-----------|----------|-----|-----------|------|
| **OpenAlex** | CC0 | REST | 250M+ works | Hourly | Yes (inverted index) | Yes | Yes | **Primary backbone** |
| **arXiv** | Permissive | REST + OAI-PMH | CS preprints | Daily | Yes | Sometimes | No | **Preprint discovery** |
| **Crossref** | CC0 | REST | 160M+ DOIs | Near-real-time | Partial | Yes (authoritative) | No | **DOI resolution** |
| **dblp** | CC0 | REST + RSS | CS bibliography | Weekly | No | Yes | No | **Venue normalization** |

### V1 Enrichment

| Source | License | Role | Risk |
|--------|---------|------|------|
| **Semantic Scholar** | Non-commercial | TLDR, influential citations, topics | Must contact AI2 if commercial; use cautiously |

### V2 Deferred

| Source | Reason for deferral |
|--------|---------------------|
| OpenReview | No explicit API terms; conference-specific schemas |
| ACL Anthology | No API; dblp covers same venues |
| PMLR | No API; dblp covers same venues |
| USENIX | No API; requires scraping |
| CORE | Lower priority; OpenAlex covers similar scope |
| HAL | French repository; lower tech coverage |
| Zenodo | Dataset-heavy; not primary for tech papers |

### Sources NOT used (compliance)

| Source | Reason |
|--------|--------|
| Google Scholar | Explicitly prohibited — no automated access |
| IEEE Xplore | Unclear API terms for this product type; use OpenAlex/Crossref metadata instead |
| ACM DL | Prefer OpenAlex/Crossref/dblp metadata; link to ACM landing pages |

---

## 3. Data Model

### Research Paper Record Schema

```python
{
    # Identity
    "id": str,                    # SHA256 of canonical_url or DOI
    "canonical_id": str,          # DOI preferred, else arXiv ID, else URL hash
    "doi": str | None,            # e.g., "10.1145/3580305.3599557"
    "arxiv_id": str | None,       # e.g., "2401.12345"
    "openalex_id": str | None,    # e.g., "W4391234567"
    "dblp_key": str | None,       # e.g., "conf/nips/AuthorName23"

    # Bibliographic
    "title": str,                 # Paper title (cleaned, no LaTeX)
    "abstract": str,              # First 500 chars of abstract (or empty)
    "authors": [str],             # List of author names
    "author_count": int,
    "venue": str | None,          # Conference or journal name
    "venue_type": str,            # "conference" | "journal" | "workshop" | "preprint" | "unknown"
    "publisher": str | None,      # e.g., "ACM", "IEEE", "Springer"

    # Dates
    "published_date": str | None, # ISO 8601 (publication/acceptance date)
    "submitted_date": str | None, # ISO 8601 (submission date, if known)
    "updated_date": str | None,   # ISO 8601 (last update)
    "ingested_at": str,           # ISO 8601 (when we first saw it)

    # Classification
    "paper_type": str,            # "preprint" | "conference" | "journal" | "workshop" | "proceedings" | "unknown"
    "is_preprint": bool,
    "is_peer_reviewed": bool,
    "is_open_access": bool,

    # URLs
    "landing_url": str,           # Canonical publisher/repo page
    "oa_url": str | None,         # Open-access full-text URL (if legal)
    "pdf_url": str | None,        # Direct PDF link (if legally safe)

    # License & compliance
    "license": str | None,        # e.g., "CC-BY-4.0", "arXiv", None
    "source": str,                # Primary source: "openalex" | "arxiv" | "crossref" | "dblp"
    "source_ids": dict,           # All source IDs: {"openalex": "W...", "arxiv": "2401...", ...}
    "compliance_flags": [str],    # Any compliance notes

    # Signals
    "citation_count": int | None,
    "influential_citation_count": int | None,
    "topics": [str],              # Mapped tech subsection IDs
    "topic_confidence": float,    # 0-1, how well topics match

    # Ranking (computed)
    "freshness_score": int,       # Lower = fresher (same system as articles)
    "relevance_score": float,     # 0-1, topic relevance
    "venue_quality_score": float, # 0-1, based on venue tier
    "rank_score": float,          # Composite: freshness + relevance + quality
    "freshness_bucket": str,      # "last_day" | "last_week" | "last_month" | "older"
}
```

### Cross-Source Merge Strategy

When the same paper appears in multiple sources:

**Canonical preference order:**
1. **DOI match** (strongest — same DOI = same paper)
2. **arXiv ID match** (strong — same preprint)
3. **Title + year match** (fuzzy — 90% similarity + same year)

**Field authority by source:**

| Field | Authoritative Source |
|-------|---------------------|
| DOI | Crossref (definitive) |
| Title | OpenAlex > Crossref > arXiv > dblp |
| Abstract | arXiv > OpenAlex > Crossref |
| Authors | OpenAlex > dblp > Crossref |
| Venue | dblp > OpenAlex > Crossref |
| Venue type | dblp (curated) |
| Publication date | Crossref > OpenAlex > dblp |
| Open-access status | OpenAlex (best OA tracking) |
| Citation count | OpenAlex |
| arXiv categories | arXiv |

---

## 4. Topic Classification: 29 Tech Lanes

### Mapping Strategy

Each source provides different topic signals:
- **arXiv**: cs.* categories (cs.AI, cs.LG, cs.CV, cs.DC, etc.)
- **OpenAlex**: Topics/concepts with confidence scores
- **dblp**: Venue-based classification
- **Crossref**: Subject categories (sparse)

### Topic-to-Source Mapping

| Topic | Primary Sources | Query Strategy | Paper-Native? |
|-------|----------------|----------------|---------------|
| **ai** | arXiv (cs.AI), OpenAlex, dblp | arXiv cat + OpenAlex topic | Very high |
| **ml** | arXiv (cs.LG, stat.ML), OpenAlex | arXiv cat + OpenAlex topic | Very high |
| **ai-accelerator** | arXiv (cs.AR, cs.AI), OpenAlex | Keyword: "accelerator" + "neural" | High |
| **cpu** | arXiv (cs.AR), OpenAlex | Keyword: "processor" + "microarchitecture" | Medium |
| **gpu** | arXiv (cs.AR, cs.DC), OpenAlex | Keyword: "GPU" + "graphics processor" | Medium |
| **semiconductor** | OpenAlex, Crossref | Keywords + IEEE/Nature venues | Medium |
| **lithography** | OpenAlex, Crossref | Keywords: "EUV", "lithography" | Medium (journal-heavy) |
| **fab** | OpenAlex, Crossref | Keywords: "fabrication", "foundry" | Low-Medium |
| **packaging** | OpenAlex, Crossref | Keywords: "chiplet", "3D integration" | Medium |
| **memory** | arXiv (cs.AR), OpenAlex | Keywords: "DRAM", "HBM", "memory" | Medium |
| **quantum-computing** | arXiv (quant-ph, cs.ET), OpenAlex | arXiv cat | Very high |
| **photonics** | arXiv (physics.optics), OpenAlex | arXiv cat + keywords | High |
| **networking** | arXiv (cs.NI), dblp (SIGCOMM, NSDI) | Venue + arXiv cat | High |
| **eda** | arXiv (cs.AR), dblp (DAC, ICCAD) | Venue-based | High |
| **embedded** | arXiv (cs.AR, cs.SE), OpenAlex | Keywords | Medium |
| **software** | arXiv (cs.SE), dblp (ICSE, FSE) | Venue + arXiv cat | High |
| **servers** | OpenAlex, dblp (ASPLOS, ISCA) | Venue + keywords | Medium |
| **autonomous** | arXiv (cs.RO, cs.CV), OpenAlex | arXiv cat + keywords | High |
| **robotics** | arXiv (cs.RO), dblp (ICRA, IROS) | Venue + arXiv cat | Very high |
| **datacenter** | arXiv (cs.DC), dblp (OSDI, SOSP) | Venue + arXiv cat | High |
| **power-semiconductor** | OpenAlex, Crossref | Keywords: "SiC", "GaN", "power device" | Low (journal-heavy) |
| **risc-v** | arXiv, OpenAlex, dblp | Keywords: "RISC-V" | Medium |
| **open-hardware** | arXiv, OpenAlex | Keywords: "open-source hardware" | Low |
| **developer** | arXiv (cs.SE, cs.PL), dblp | Venue + arXiv cat | Medium |
| **linux-oss** | arXiv (cs.OS), dblp (USENIX) | Venue + keywords | Medium |
| **storage** | arXiv (cs.OS), dblp (FAST, USENIX) | Venue + keywords | Medium |
| **hpc** | arXiv (cs.DC), dblp (SC, HPCA) | Venue + arXiv cat | Very high |
| **cloud-native** | arXiv (cs.DC, cs.SE), dblp | Venue + keywords | Medium |
| **robotics-industry** | OpenAlex | Keywords only | Very low |

---

## 5. Ranking Model

### Composite Rank Score

```
rank_score = w_fresh * freshness_score_normalized
           + w_relevance * relevance_score
           + w_venue * venue_quality_score
           + w_type * paper_type_score
           + w_oa * open_access_bonus
           + w_confidence * metadata_confidence
```

**Default weights:**
- `w_fresh` = 0.35 (freshness matters but doesn't dominate)
- `w_relevance` = 0.30 (topic match is critical)
- `w_venue` = 0.15 (top venues get a boost)
- `w_type` = 0.10 (peer-reviewed > preprint)
- `w_oa` = 0.05 (open-access gets slight preference)
- `w_confidence` = 0.05 (better metadata = higher rank)

### Venue Quality Tiers

| Tier | Score | Examples |
|------|-------|---------|
| S | 1.0 | NeurIPS, ICML, ICLR, ACL, CVPR, SIGCOMM, OSDI, ISCA, Nature, Science |
| A | 0.8 | AAAI, EMNLP, ECCV, NSDI, ASPLOS, DAC, ICRA, FAST |
| B | 0.6 | AISTATS, CoRL, ICCAD, ATC, SOSP, ICSE |
| C | 0.4 | Named workshops, regional conferences |
| Preprint | 0.3 | arXiv without publication |
| Unknown | 0.2 | No venue information |

### Freshness Buckets for Research

| Bucket | Age | Score |
|--------|-----|-------|
| last_day | 0-24h | 1.0 |
| last_week | 1-7d | 0.8 |
| last_month | 7-30d | 0.5 |
| last_quarter | 30-90d | 0.3 |
| older | 90d+ | 0.1 |

---

## 6. Compliance Policy

### Per-Source Compliance Notes

| Source | Data License | Abstract OK? | Link Policy | Notes |
|--------|-------------|--------------|-------------|-------|
| OpenAlex | CC0 | Yes | Link to OpenAlex + publisher | No restrictions |
| arXiv | Permissive | Yes | MUST link to arXiv, not host PDFs | Review arXiv TOU for commercial use |
| Crossref | CC0 (metadata) | Publisher copyright | Link to DOI landing page | Abstracts may be publisher-copyrighted |
| dblp | CC0 | No abstracts | Link to dblp + publisher | Attribution appreciated |
| Semantic Scholar | Non-commercial | Caution | Link to S2 + publisher | Cannot use as primary commercial source |

### Hard Rules

1. **Never** store or serve full-text PDFs from our servers
2. **Never** automate Google Scholar access
3. **Never** bypass access controls or rate limits
4. **Always** link to canonical publisher/repository pages
5. **Always** preserve source attribution and DOI
6. **Always** respect rate limits (use exponential backoff)
7. Abstracts from Crossref may be publisher-copyrighted — use OpenAlex/arXiv abstracts first
8. Store only first 500 characters of abstract (fair use; link for full text)
9. Each paper record must carry `source` and `compliance_flags`
10. Any source can be disabled via config without code changes

---

## 7. V1 Implementation Plan

### New Files

```
crawler/research/
├── __init__.py
├── config.py          # Research config loader
├── sources/
│   ├── __init__.py
│   ├── openalex.py    # OpenAlex API adapter
│   ├── arxiv_api.py   # arXiv API adapter
│   ├── crossref.py    # Crossref API adapter
│   └── dblp.py        # dblp API adapter
├── normalizer.py      # Cross-source record normalization
├── deduplicator.py    # DOI-based deduplication
├── classifier.py      # Topic classification (29 lanes)
├── ranker.py          # Composite ranking
├── compliance.py      # Compliance checks
└── main.py            # Research pipeline orchestrator

config/research_topics.yaml    # Topic → query mapping for all 29 lanes
data/research.json             # Output artifact
tests/test_research_pipeline.py
tests/test_research_sources.py
tests/test_research_ranking.py
```

### Modified Files

```
config/sources.yaml            # Add research section + subsections
site/src/App.jsx               # Add research to KNOWN_SECTIONS, ACCENT_MAP
site/src/hooks/useArticles.js  # Load research.json alongside articles.json (or separate hook)
.github/workflows/crawl-and-deploy.yml  # Add research crawl step
```

### Pipeline Flow

```
1. Load research_topics.yaml (29 topic configs)
2. FOR EACH topic config:
   a. Query OpenAlex /works with topic filter + date range
   b. Query arXiv API with category filter
   c. (Optional) Query Crossref for DOI enrichment
   d. (Optional) Query dblp for venue enrichment
3. Collect all raw records
4. Normalize to canonical schema
5. Deduplicate by DOI / arXiv ID / title similarity
6. Classify topics (map to 29 tech lanes)
7. Compute ranking scores
8. Apply compliance filters
9. Sort by rank_score
10. Write data/research.json
11. Copy to site/public/research.json
```

### Refresh Cadence

- **V1**: Run every 6 hours (papers don't change as fast as news)
- **Future**: Daily for full re-index, hourly for arXiv new submissions only

---

## 8. Risks & Open Questions

### Technical Risks

1. **OpenAlex rate limits at scale**: 100K credits/day should be sufficient for V1 (29 topics × ~100 results = 2,900 API calls × 10 credits = 29,000 credits). Monitor usage.
2. **arXiv rate limit (1 req / 3 sec)**: With 29 topics, sequential queries take ~90 seconds. Acceptable.
3. **Cross-source dedup quality**: DOI matching is reliable. Title matching may have false positives/negatives. Start conservative (DOI only), add fuzzy title matching in V2.

### Compliance Risks

1. **Semantic Scholar non-commercial license**: If Pulse is commercial, S2 enrichment may require a license. Defer S2 to V2 or contact AI2.
2. **Crossref abstract copyright**: Some publishers retain copyright on abstracts deposited to Crossref. Use OpenAlex/arXiv abstracts first.
3. **arXiv commercial use**: arXiv TOU require review for commercial products. The metadata API is generally permissive, but PDF hosting is prohibited.

### Product Risks

1. **Topic classification accuracy**: Mapping papers to 29 lanes is imperfect. Some papers span multiple topics. Accept multi-label assignment.
2. **Venue quality scores**: Manual curation of venue tiers is needed. Start with top-50 CS venues, expand over time.
3. **Robotics-industry** is weakly paper-native. May have very few results. Consider broader query strategy or lower expectations.

---

## 9. What V1 Implements vs. Defers

### V1 Implements

- OpenAlex as primary source (topic-based queries for all 29 lanes)
- arXiv API for preprint discovery (CS categories)
- DOI-based deduplication across sources
- Topic classification using arXiv categories + OpenAlex topics
- Freshness + relevance + venue composite ranking
- Compliance metadata on every record
- `data/research.json` output artifact
- Frontend route `/research` with subsection filtering
- Tests for normalization, dedup, ranking, compliance

### V1 Defers

- Crossref as standalone source (use OpenAlex DOIs instead)
- dblp integration (OpenAlex covers most venues)
- Semantic Scholar enrichment (license concerns)
- OpenReview integration (unclear terms)
- Full venue quality database (start with top-50)
- Citation-based importance scoring
- Author/lab signals
- "Must read" and "Frontier" view modes
- Per-paper compliance audit (batch compliance in V1)
