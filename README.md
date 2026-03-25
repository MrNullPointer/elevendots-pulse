# Pulse by ElevenDots — Knowledge Navigator

**v2.0 Alpha** · [pulse.elevendots.dev](https://pulse.elevendots.dev)

A curated knowledge navigator that aggregates the latest news, research, and ideas across technology, science, philosophy, world affairs, and more. Updated every hour from 165+ sources.

Signal over noise, shaped into clarity.

---

## What is Pulse?

Pulse is a **freshness-first news and research aggregator** that surfaces the most recent articles and academic papers from trusted sources. It's designed for people who want to stay current across multiple domains without the noise of social media or algorithmic feeds.

### Sections

| Section | What it covers | Sources |
|---------|---------------|---------|
| **Tech** | Computing, chips, AI, systems, and emerging hardware | 74 sources across 29 topics |
| **Research** | Academic papers and preprints from arXiv and OpenAlex | 19 sources across 11 topics |
| **Science** | Astronomy, chemistry, biology, physics, and beyond | 39 sources |
| **Philosophy** | Ideas, ethics, mind, knowledge, and meaning | 8 sources |
| **World** | Global news, politics, economics, and geopolitics | 11 sources |
| **Miscellaneous** | Essays, culture, long reads, and uncategorized gems | 14 sources |

### Key Features

- **Freshness-aware ranking** — Articles sorted by publication time with confidence scoring. Unknown dates are demoted, not promoted.
- **Research intelligence** — Academic papers from arXiv (15 CS/Physics categories) and OpenAlex (journal + conference papers). Frontier and Must Read filters highlight bleeding-edge preprints and high-impact publications.
- **Sort control** — Switch between Newest, Oldest, and Important (research section) with one click on any section page.
- **Subsection filtering** — Drill into specific topics (e.g., AI & ML, Semiconductor, Quantum Computing) within each section.
- **Time filtering** — Show articles from the last 1h, 6h, 12h, 24h, or 48h.
- **Search** — ⌘K fuzzy search across all article titles and intros.
- **Dark mode first** — Premium dark theme with light mode support. Neural constellation background, liquid glass UI, cinematic startup reveal.
- **Static and fast** — No server at runtime. All data baked into a JSON artifact at build time. Deployed to GitHub Pages CDN.
- **Privacy-respecting** — No cookies, no tracking scripts, no analytics. Visit counts come from GitHub's built-in traffic stats.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/MrNullPointer/elevendots-pulse.git
cd elevendots-pulse
pip install -r crawler/requirements.txt
cd site && npm install && cd ..

# Run the crawler
python -m crawler.main

# Copy data and start dev server
cp data/articles.json site/public/articles.json
cd site && npm run dev
```

The site will be available at `http://localhost:5173`.

---

## Architecture

```
config/sources.yaml → Python Crawler → data/articles.json → Vite Build → GitHub Pages
                           ↑                                                    ↑
                   GitHub Actions (hourly)                            pulse.elevendots.dev
```

- **Sources**: Configured in `config/sources.yaml`. RSS/Atom feeds, HTML scrapers, and OpenAlex API.
- **Crawler**: Python pipeline that fetches, deduplicates, scores freshness, and writes JSON.
- **Frontend**: React + Vite + Tailwind CSS static site. Loads JSON at runtime, renders with client-side filtering.
- **Deploy**: GitHub Actions runs hourly — tests, crawls, builds, and deploys to GitHub Pages.

### Adding Sources

Edit `config/sources.yaml` and push. The next crawl picks it up automatically. Each source needs:

```yaml
- name: "Source Name"
  url: "https://example.com/feed/"
  type: rss          # rss, html, or openalex
  section: tech      # tech, research, science, philosophy, world, misc
  subsections: [ai, ml]
  tier: free         # free, freemium, paid
  policy:
    preview_mode: rss_description
    robots_txt_checked: true
    tos_reviewed: true
```

---

## Research Section

The Research section surfaces academic papers from two source types:

- **arXiv RSS** (15 categories) — CS and Physics preprints, updated daily
- **OpenAlex API** (4 queries) — Journal and conference papers for topics arXiv doesn't cover (semiconductors, EDA, power devices)

### Research-Specific Features

- **Frontier** — Preprints published in the last 48 hours. The absolute bleeding edge.
- **Must Read** — Papers with significant citation counts, indicating community validation.
- **Important sort** — Ranks Must Read first, then Frontier, then by freshness.

### Compliance

All research sources are metadata-only. No full-text storage, no PDF hosting. Papers link to their canonical publisher or repository pages. arXiv RSS is permissive for metadata. OpenAlex data is CC0.

---

## Design

Pulse uses a premium dark-first design language inspired by neural networks and liquid glass:

- **Neural background** — 11 animated glass-sphere nodes connected by curved filaments on a Canvas 2D layer.
- **Startup reveal** — Cinematic glass veil with neural melt transition on page load.
- **Liquid glass UI** — Frosted translucent surfaces for navigation and filters. Solid opaque cards for content readability.
- **Section-aware theming** — Background gradients, neural node colors, and accents shift per section.

---

## Documentation

| File | Contents |
|------|----------|
| `README.md` | This file — project overview and quick start |
| `CONTENT-POLICY.md` | Legal compliance, content policy, and ethical guidelines |
| `GUIDE.md` | Build guide and prerequisites |
| `reports/` | Architecture design reports and source audits |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Crawler | Python 3.12, feedparser, requests, BeautifulSoup, PyYAML |
| Frontend | React 18, Vite, Tailwind CSS, Fuse.js, Lucide Icons |
| Hosting | GitHub Pages (static) |
| CI/CD | GitHub Actions (hourly cron) |
| Domain | pulse.elevendots.dev (custom domain via Squarespace DNS) |

---

## License

MIT

---

**Pulse v2.0 Alpha** · Built by [elevendots.dev](https://elevendots.dev) · Made with 🤖 in San Diego
