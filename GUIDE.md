# Elevendots-Pulse — Step-by-Step Build Guide

## What You're Building

A config-driven tech/science/philosophy news aggregator with an Apple Liquid Glass
UI, hosted for free on GitHub Pages, updated every 3 hours via GitHub Actions.

**Total cost**: ~$11/year (domain only)
**Stack**: Python crawler + React/Vite/Tailwind frontend + GitHub Actions CI/CD
**Hosting**: GitHub Pages (free, even for private repos)

---

## Prerequisites

Before you start, make sure you have:

- [ ] A GitHub account
- [ ] Node.js 20+ installed locally (`node --version`)
- [ ] Python 3.12+ installed locally (`python --version`)
- [ ] Git installed (`git --version`)
- [ ] Claude Code CLI installed (`claude --version`) OR access to ChatGPT Codex
- [ ] A code editor (VS Code recommended)

---

## Phase 0: Initial Setup (You Do This Manually — 10 minutes)

### Step 1: Create the GitHub repository

1. Go to https://github.com/new
2. Name it `elevendots-pulse` (or whatever you want)
3. Set it to **Private**
4. Do NOT initialize with README (we'll push our own)
5. Click "Create repository"

### Step 2: Clone and set up locally

```bash
# Clone the empty repo
git clone https://github.com/YOUR_USERNAME/elevendots-pulse.git
cd elevendots-pulse

# Copy ALL the starter files from this package into the repo
# (Unzip elevendots-pulse-final.zip and copy everything into this directory)

# Verify the structure looks right
ls -la
# You should see: .github/ crawler/ config/ site/ scripts/ data/ etc.
```

### Step 3: Install dependencies

```bash
# Python crawler dependencies
pip install -r crawler/requirements.txt

# React site dependencies
cd site
npm install
cd ..
```

### Step 4: Test the crawler locally

```bash
python -m crawler.main
# Should output: "Elevendots-Pulse Crawler" header, crawl each source, write data/articles.json
# First run might take 2-3 minutes. Some sources may fail — that's normal.
```

### Step 5: Test the site locally

```bash
cp data/articles.json site/public/articles.json
cd site
npm run dev
# Opens at http://localhost:5173 — you should see the site with real data!
```

### Step 6: Push to GitHub

```bash
cd ..  # back to repo root
git add .
git commit -m "Initial commit: crawler + config + site scaffold"
git push origin main
```

### Step 7: Enable GitHub Pages

1. Go to your repo → Settings → Pages
2. Source: "GitHub Actions" (not "Deploy from a branch")
3. That's it — the workflow will handle deployment

### Step 8: Trigger the first deployment

1. Go to your repo → Actions tab
2. Click "Crawl & Deploy" workflow
3. Click "Run workflow" → "Run workflow"
4. Wait ~5 minutes for it to complete
5. Your site is now live at `https://YOUR_USERNAME.github.io/elevendots-pulse/`

### Step 9: (Optional) Connect your custom domain

1. In the GitHub Actions workflow file, uncomment the `cname` line:
   ```yaml
   cname: elevendots.dev
   ```
2. In your domain registrar (Squarespace/Cloudflare), add A records:
   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```
3. Add a CNAME record: `www` → `YOUR_USERNAME.github.io`
4. Push. Wait 10-30 minutes for DNS propagation.

---

## Phase 1: Build the Crawler (Claude Code Session 1)

The starter files include a working crawler. But if you want to enhance it
or if something breaks, here's the prompt to use:

### Open Claude Code in your project directory:

```bash
cd elevendots-pulse
claude
```

### Paste this prompt:

```
I'm building a Python news crawler for a tech/science/philosophy news aggregator.

## Context
- The crawler reads config/sources.yaml which defines news sources hierarchically
- Each source has: name, url, type (rss or html), section, subsections, tier, and policy
- The crawler outputs data/articles.json which the React frontend consumes

## What exists already
- config/sources.yaml — fully populated with ~60 sources
- crawler/main.py — basic entry point
- crawler/feed_parser.py — RSS parsing with feedparser
- crawler/html_scraper.py — HTML scraping with BeautifulSoup
- crawler/deduplicator.py — URL + title-similarity dedup

## What I need you to do

1. Review all existing crawler files and fix any issues.

2. Add a `fetch_intro()` function in a new file `crawler/intro_fetcher.py` that:
   - Takes an article URL and any RSS summary text
   - Priority 1: If RSS summary exists and is >50 chars, clean HTML tags and return it (capped at 300 chars)
   - Priority 2: Fetch only the first 20KB of the article page (use `stream=True, resp.raw.read(20000)`)
   - Check for `nosnippet` meta tag — if present, return empty string
   - Check for `max-snippet:N` meta tag — if present, cap at N chars
   - Extract `og:description` or `<meta name="description">` content
   - Return the intro text, capped at 300 chars
   - On any error, return empty string (never crash)

3. Add `robots.txt` checking in a new file `crawler/robots_checker.py`:
   - Before crawling any HTML source, check if robots.txt allows our User-Agent
   - User-Agent: "ElevendotsPulse/1.0 (News Aggregator; https://elevendots.dev; support@elevendots.ai)"
   - Cache robots.txt results per domain for the duration of the crawl
   - If disallowed, skip the source and log a warning

4. Add rate limiting in `crawler/utils.py`:
   - Track last request time per domain
   - Enforce minimum 1.5 seconds between requests to the same domain
   - Add a `rate_limited_get(url)` helper function

5. Update `crawler/main.py` to:
   - Use the new intro_fetcher, robots_checker, and rate limiting
   - Include `intro` field in each article's output
   - Include `section` and `subsections` fields (read from source config)
   - Add source_health entries with status: ok/empty/blocked/error
   - Write a clean articles.json with the full schema

6. The article output schema should be:
{
  "id": "sha256_16chars",
  "title": "Article Title",
  "url": "https://...",
  "intro": "First 300 chars of publicly exposed preview text",
  "source": "Source Name",
  "section": "tech",
  "subsections": ["memory", "hbm", "fab"],
  "tier": "free|freemium|paid",
  "published": "2026-03-23T08:30:00Z",
  "age_hours": 4.2,
  "also_from": ["OtherSource1"]
}

7. Test by running: python -m crawler.main
```

---

## Phase 2: Build the React Frontend (Claude Code Session 2 — THE BIG ONE)

This is the main vibecoding session. Open Claude Code and paste this prompt:

```
I'm building a news aggregator frontend with React + Vite + Tailwind CSS.
The design follows Apple's Liquid Glass aesthetic (iOS 26 / WWDC 2025).

## Project location
- Site code goes in: site/src/
- Config: site/vite.config.js, site/tailwind.config.js, site/package.json (already exist)
- Data: site/public/articles.json (already exists with real crawled data)

## Architecture overview

This is a STATIC site (no server, no API calls at runtime). All data comes from
articles.json which is generated by a Python crawler and baked in at build time.
The site is deployed to GitHub Pages as static HTML/CSS/JS.

## Data schema

articles.json has this structure:
{
  "generated_at": "ISO8601",
  "article_count": 142,
  "source_health": [...],
  "articles": [
    {
      "id": "abc123",
      "title": "Article headline",
      "intro": "First 300 chars of preview text from RSS or og:description",
      "url": "https://publisher.com/article",
      "source": "DigiTimes",
      "section": "tech",
      "subsections": ["memory", "hbm", "fab"],
      "tier": "free",
      "published": "2026-03-23T08:30:00Z",
      "age_hours": 4.2,
      "also_from": ["TrendForce", "SemiEngineering"]
    }
  ]
}

sections are: "tech", "science", "philosophy", "misc"
tiers are: "free", "freemium", "paid"

## Design system: Apple Liquid Glass

Core principles:
- Chrome (navigation, search, filters) = frosted translucent glass with backdrop-filter blur
- Content (article cards) = solid, opaque, highly readable — NOT translucent
- Background = animated gradient mesh that shifts color based on active section
- Motion = spring-based easing (cubic-bezier(0.22, 1, 0.36, 1)), restrained and physical
- No hard borders anywhere — separation via blur differential and subtle shadows

### Section-aware ambient color (gradient mesh shifts per section):
- Tech → cool cobalt/cyan: radial-gradient with rgba(59,107,223,0.12) and rgba(99,102,241,0.08)
- Science → deep violet/indigo: radial-gradient with rgba(124,58,237,0.12) and rgba(167,139,250,0.08)
- Philosophy → warm amber/bronze: radial-gradient with rgba(180,83,9,0.12) and rgba(245,158,11,0.08)
- Miscellaneous → neutral smoke: radial-gradient with rgba(82,82,82,0.1) and rgba(120,113,108,0.06)

### CSS design tokens:
```css
:root {
  /* Glass surfaces */
  --glass-bg: rgba(255, 255, 255, 0.58);
  --glass-bg-light: rgba(255, 255, 255, 0.38);
  --glass-bg-subtle: rgba(255, 255, 255, 0.22);
  --glass-blur: 28px;
  --glass-border: 0.5px solid rgba(255, 255, 255, 0.3);
  --glass-border-highlight: 0.5px solid rgba(255, 255, 255, 0.5);
  
  /* Content cards (OPAQUE — not glass) */
  --card-bg: rgba(255, 255, 255, 0.88);
  --card-border: 0.5px solid rgba(0, 0, 0, 0.06);
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03);
  --card-radius: 14px;
  
  /* Animation */
  --spring: cubic-bezier(0.22, 1, 0.36, 1);
  --spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 200ms;
  --duration-medium: 350ms;
  
  /* Section accent colors */
  --accent-tech: #3b6bdf;
  --accent-science: #7c3aed;
  --accent-philosophy: #b45309;
  --accent-misc: #525252;
}

/* Dark mode */
[data-theme="dark"] {
  --glass-bg: rgba(30, 30, 30, 0.65);
  --glass-bg-light: rgba(30, 30, 30, 0.45);
  --glass-bg-subtle: rgba(30, 30, 30, 0.3);
  --glass-border: 0.5px solid rgba(255, 255, 255, 0.07);
  --card-bg: rgba(40, 40, 40, 0.85);
  --card-border: 0.5px solid rgba(255, 255, 255, 0.06);
}
```

### Typography:
- Display font: "DM Sans" (import from Google Fonts) — weights 300, 400, 500
- Mono font: "JetBrains Mono" for badges and metadata
- NEVER use Inter, Roboto, Arial, or system fonts as primary
- Site title: 18px weight 500, letter-spacing -0.3px
- Card title: 14px weight 500, line-height 1.4
- Card intro: 12.5px weight 400, color secondary, line-height 1.55
- Badges: 9.5px uppercase, letter-spacing 0.4px

## Page structure

### HOMEPAGE (default route: /)

The homepage is a "knowledge cockpit" — NOT just a filtered feed.
It shows the breadth of all sections at a glance.

Layout (top to bottom):

1. **GlassNavbar** (sticky top)
   - Left: Site logo "elevendots.dev" (the "eleven" and "." in accent color)
   - Center: Section tabs: [Tech] [Science] [Philosophy] [Misc]
     - These are glass pills. Active tab has brighter glass + highlight border.
     - On homepage, NO tab is active (or "Home" is active).
     - On section page, that section's tab is active.
   - Right: Search button (shows "⌘K"), theme toggle (☀/☾)
   - The entire navbar is a glass surface with backdrop-filter blur

2. **Hero section** (2-column grid on desktop, stacked on mobile)
   - Left card: Featured story from Tech (the most recent article with lowest age_hours)
   - Right card: Featured story from Science
   - Cards are SOLID (--card-bg), not glass. They show:
     - Section label with colored dot: "Featured in Tech"
     - Title (16px, bold)
     - Intro text (13px, muted, 2-line clamp)
     - Footer: source name + tier badge + age

3. **Trending topics strip** (horizontal scrollable glass bar)
   - A glass-surface bar with horizontally scrollable pills
   - Shows trending subsection names derived from articles:
     count articles per subsection, pick the top 8-10
   - Example pills: "HBM4" "Samsung strike" "ASML packaging" "CPO"
   - Clicking a pill navigates to that subsection within its parent section

4. **Section shelves** (one per section)
   - Each shelf has:
     - Header: colored dot + "Tech" + short description + "See all N →" link
     - 3-column card grid (desktop) / horizontal scroll (mobile) showing top 3 stories
     - Cards are SOLID, showing: title, intro (2-line clamp), source, tier badge, tags, age
   - Sections displayed in order: Tech, Science, Philosophy, Misc

5. **Quick Preview Panel** (below the shelves)
   - A glass-surface panel that shows expanded details when any card is clicked
   - Shows: title (larger), full intro text (not clamped), all tags as pills,
     source + tier + age + also_from, and a prominent "Open on [SourceName] →" button
   - On desktop, this could be a right-side panel. For v1, bottom panel is fine.
   - Clicking the "Open" button opens the article URL in a new tab

6. **Footer bar**
   - "Updated Xh ago · N sources · next refresh in Yh"
   - "Sources can request removal: contact@elevendots.dev"

### SECTION PAGE (route: /tech, /science, /philosophy, /misc)

When user clicks a section tab, show the full section page:

1. **GlassNavbar** (same, but with this section's tab active)

2. **SubsectionBar** (glass surface, below navbar)
   - Horizontal scrollable pills for all subsections in this section
   - Derived dynamically: collect all unique subsections from articles in this section
   - Each pill shows: subsection name + article count
   - First pill is always "All" (shows total count)
   - Clicking a pill filters the article grid below

3. **TimeFilter bar** (small buttons)
   - [1h] [6h] [12h] [24h] [48h] [All]
   - Filters articles by age_hours
   - Default: "All" selected

4. **AccessFilter** (optional, small toggle)
   - [All] [Free] [Paid]
   - Filters by tier field

5. **ArticleGrid** (main content area)
   - Single-column list of ArticleCards
   - Each card shows: title, intro (2-line clamp), source, tier badge, subsection tags, age, also_from
   - Cards are SOLID (--card-bg), not glass
   - Cards are clickable links that open the article URL in a new tab
   - Hover: subtle translateY(-1px) with spring easing
   - Cards sorted by age_hours ascending (freshest first)

6. **SourceHealth dashboard** (collapsible section at bottom)
   - Shows each source's name, last crawl time, article count, status (green/yellow/red dot)
   - Glass surface background

## Component list

Build these React components:

1. `App.jsx` — Root component. Loads articles.json, manages state (activeSection, activeSubsection, timeFilter, searchQuery, previewArticle). Uses React Router for section routes.

2. `components/GlassNavbar.jsx` — Sticky nav with logo, section tabs, search, theme toggle.

3. `components/SectionTabs.jsx` — The section tab pills inside the navbar.

4. `components/SubsectionBar.jsx` — Subsection filter pills. Receives the active section, derives subsections from articles, shows counts.

5. `components/TimeFilter.jsx` — Time filter buttons.

6. `components/AccessFilter.jsx` — Free/Paid toggle.

7. `components/HeroSection.jsx` — Two featured story cards for the homepage.

8. `components/TrendingStrip.jsx` — Trending topics horizontal scroll bar.

9. `components/SectionShelf.jsx` — A shelf for one section (header + 3-card grid). Used on homepage.

10. `components/ArticleCard.jsx` — Individual article card. Props: article object. Shows title, intro, source, tier badge, tags, age, also_from. Click opens URL in new tab.

11. `components/ArticleGrid.jsx` — Grid/list of ArticleCards with filtering applied.

12. `components/PreviewPanel.jsx` — Expanded article preview. Glass surface. Shows full intro, all tags, "Open on Source →" button.

13. `components/SourceHealth.jsx` — Collapsible source status dashboard.

14. `components/SearchOverlay.jsx` — ⌘K search modal. Glass surface with blur. Fuzzy search using fuse.js across titles and intros. Shows results as a list. Press Enter or click to open article.

15. `components/ThemeToggle.jsx` — Light/dark mode toggle. Stores preference in localStorage.

16. `components/GradientMesh.jsx` — The animated background gradient. Changes color based on active section.

## Hooks

17. `hooks/useArticles.js` — Fetch and parse articles.json. Return: articles array, sections array, subsections-per-section map, source health array, generated_at timestamp.

18. `hooks/useFilters.js` — Manage filter state: activeSection, activeSubsection, timeFilter, accessFilter, searchQuery. Return filtered articles array.

## Key behaviors

- Clicking a section tab on the homepage → navigates to /tech (or /science etc.)
- Clicking "See all N →" on a shelf → same as clicking the section tab
- Clicking a subsection pill → filters within current section
- Clicking a time filter → filters by age_hours
- Clicking an article card → opens article URL in new tab (target="_blank")
- Clicking a card while holding Alt/Option → opens the PreviewPanel instead
- ⌘K (or Ctrl+K) → opens SearchOverlay
- Escape → closes SearchOverlay
- j/k keys → navigate between articles (optional, nice-to-have)
- Theme toggle → switches data-theme attribute on document root

## Tier badges styling:
- free: background rgba(22,163,74,0.1), text #15803d (dark: #4ade80)
- freemium: background rgba(59,130,246,0.1), text #1d4ed8 (dark: #60a5fa)
- paid: background rgba(245,158,11,0.12), text #b45309 (dark: #fbbf24), add small lock icon

## Mobile responsive:
- Below 768px: single column layout
- Section shelves: horizontal scroll instead of 3-column grid
- Subsection pills: horizontal scroll
- No preview panel on mobile — cards directly open the URL
- Navbar: collapse search to icon-only, keep section tabs scrollable

## Dependencies to install:
- react-router-dom (for section routing)
- fuse.js (for fuzzy search)
- lucide-react (for icons — lock, sun, moon, search, external-link, etc.)
- framer-motion (for spring animations — optional but nice)

## Build output:
- Vite builds to site/dist/
- The dist/ folder is what gets deployed to GitHub Pages
- articles.json must be in site/public/ before build (it gets copied to dist/)

## CRITICAL RULES:
- No server-side code. This is 100% static.
- No API calls at runtime. All data comes from articles.json.
- No external analytics or tracking scripts.
- Article cards link to the PUBLISHER's URL, never to an internal page.
- Never display publisher logos unless explicitly allowed.
- Never reproduce article body text — only title + intro (max 300 chars from public metadata).
- The site must work with JavaScript disabled for basic content (progressive enhancement).

Please build all components, set up React Router, wire everything together,
and make sure `npm run dev` shows a working site. Start with the layout shell
and routing, then build each component one by one.
```

---

## Phase 3: Polish & Interactivity (Claude Code Session 3)

After Phase 2 is working, paste this prompt for polish:

```
The Elevendots-Pulse news aggregator frontend is working. Now I need polish and interactivity.

## Current state
- React + Vite + Tailwind site is functional
- Section routing works
- Article cards display with titles, intros, tier badges
- Basic filtering by section and subsection works

## What I need added/improved:

### 1. Search overlay (⌘K)
- Triggered by ⌘K (Mac) or Ctrl+K (Windows/Linux)
- Glass-surface modal with heavy backdrop blur
- Text input at top, auto-focused
- Use fuse.js to fuzzy search across article titles and intros
- Show top 10 results as mini-cards (title + source + section badge)
- Clicking a result opens the article URL in a new tab
- Escape closes the overlay
- Up/Down arrow keys navigate results, Enter opens selected

### 2. Keyboard navigation
- j key: move focus to next article card
- k key: move focus to previous article card
- Enter: open focused article in new tab
- ? key: show keyboard shortcuts help (small glass tooltip)

### 3. Smooth section transitions
- When switching sections, the gradient mesh should smoothly transition
  colors (use CSS transition on the background with 800ms ease)
- Article grid should have a subtle fade-in when content changes
- Subsection pills should animate in with staggered delays

### 4. Article card hover effects
- On hover: translateY(-2px) with spring easing, border brightens slightly
- On hover: show a subtle "↗" external link icon in the top-right corner
- For paid articles: the lock icon should have a subtle shimmer on hover

### 5. Trending topics computation
- Derive trending topics from the articles data:
  - Count articles per subsection in the last 12 hours
  - Pick the top 8 subsections by count
  - Also detect "clusters": if 3+ articles share similar titles (use simple
    word overlap), create a cluster topic with the shared keyword
- Show trending topics in the TrendingStrip on the homepage

### 6. "Also from" indicator
- If an article has also_from sources, show them as a muted italic line:
  "+2 from TrendForce, SemiEngineering"
- On hover, show a tooltip listing all sources

### 7. Source health dashboard improvements
- Collapsible (default collapsed, click to expand)
- Show sources in a grid: name, articles found, last crawled, status dot
- Green dot: articles found > 0
- Yellow dot: articles found == 0 but no error
- Red dot: error during crawl

### 8. Progressive enhancement
- The site should show article titles even if JavaScript fails to load
  (use SSG-friendly patterns, or at minimum, a <noscript> message)
- Add proper <title> and <meta description> tags for SEO
- Add Open Graph tags so the site previews well when shared on social media

### 9. Performance
- Lazy-load articles below the fold (use Intersection Observer)
- Debounce the search input (300ms)
- Memoize filtered article lists (useMemo)

### 10. Accessibility
- All interactive elements have proper aria labels
- Focus rings on keyboard navigation
- Color contrast meets WCAG AA
- Screen reader friendly: article cards use semantic <article> tags
```

---

## Phase 4: CI/CD Pipeline (Claude Code Session 4)

The GitHub Actions workflow is already in the starter files. But if you need
to modify it, use this prompt:

```
Review and improve the GitHub Actions workflow at .github/workflows/crawl-and-deploy.yml.

Current workflow:
- Runs on cron every 3 hours AND on manual workflow_dispatch
- Checks out repo, sets up Python 3.12, installs crawler deps
- Runs the crawler (python -m crawler.main)
- Commits articles.json to the repo
- Sets up Node 20, installs site deps
- Copies articles.json to site/public/
- Builds the site (npm run build in site/)
- Deploys site/dist/ to GitHub Pages using peaceiris/actions-gh-pages

Please verify:
1. The cron expression is correct for every 3 hours: '0 */3 * * *'
2. The Python and Node caching is properly configured
3. The git commit step handles "nothing to commit" gracefully
4. The GITHUB_TOKEN permissions are sufficient
5. The workflow has proper error handling (if crawler fails, don't deploy stale data)
6. Add a step that validates articles.json is valid JSON before building
7. Add a step that checks articles.json has > 0 articles before deploying
8. The workflow respects the private repo's Actions minute budget

Also check if there's a CNAME file needed for custom domain deployment.
```

---

## Phase 5: Testing & Launch

### Test locally one more time

```bash
# Run crawler
python -m crawler.main

# Copy data
cp data/articles.json site/public/articles.json

# Build production site
cd site
npm run build

# Preview production build
npx serve dist
# Open http://localhost:3000 and verify everything works
```

### Push and deploy

```bash
cd ..
git add .
git commit -m "Complete build: crawler + UI + CI/CD"
git push origin main
```

### Verify GitHub Actions

1. Go to repo → Actions tab
2. The workflow should trigger automatically
3. Wait for it to complete (~5 minutes)
4. Visit your GitHub Pages URL to verify the live site

### Connect custom domain (if ready)

1. Uncomment `cname: elevendots.dev` in the workflow file
2. Configure DNS (see Phase 0, Step 9)
3. Push and wait for DNS propagation

---

## Ongoing Maintenance

### Adding a new source

Edit `config/sources.yaml`:
```yaml
  - name: "New Source"
    url: "https://newsource.com/feed"
    type: rss
    section: tech
    subsections: [ai, robotics]
    tier: free
    policy:
      preview_mode: rss_description
      robots_txt_checked: true
      tos_reviewed: false
```

Push. Next crawl picks it up automatically.

### Adding a new subsection (e.g., "Photonics")

Just add `photonics` to any source's `subsections` list in sources.yaml.
Optionally add metadata in the subsections_metadata section.
Push. The UI auto-discovers it.

### Adding a new section (e.g., "Finance")

1. Add to `sections_metadata` in sources.yaml
2. Add some subsections under it
3. Add sources with `section: finance`
4. Push. New tab appears.

### Monitoring

- Check the Actions tab weekly for failed runs
- Check source_health in articles.json for sources that return 0 articles
- Update CSS selectors if HTML-scraped sources redesign their pages
