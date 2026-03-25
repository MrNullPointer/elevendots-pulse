# Pulse — Build & Development Guide

**v2.0 Alpha**

---

## Prerequisites

- Python 3.12+ (`python --version`)
- Node.js 20+ (`node --version`)
- Git (`git --version`)
- A GitHub account with Pages enabled

---

## Local Development

### 1. Install dependencies

```bash
pip install -r crawler/requirements.txt
cd site && npm install && cd ..
```

### 2. Run the crawler

```bash
python -m crawler.main
```

This crawls all enabled sources in `config/sources.yaml` and writes `data/articles.json`. Takes 5-7 minutes depending on network.

### 3. Start the dev server

```bash
cp data/articles.json site/public/articles.json
cd site && npm run dev
```

Open `http://localhost:5173`.

### 4. Run tests

```bash
# Python tests (compliance, freshness, OpenAlex adapter)
python -m pytest tests/ -v

# Frontend tests (components, integration, hooks)
cd site && npx vitest run
```

---

## Project Structure

```
elevendots-pulse/
├── config/
│   └── sources.yaml          # All sources, sections, and subsections
├── crawler/
│   ├── main.py               # Crawl orchestrator
│   ├── feed_parser.py        # RSS/Atom feed parser
│   ├── html_scraper.py       # HTML source scraper
│   ├── openalex_adapter.py   # OpenAlex API adapter (research papers)
│   ├── freshness.py          # Timestamp normalization and scoring
│   ├── deduplicator.py       # URL + title deduplication
│   ├── intro_fetcher.py      # Article intro/summary fetcher
│   ├── robots_checker.py     # robots.txt compliance
│   └── utils.py              # Rate limiting, user agent, helpers
├── data/
│   ├── articles.json         # Crawled articles (generated)
│   └── source_health.json    # Per-source health metrics (generated)
├── site/
│   ├── public/               # Static assets (favicons, OG cards, data)
│   ├── src/
│   │   ├── App.jsx           # Main app with routing and section pages
│   │   ├── components/       # React components
│   │   ├── hooks/            # Data loading, filtering, scroll reveal
│   │   └── index.css         # All styles (glass, neural, animations)
│   ├── index.html            # Entry point with OG meta tags
│   └── vite.config.js        # Vite build configuration
├── scripts/
│   ├── generate_section_og.py    # Section-specific OG HTML pages
│   └── fetch_traffic_stats.py    # GitHub traffic stats fetcher
├── tests/                    # Python test suite
├── .github/workflows/        # CI/CD pipeline
├── CONTENT-POLICY.md         # Legal and ethical compliance
└── README.md                 # Project overview
```

---

## Configuration

All sources, sections, and subsections are defined in `config/sources.yaml`. The crawler reads this file on every run.

### Adding a new source

Append to the `sources:` list:

```yaml
- name: "My Source"
  url: "https://example.com/feed/"
  type: rss
  section: tech
  subsections: [ai, ml]
  tier: free
  policy:
    preview_mode: rss_description
    robots_txt_checked: true
    tos_reviewed: true
```

### Adding a new subsection

Add to `subsections_metadata:`:

```yaml
my-subsection:
  display_name: "My Subsection"
  section: tech
  color: "#6366f1"
  order: 40
```

### Adding a new section

Add to `sections_metadata:` and create at least one source using that section.

---

## Deployment

The site deploys automatically via GitHub Actions on every push to `main` and on an hourly cron schedule.

### Pipeline: Test → Crawl → Deploy

1. **Test** — Runs compliance tests (`tests/test_compliance.py`)
2. **Crawl** — Runs the crawler with an 8-minute time budget
3. **Deploy** — Builds the React app, generates section OG pages, deploys to GitHub Pages

### Custom Domain

The site is served at `pulse.elevendots.dev` via a CNAME record pointing to GitHub Pages. The `site/public/CNAME` file persists this across deploys.

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `MAX_CRAWL_TIME` | 480 | Maximum crawl duration in seconds |
| `CRAWL_TIMEOUT` | 15 | Per-source HTTP timeout in seconds |
| `MAX_ARTICLES_PER_SOURCE` | 50 | Cap on articles per source |
| `MAX_AGE_HOURS` | 168 | Maximum article age (7 days) |

---

## Source Types

| Type | Description | Example |
|------|-------------|---------|
| `rss` | Standard RSS/Atom feed | arXiv, TechCrunch, Ars Technica |
| `html` | HTML page with CSS selectors | Sites without RSS feeds |
| `openalex` | OpenAlex Works API query | Academic paper search by keyword |

---

**Pulse v2.0 Alpha** · [pulse.elevendots.dev](https://pulse.elevendots.dev)
