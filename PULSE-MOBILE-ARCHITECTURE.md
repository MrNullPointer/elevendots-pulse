# Pulse Mobile — End-to-End Architecture Document

**Version:** 2.0.0
**Date:** March 26, 2026
**Author:** Rishi (Elevendots)
**Status:** Design Complete — Ready for Implementation

---

## 1. Executive Summary

Pulse Mobile is the native app counterpart to [pulse.elevendots.dev](https://pulse.elevendots.dev), a news aggregator that crawls 165+ sources hourly across six editorial sections: Tech, Research, Science, Philosophy, World, and Miscellaneous.

### The Architecture in One Sentence

Pulse Mobile is a **shared Expo + React Native app core** over a **versioned static mobile feed hosted on GitHub Pages**, with a **small separate push control plane** and **later native widget extensions**.

Everything else in this document makes that sentence operational.

### Why This Architecture

Pulse is not a generic mobile reader. It is a **precomputed intelligence surface**. Its core value lives upstream: source discovery, crawl reliability, timestamp normalization, freshness scoring, deduplication, taxonomy, and ranking. The app should not recreate those decisions. It should consume them. The system should remain **upstream-heavy** and **client-light**.

### Five Architectural Planes

| Plane | Responsibility | Technology |
|-------|---------------|------------|
| **Content generation** | Crawl, rank, dedupe, normalize, emit canonical content | Python crawler, GitHub Actions |
| **Feed hosting** | Serve versioned, read-only mobile JSON artifacts | GitHub Pages |
| **Client** | Reading experience, search, saved items, offline cache, deep links | Expo / React Native |
| **Event** | Token registration, subscription storage, diff evaluation, push delivery | Cloudflare Worker + D1 |
| **Native edge** | Widgets and OS-specific surfaces that must be native | WidgetKit (Swift), Glance (Kotlin) |

### Target Platforms

- iOS 17+ (iPhone + iPad) — Phase 1
- Android 14+ (phone + tablet) — Phase 5
- No watchOS, tvOS, or macOS in scope

---

## 2. Frozen Architectural Decisions

These are treated as settled unless later evidence forces change:

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Main app core: Expo + React Native | Android is confirmed; avoids 2x native codebases |
| 2 | Read-path host: GitHub Pages | Zero cost, already deployed, globally cached |
| 3 | Push backend: Cloudflare Worker + D1 | Tiny, cheap, globally reachable, sufficient for diff+send |
| 4 | Saved articles in v1: local only | No accounts, no sync, no backend scope creep |
| 5 | User identity in v1: anonymous installation model | Device token only, no PII |
| 6 | Search: local device-side over cached search index | No server-side search needed |
| 7 | Article detail rights: metadata + excerpt + open source | Do not architect as full content host |
| 8 | Widgets: after app core and push stabilize | Not on v1 critical path |
| 9 | No Live Activities | Hourly refresh doesn't match ActivityKit's bounded-event model |
| 10 | No background refresh dependence | iOS BGAppRefreshTask is system-discretionary and unreliable |
| 11 | No on-device crawling or ranking | Keep expensive computation in CI, not on battery-constrained devices |

---

## 3. System Architecture

### 3.1 High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  CONTENT GENERATION PLANE (existing, unchanged)                     │
│                                                                     │
│  config/sources.yaml                                                │
│       │                                                             │
│       ▼                                                             │
│  Python Crawler (GitHub Actions, hourly cron at :07)                │
│  crawler/main.py → feed_parser / html_scraper / openalex_adapter    │
│       │                                                             │
│       ▼                                                             │
│  Ranking → Freshness scoring → Deduplication → Normalization        │
│       │                                                             │
│       ▼                                                             │
│  data/articles.json + data/source_health.json                       │
└───────┬─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BUILD STEP (new + existing)                                        │
│                                                                     │
│  ┌─────────────────────────┐    ┌──────────────────────────────┐   │
│  │  Vite Build (existing)  │    │  build_mobile_feed.py (NEW)  │   │
│  │  Web SPA, OG cards      │    │  Reads articles.json         │   │
│  │  section HTML, 404      │    │  Fetches LIVE prev manifest  │   │
│  └────────────┬────────────┘    │  Computes diffs + hashes     │   │
│               │                 │  Writes mobile feed files     │   │
│               │                 │  Validates against schemas    │   │
│               │                 └───────────────┬──────────────┘   │
└───────────────┼─────────────────────────────────┼──────────────────┘
                │                                 │
                ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FEED HOSTING PLANE  —  pulse.elevendots.dev (GitHub Pages)         │
│                                                                     │
│  Web Assets (existing)          │  Mobile Feed Contract (NEW)       │
│  ├── index.html                 │  ├── mobile/manifest.json         │
│  ├── assets/                    │  ├── mobile/home.json             │
│  ├── og/                        │  ├── mobile/sections/tech.json    │
│  └── favicon.*                  │  ├── mobile/sections/science.json │
│                                 │  ├── mobile/sections/...          │
│                                 │  ├── mobile/search-index.json     │
│                                 │  ├── mobile/changes.json          │
│                                 │  └── (articles/<id>.json  P2)     │
└────────────┬────────────────────┼──────────────┬────────────────────┘
             │                    │              │
             │       ┌────────────┘              │
             │       │     ┌─────────────────────┘
             ▼       ▼     ▼
┌──────────────────────────┐      ┌──────────────────────────────────┐
│  CLIENT PLANE            │      │  EVENT PLANE                     │
│  Expo / React Native     │◄─────│  Cloudflare Worker + D1          │
│                          │ APNs │                                  │
│  iOS + iPadOS + Android  │ FCM  │  ├── Register installations      │
│                          │      │  ├── Store subscriptions          │
│  ├── Tab navigation      │      │  ├── Receive signed CI webhook   │
│  ├── Section lists       │      │  ├── Diff changes → subs         │
│  ├── Article detail      │      │  ├── Send via Expo Push API      │
│  ├── Search (fuse.js)    │      │  ├── Poll receipts               │
│  ├── Saved articles      │      │  └── Prune dead tokens           │
│  ├── Local cache (MMKV)  │      │                                  │
│  ├── Pull-to-refresh     │      │  Triggered by: GH Actions POST   │
│  ├── Push handler        │      │  Auth: HMAC-signed webhooks      │
│  └── Widget snapshot     │      └──────────────────────────────────┘
│         writer           │
│         │                │
└─────────┼────────────────┘
          │
          ▼
┌───────────────────────────────────────┐
│  NATIVE EDGE PLANE                    │
│                                       │
│  iOS: WidgetKit (Swift)               │
│  Android: Glance (Kotlin)             │
│                                       │
│  Read from shared App Group cache     │
│  Timeline reload ~15-60min (budgeted) │
│  Tap → deep link into app             │
└───────────────────────────────────────┘
```

### 3.2 What Would Be Wrong for Pulse

| Bad Approach | Why |
|-------------|-----|
| On-device crawling or ranking | Pushes network variance, parser breakage, robots logic, and ranking inconsistency onto battery-constrained, least-debuggable devices |
| Single giant `articles.json` for mobile | Not cache-efficient, search-efficient, or section-efficient for mobile |
| Two fully native apps as primary plan | Duplicates too much surface area for a solo developer |
| Web wrapper (Capacitor) | Underdelivers on quality, weakens offline/search/save, increases App Review risk |
| Relying on background refresh | iOS grants BGAppRefreshTask at its discretion — may happen once/hr or not at all |

---

## 4. Mobile Feed Contract

**This is the most important part of the design. Do not start app implementation until this contract is frozen.**

### 4.1 Contract Design Principles

1. **Manifest first** — Every app launch begins with the manifest, not section payloads.
2. **Changed slices only** — Re-fetch only sections/indexes whose hashes changed.
3. **Stable IDs** — Article IDs must remain stable across builds when logical identity is unchanged.
4. **Version everything** — `feed_schema_version` is mandatory in the manifest.
5. **Additive evolution** — Never silently rename or remove fields once the app ships.
6. **Search is explicit** — Search must not require downloading every large section file first.
7. **Deep links are first-class** — Pushes and widgets resolve directly to stable routes.

### 4.2 Article ID Strategy

This is a make-or-break decision. The ID must be stable across builds, deterministic, and insensitive to harmless cosmetic metadata changes.

**Algorithm:**

```python
import hashlib
from urllib.parse import urlparse, urlunparse

def compute_article_id(section: str, url: str, title: str, published_date: str) -> str:
    """
    Deterministic article ID. Stable across builds for the same logical article.
    """
    # Primary: normalized canonical URL
    parsed = urlparse(url)
    normalized_url = urlunparse((
        parsed.scheme.lower(),
        parsed.netloc.lower().rstrip('.'),
        parsed.path.rstrip('/'),
        '', '', ''  # strip params, query, fragment
    ))

    url_hash = hashlib.sha256(normalized_url.encode()).hexdigest()[:12]
    return f"{section}-{url_hash}"

    # Fallback (if URL is missing/unstable):
    # title_fingerprint = hashlib.sha256(title.lower().strip().encode()).hexdigest()[:8]
    # date_bucket = published_date[:10] if published_date else "unknown"
    # return f"{section}-{title_fingerprint}-{date_bucket}"
```

**Rules:**
- IDs must NOT depend on crawler-run order
- IDs must NOT change when metadata (intro, freshness_score) changes
- IDs must be URL-safe (lowercase alphanumeric + hyphens)
- The same article URL must always produce the same ID

### 4.3 Feed File Specifications

#### `mobile/manifest.json`

First file fetched on every app launch. Tells the app what changed.

```json
{
  "feed_schema_version": 1,
  "build_id": "2026-03-26T14:07:00Z",
  "generated_at": "2026-03-26T14:07:00Z",
  "min_supported_app_version": "1.0.0",
  "sections": {
    "tech":       { "hash": "a3f8c2d1", "count": 87, "updated_at": "2026-03-26T14:07:00Z" },
    "science":    { "hash": "b7e1f4a9", "count": 42, "updated_at": "2026-03-26T13:07:00Z" },
    "philosophy": { "hash": "c2d5e8f3", "count": 18, "updated_at": "2026-03-26T14:07:00Z" },
    "world":      { "hash": "d9a3b6c1", "count": 55, "updated_at": "2026-03-26T14:07:00Z" },
    "research":   { "hash": "e4f7a2b5", "count": 63, "updated_at": "2026-03-26T14:07:00Z" },
    "misc":       { "hash": "f1c8d4e7", "count": 31, "updated_at": "2026-03-26T12:07:00Z" }
  },
  "indexes": {
    "home":   { "hash": "g2h5i8k1", "updated_at": "2026-03-26T14:07:00Z" },
    "search": { "hash": "j4k7l0m3", "updated_at": "2026-03-26T14:07:00Z" },
    "changes": { "hash": "n6o9p2q5", "updated_at": "2026-03-26T14:07:00Z" }
  },
  "total_articles": 296,
  "crawler_version": "2.0.0"
}
```

**Cache strategy**: App stores manifest locally. On launch, fetch new manifest, compare hashes per section/index. Only re-fetch files whose hashes changed. Show cached data immediately (stale-while-revalidate).

#### `mobile/home.json`

Top articles across all sections for the home screen. Limited to 20-40 articles for fast loading.

```json
{
  "generated_at": "2026-03-26T14:07:00Z",
  "articles": [
    {
      "id": "tech-a3f8c2d1e4f7",
      "title": "TSMC Begins 1.4nm Risk Production",
      "source": "AnandTech",
      "source_url": "https://anandtech.com/",
      "section": "tech",
      "subsection": "semiconductor",
      "published": "2026-03-26T12:30:00Z",
      "published_confidence": "high",
      "freshness_score": 12300,
      "intro": "TSMC has officially begun risk production on its N2P process...",
      "url": "https://anandtech.com/show/...",
      "access": "free",
      "tier": 1
    }
  ]
}
```

#### `mobile/sections/{section}.json`

Full article list for a single section. Same schema as `home.json`. Sorted by `freshness_score` ascending (lower = fresher).

Files: `tech.json`, `science.json`, `philosophy.json`, `world.json`, `research.json`, `misc.json`

#### `mobile/search-index.json`

Compact search corpus that enables fuzzy search without downloading every full section file.

```json
{
  "generated_at": "2026-03-26T14:07:00Z",
  "items": [
    {
      "id": "tech-a3f8c2d1e4f7",
      "title": "TSMC Begins 1.4nm Risk Production",
      "source": "AnandTech",
      "section": "tech",
      "subsection": "semiconductor",
      "published": "2026-03-26T12:30:00Z",
      "keywords": ["tsmc", "1.4nm", "n2p", "semiconductor", "fab"],
      "url": "https://anandtech.com/show/..."
    }
  ]
}
```

This is what fuse.js indexes. Rebuild the fuse index only when the search hash changes.

#### `mobile/changes.json`

Diff since the last build. Drives push notification diffing and fine-grained client refresh awareness.

```json
{
  "generated_at": "2026-03-26T14:07:00Z",
  "build_id": "2026-03-26T14:07:00Z",
  "previous_build_id": "2026-03-26T13:07:00Z",
  "new_articles": [
    {
      "id": "tech-a3f8c2d1e4f7",
      "title": "TSMC Begins 1.4nm Risk Production",
      "section": "tech",
      "subsection": "semiconductor",
      "url": "https://anandtech.com/show/...",
      "published": "2026-03-26T12:30:00Z"
    }
  ],
  "removed_article_ids": ["tech-old123abc"],
  "updated_article_ids": [],
  "section_changes": {
    "tech": { "added": 3, "removed": 1 },
    "science": { "added": 0, "removed": 0 },
    "research": { "added": 5, "removed": 2 }
  }
}
```

#### `mobile/articles/<id>.json` (Phase 2)

Per-article detail for deep link resolution. Not required for v1 if detail pages can be composed from cached list records, but schema should be designed now.

### 4.4 JSON Schema Validation

All mobile feed files are validated in CI before deployment. Schema files live in the repo:

```
schemas/
├── manifest.schema.json
├── home.schema.json
├── section.schema.json
├── search-index.schema.json
├── changes.schema.json
├── article-detail.schema.json      (Phase 2)
└── notification-payload.schema.json
```

Validation runs in the deploy job. **Schema failures must fail the build, not silently deploy malformed artifacts.**

```yaml
- name: Validate mobile feed schemas
  run: |
    python scripts/validate_mobile_feed.py \
      --schemas schemas/ \
      --feed site/public/mobile/
```

### 4.5 Build Script: `build_mobile_feed.py`

**Location**: `scripts/build_mobile_feed.py`
**Input**: `data/articles.json`
**Output**: `site/public/mobile/`
**Critical detail**: The previous-state manifest must be fetched from the **live authoritative host** (GitHub Pages), not assumed to exist in the CI workspace.

```python
# Pseudocode
def build_mobile_feed(articles_path, output_dir):
    articles = load_json(articles_path)

    # 1. Fetch LIVE previous manifest from GitHub Pages
    prev_manifest = fetch_url("https://pulse.elevendots.dev/mobile/manifest.json")
    # Fallback: if first run or fetch fails, treat everything as new

    # 2. Compute article IDs (deterministic)
    for article in articles:
        article['id'] = compute_article_id(
            article['section'], article['url'],
            article['title'], article.get('published', '')
        )

    # 3. Partition by section, sort by freshness_score ascending
    sections = partition_and_sort(articles)

    # 4. Generate per-section files with content hashes
    section_meta = {}
    for sec, arts in sections.items():
        data = {"generated_at": now_iso(), "articles": arts}
        content_hash = md5(json.dumps(data, sort_keys=True))[:8]
        write_json(f"{output_dir}/sections/{sec}.json", data)
        section_meta[sec] = {"hash": content_hash, "count": len(arts), "updated_at": now_iso()}

    # 5. Generate home.json (top 30 articles across sections)
    home_articles = sorted(articles, key=lambda a: a['freshness_score'])[:30]
    home_data = {"generated_at": now_iso(), "articles": home_articles}
    write_json(f"{output_dir}/home.json", home_data)

    # 6. Generate search-index.json (compact search corpus)
    search_items = [extract_search_record(a) for a in articles]
    search_data = {"generated_at": now_iso(), "items": search_items}
    write_json(f"{output_dir}/search-index.json", search_data)

    # 7. Generate changes.json (diff against previous manifest)
    changes = compute_diff(articles, prev_manifest)
    write_json(f"{output_dir}/changes.json", changes)

    # 8. Generate manifest.json
    manifest = build_manifest(section_meta, home_data, search_data, changes)
    write_json(f"{output_dir}/manifest.json", manifest)

    # 9. Validate all outputs against JSON schemas
    validate_all(output_dir, "schemas/")
```

### 4.6 Deep Link Contract

Freeze these routes before app implementation:

| Pattern | Screen | Example |
|---------|--------|---------|
| `pulse://home` | Home tab | — |
| `pulse://section/{key}` | Section list | `pulse://section/tech` |
| `pulse://section/{key}/{subsection}` | Filtered section | `pulse://section/tech/semiconductor` |
| `pulse://article/{id}` | Article detail | `pulse://article/tech-a3f8c2d1e4f7` |
| `pulse://search?q={query}` | Search with query | `pulse://search?q=TSMC` |
| `pulse://saved` | Saved articles | — |

Universal links (for web→app handoff):

| Web URL | Maps To |
|---------|---------|
| `pulse.elevendots.dev/` | `pulse://home` |
| `pulse.elevendots.dev/tech` | `pulse://section/tech` |
| `pulse.elevendots.dev/research` | `pulse://section/research` |

Configure via `apple-app-site-association` on GitHub Pages and `assetlinks.json` for Android.

Pushes and widgets must carry only these route-safe identifiers, not arbitrary opaque navigation state.

---

## 5. Mobile App Architecture

### 5.1 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Expo SDK | 52+ | Managed workflow, EAS builds |
| Runtime | React Native | 0.76+ | Native rendering |
| Language | TypeScript | 5.x | Type safety |
| Navigation | Expo Router | 4.x | File-based routing, deep links |
| State | Zustand | 5.x | Lightweight global state |
| Data fetching | TanStack Query | 5.x | Cache, stale-while-revalidate |
| Local storage | MMKV | 3.x | Fast synchronous key-value |
| Search | fuse.js | 7.x | Client-side fuzzy search (same as web) |
| Canvas | @shopify/react-native-skia | 1.x | Neural background rendering |
| Blur | expo-blur | 14.x | Glass morphism |
| Notifications | expo-notifications | 0.29+ | Push notification handling |
| Icons | lucide-react-native | Latest | Icon library |
| Lists | @shopify/flash-list | 1.x | High-performance list rendering |

### 5.2 Project Structure

```
elevendots-pulse-app/
├── app/                              # Expo Router pages
│   ├── _layout.tsx                   # Root layout (theme, neural bg, query provider)
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Tab bar config (6 sections + home)
│   │   ├── index.tsx                 # Home (top articles)
│   │   ├── tech.tsx
│   │   ├── science.tsx
│   │   ├── philosophy.tsx
│   │   ├── world.tsx
│   │   ├── research.tsx
│   │   └── misc.tsx
│   ├── article/[id].tsx              # Article detail
│   ├── search.tsx                    # Search screen
│   ├── saved.tsx                     # Saved articles
│   └── settings.tsx                  # Notifications, theme, about
│
├── src/
│   ├── components/
│   │   ├── ArticleCard.tsx           # Card with tilt, section accent
│   │   ├── ArticleList.tsx           # FlashList-based performant list
│   │   ├── GlassCard.tsx             # Glass morphism card
│   │   ├── SectionPills.tsx          # Subsection filter pills
│   │   ├── NeuralBackground.tsx      # Skia canvas constellation
│   │   ├── SearchOverlay.tsx         # Fuzzy search with fuse.js
│   │   ├── FreshnessIndicator.tsx    # "2h ago", "Date unknown" badges
│   │   ├── EmptyState.tsx            # No articles / no results
│   │   └── PullToRefresh.tsx         # Custom pull-to-refresh
│   │
│   ├── hooks/
│   │   ├── useArticles.ts            # Port of site/src/hooks/useArticles.js
│   │   ├── useFilters.ts             # Port of site/src/hooks/useFilters.js
│   │   ├── useManifest.ts            # Fetch + cache manifest
│   │   ├── useSectionData.ts         # Hash-based section fetching
│   │   ├── useSearchIndex.ts         # Fetch + build fuse.js index
│   │   ├── useSavedArticles.ts       # MMKV-backed saved articles
│   │   ├── useNotifications.ts       # Push registration + handlers
│   │   └── useTheme.ts              # Section-aware theming
│   │
│   ├── lib/
│   │   ├── api.ts                    # Feed fetching client
│   │   ├── cache.ts                  # MMKV cache layer + hash tracking
│   │   ├── freshness.ts              # Freshness scoring formula (TS port)
│   │   ├── theme.ts                  # THEMES dict + glass hierarchy
│   │   ├── constants.ts              # API URLs, section config, timing
│   │   └── types.ts                  # TypeScript type definitions
│   │
│   └── providers/
│       ├── QueryProvider.tsx          # TanStack Query client setup
│       └── NotificationProvider.tsx   # Push notification context
│
├── ios/                              # Generated by expo prebuild (Phase 4)
│   └── PulseWidget/                  # WidgetKit extension (Swift)
│       ├── PulseWidget.swift
│       ├── TimelineProvider.swift
│       ├── WidgetViews.swift
│       └── SharedData.swift          # App Group reader
│
├── android/                          # Generated by expo prebuild (Phase 5)
│   └── app/src/main/java/.../widget/ # Glance widget (Kotlin)
│
├── assets/
│   ├── icon.png                      # From favicon 1024px source
│   ├── splash.png                    # Splash screen
│   ├── adaptive-icon.png             # Android adaptive icon
│   └── fonts/                        # DM Sans, JetBrains Mono
│
├── app.json                          # Expo configuration
├── eas.json                          # EAS Build profiles
├── tsconfig.json
└── package.json
```

### 5.3 App Data Flow

```
App Launch
    │
    ├── 1. Render UI with cached data from MMKV (instant, 0ms)
    │
    ├── 2. Fetch manifest.json from GitHub Pages (background)
    │       │
    │       ▼
    │   Compare hashes per section/index against local cache metadata
    │       │
    │       ├── Hash unchanged → keep cached data, no fetch
    │       │
    │       ├── Section hash changed → fetch sections/{section}.json
    │       │                              │
    │       │                              ▼
    │       │                          Update MMKV cache + UI
    │       │
    │       └── Search hash changed → fetch search-index.json
    │                                      │
    │                                      ▼
    │                                  Rebuild fuse.js index
    │
    ├── 3. Register push token (if not already registered)
    │
    └── 4. Write widget snapshot to App Group (if data changed)
```

**TanStack Query configuration:**

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 min before "stale"
      gcTime: 24 * 60 * 60 * 1000,    // Keep cache 24h
      retry: 2,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,      // Re-fetch on foreground
    },
  },
});
```

### 5.4 Freshness Model

| App State | Strategy | Reliability |
|-----------|----------|-------------|
| Foreground (active) | Fetch on launch + pull-to-refresh | Guaranteed |
| Foreground (idle) | No automatic polling (battery) | N/A |
| Background | Push notification alerts user to open | High |
| Suspended/Killed | Push shows in notification center | High |
| Widget | WidgetKit timeline reload (system-budgeted) | Medium |

**Do NOT rely on BGAppRefreshTask or WorkManager for freshness.** The push notification service is the reliable background alerting mechanism.

### 5.5 Offline Support

- MMKV stores last-fetched JSON for each section
- On launch with no network, cached data renders immediately
- Articles opened while online are cached for offline reading
- "Saved" articles are explicitly persisted and never evicted
- UI shows subtle "Offline — showing cached data" indicator when network unavailable

### 5.6 Search Architecture

Do not build search by scanning all large section files.

1. Download compact `search-index.json` (just id, title, source, section, keywords)
2. Store locally in MMKV
3. Build fuse.js index once per changed hash
4. Query locally for instant response

This gives responsive search without downloading the full feed corpus.

### 5.7 Article Detail Model

The detail screen should be rights-safe and product-aligned:
- Title, source, freshness metadata
- Intro/excerpt (from og:description, already fetched by crawler)
- Section and subsection tags
- Save / share / open original actions
- "Open in browser" button for full article

Do not architect Pulse as a full third-party content host. The product's value is curation, ranking, and routing.

### 5.8 Saved Articles

v1 policy: local only.
- Saved by stable article ID
- Persisted in MMKV, survives app updates
- Preserve enough metadata locally to render saved cards even if the article rolls off the live feed
- No accounts, no sync, no backend scope creep

---

## 6. Design System

### 6.1 Theme Tokens

Match the web app exactly (from `NeuralBackground.jsx` and `index.css`):

```typescript
export const THEMES = {
  home:       { primary: '#6868E0', rgb: { r: 104, g: 104, b: 224 } },  // Indigo
  tech:       { primary: '#4080FF', rgb: { r: 64, g: 128, b: 255 } },   // Blue
  science:    { primary: '#A050FF', rgb: { r: 160, g: 80, b: 255 } },   // Purple
  philosophy: { primary: '#E0A030', rgb: { r: 224, g: 160, b: 48 } },   // Amber
  world:      { primary: '#DC2828', rgb: { r: 220, g: 40, b: 40 } },    // Red
  research:   { primary: '#10B981', rgb: { r: 16, g: 185, b: 129 } },   // Emerald
  misc:       { primary: '#A0A0C0', rgb: { r: 160, g: 160, b: 192 } },  // Silver
} as const;

export const DARK = {
  background: '#08080f',
  surface: 'rgba(255, 255, 255, 0.03)',
  text: '#e4e4ed',
  textMuted: 'rgba(228, 228, 237, 0.6)',
  border: 'rgba(255, 255, 255, 0.06)',
};

export const LIGHT = {
  background: '#f0f0ea',
  surface: 'rgba(0, 0, 0, 0.03)',
  text: '#1a1a2e',
  textMuted: 'rgba(26, 26, 46, 0.6)',
  border: 'rgba(0, 0, 0, 0.06)',
};
```

### 6.2 Glass Hierarchy

| Level | Purpose | Background | Blur | Border |
|-------|---------|------------|------|--------|
| Atmosphere | Neural background overlay | transparent | none | none |
| Nav | Sticky navigation | rgba(8,8,15,0.7) | 20px | rgba(255,255,255,0.06) |
| Pill | Filter pills | rgba(255,255,255,0.03) | 8px | rgba(255,255,255,0.06) |
| Card | Article cards | rgba(255,255,255,0.03) | 12px | rgba(255,255,255,0.06) |
| Focused | Hover/focus state | rgba(255,255,255,0.06) | 16px | section primary at 20% |

### 6.3 Typography

| Role | Font | Size | Weight |
|------|------|------|--------|
| Display | DM Sans | 28pt | Bold |
| Title | DM Sans | 22pt | SemiBold |
| Headline | DM Sans | 18pt | SemiBold |
| Body | DM Sans | 16pt | Regular |
| Caption | DM Sans | 14pt | Regular |
| Badge | JetBrains Mono | 12pt | Medium |

### 6.4 iPad Adaptive Layout

| Width | Layout | Description |
|-------|--------|-------------|
| < 768px | Single column | Phone — tab bar, full-width list |
| 768–1024px | Two column | iPad portrait — list + detail |
| > 1024px | Three column | iPad landscape — tabs + list + detail |

### 6.5 Neural Background (Skia)

Ship with static or simplified animated background first. Use Skia only if it doesn't delay contract/data work. Make motion degradation explicit on lower-performance devices.

**Do not let visual ambition become the critical path for system correctness.**

Layer mapping from web Canvas 2D to Skia:

| Layer | Skia Equivalent |
|-------|----------------|
| Nebula wash (radial gradients) | `<Circle>` + `<RadialGradient>` |
| Star field | `<Points>` or `<Circle>` array |
| Energy rivers (bezier) | `<Path>` cubic bezier |
| Hero nodes (glows) | `<Circle>` + `<Shadow>` + `<BlurMask>` |
| Trail effect | `<Image>` surface compositing at 30fps |
| Film grain | Skia `RuntimeEffect` (GLSL shader) |

---

## 7. Sections and Subsections

### 7.1 Section Configuration

```typescript
export const SECTIONS = [
  { key: 'tech',       label: 'Tech',       icon: 'cpu',            theme: THEMES.tech },
  { key: 'research',   label: 'Research',   icon: 'flask-conical',  theme: THEMES.research },
  { key: 'science',    label: 'Science',    icon: 'atom',           theme: THEMES.science },
  { key: 'philosophy', label: 'Philosophy', icon: 'brain',          theme: THEMES.philosophy },
  { key: 'world',      label: 'World',      icon: 'globe',          theme: THEMES.world },
  { key: 'misc',       label: 'Misc',       icon: 'puzzle',         theme: THEMES.misc },
] as const;
```

### 7.2 Subsections

- **Tech** (29): semiconductor, lithography, fab, packaging, memory, cpu, gpu, ai, ml, ai-accelerator, autonomous, robotics, photonics, networking, eda, embedded, software, servers, quantum-computing, datacenter, power-semiconductor, risc-v, open-hardware, developer, linux-oss, storage, hpc, cloud-native, robotics-industry
- **Research** (11): r-ai-ml, r-systems, r-hardware, r-networking, r-security, r-robotics, r-quantum, r-software, r-hpc, r-frontier, r-must-read
- **Science** (9): astronomy, biophysics, chemistry, quantum, materials, neuroscience, biology, climate, biotech
- **Philosophy** (6): ethics-of-ai, consciousness, epistemology, metaphysics, stoicism, existentialism
- **World** (8): world-news, us-politics, geopolitics, macroeconomics, public-policy, trade-development, conflict-security, institutions
- **Misc** (7): maker, policy, space-exploration, energy, cybersecurity, defense, podcast

### 7.3 Research Section Special Sort

Must be ported to mobile `useFilters.ts`:
1. **Must Read** (`r-must-read`) — OpenAlex papers with `cited_by_count >= 5`
2. **Frontier** (`r-frontier`) — arXiv preprints ≤48h old
3. **Freshness** — Standard freshness_score sorting

---

## 8. Push Notification Architecture

### 8.1 Why the Event Plane Must Exist

The app needs targeted push notifications, and targeted push requires state: which installations exist, which tokens are valid, what each installation follows, what content changed. A static file host cannot do that.

The event plane should be **small**, **stateless where possible**, and **replaceable**. It is not the content system. It is only the alert routing system.

### 8.2 Worker API Endpoints

#### `POST /register-installation`

Called on app launch. Registers or updates an installation.

```json
{
  "installation_id": "uuid-v4",
  "platform": "ios",
  "expo_push_token": "ExponentPushToken[xxxx]",
  "app_version": "1.0.0",
  "feed_schema_version": 1,
  "timezone": "America/Los_Angeles"
}
```

#### `PUT /subscriptions`

Sets followed sections/topics for an installation.

```json
{
  "installation_id": "uuid-v4",
  "followed_sections": ["tech", "research"],
  "topic_filters": []
}
```

#### `POST /notify-build`

Called only by CI. HMAC-signed.

```json
{
  "build_id": "2026-03-26T14:07:00Z",
  "generated_at": "2026-03-26T14:07:00Z",
  "changes_url": "https://pulse.elevendots.dev/mobile/changes.json",
  "signature": "hmac-sha256-hex"
}
```

#### `GET /health`

Status check. Returns device count, last build processed.

### 8.3 D1 Data Model

```sql
CREATE TABLE installations (
  installation_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,           -- 'ios' | 'android'
  expo_push_token TEXT NOT NULL,
  app_version TEXT,
  feed_schema_version INTEGER,
  timezone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  status TEXT DEFAULT 'active'      -- 'active' | 'inactive' | 'invalid'
);

CREATE TABLE subscriptions (
  installation_id TEXT REFERENCES installations,
  section_key TEXT NOT NULL,
  topic_key TEXT,                    -- nullable, for future topic filtering
  created_at TEXT NOT NULL,
  UNIQUE(installation_id, section_key, topic_key)
);

CREATE TABLE content_revisions (
  build_id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  changes_hash TEXT,
  manifest_hash TEXT,
  processed_at TEXT NOT NULL
);

CREATE TABLE notification_events (
  event_id TEXT PRIMARY KEY,
  build_id TEXT REFERENCES content_revisions,
  installation_id TEXT REFERENCES installations,
  payload_hash TEXT,
  status TEXT DEFAULT 'pending',    -- 'pending' | 'sent' | 'delivered' | 'failed'
  created_at TEXT NOT NULL
);

CREATE TABLE delivery_attempts (
  attempt_id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES notification_events,
  provider_ticket_id TEXT,
  provider_receipt_id TEXT,
  outcome TEXT,                     -- 'ok' | 'error' | 'DeviceNotRegistered' | ...
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 8.4 Delivery Policy

| Rule | Detail |
|------|--------|
| Batch by section | One notification per build per followed section max |
| Hard cap | Max 2-3 notifications per installation per hour |
| Digests | Not in v1 (future: morning/evening digest option) |
| Background push | Treat as optional optimization, not correctness mechanism |
| Quiet hours | Respect system Do Not Disturb, no custom implementation in v1 |

### 8.5 Notification Types

| Type | Trigger | Priority | Content |
|------|---------|----------|---------|
| Section update | New articles in followed section | Normal | "5 new articles in Tech" |
| Frontier paper | New r-frontier article | Normal | "New arXiv preprint: {title}" |
| Must Read | New r-must-read article | High | "Highly cited: {title}" |

### 8.6 Security

| Boundary | Mechanism |
|----------|-----------|
| CI → Worker | HMAC-signed webhook payloads. Reject unsigned/stale requests. |
| App → Worker | Rate limiting, token format validation, installation_id idempotency. Not real auth — light abuse friction only. |
| Worker → Expo Push | Standard Expo Push API authentication |

### 8.7 Reliability Loop

This is critical and often omitted in lightweight push designs:

1. **Ticket logging** — Log Expo ticket ID for every send
2. **Receipt polling** — Poll Expo receipts after ~15 minutes
3. **Dead-token pruning** — On `DeviceNotRegistered` error, mark installation inactive
4. **Retry with backoff** — Transient failures get 3 retries with exponential backoff
5. **Replay tooling** — Ability to replay notification generation for a given build_id (admin/debug endpoint)

Without this, the push system looks fine during demos but decays operationally.

### 8.8 GitHub Actions Integration

```yaml
- name: Notify push service
  if: steps.crawl.outputs.new_articles > 0
  run: |
    PAYLOAD='{"build_id":"${{ steps.feed.outputs.build_id }}","generated_at":"${{ steps.feed.outputs.generated_at }}","changes_url":"https://pulse.elevendots.dev/mobile/changes.json"}'
    SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "${{ secrets.PUSH_WORKER_HMAC_KEY }}" -hex | awk '{print $2}')
    curl -X POST "${{ secrets.PUSH_WORKER_URL }}/notify-build" \
      -H "Content-Type: application/json" \
      -H "X-Signature: $SIGNATURE" \
      -d "$PAYLOAD"
```

### 8.9 App-Side Registration

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { PUSH_SERVICE_URL } from '../lib/constants';

export async function registerForPush(installationId: string) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-expo-project-id',
  });

  await fetch(`${PUSH_SERVICE_URL}/register-installation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      installation_id: installationId,
      platform: Platform.OS,
      expo_push_token: token.data,
      app_version: '1.0.0',
      feed_schema_version: 1,
    }),
  });

  return token.data;
}
```

---

## 9. Widget Architecture

### 9.1 Design Principles

Widgets are **glanceable snapshots**, not mini-apps. They are OS-managed, budgeted, separately-hosted surfaces. They should consume tiny precomputed snapshots, not the full mobile feed.

### 9.2 Widget Families

| Widget | Size | Content | Platform |
|--------|------|---------|----------|
| Top Signals | Small (2x2) | Single top headline with section color | iOS + Android |
| Section Headlines | Medium (4x2) | 3 latest headlines from chosen section | iOS + Android |
| Morning Brief | Large (4x4) | Top headline per section, 6 total | iOS only |
| Lock Screen | Accessory Rectangular | Single headline, compact | iOS only |

### 9.3 Widget Data Contract

Keep the snapshot tiny:

```json
{
  "generatedAt": "2026-03-26T14:07:00Z",
  "kind": "top-signals",
  "items": [
    {
      "id": "tech-a3f8c2d1e4f7",
      "title": "TSMC Begins 1.4nm Risk Production",
      "section": "tech",
      "source": "AnandTech",
      "deeplink": "pulse://article/tech-a3f8c2d1e4f7"
    }
  ]
}
```

### 9.4 Data Sharing

- **iOS**: App Group container (`group.dev.elevendots.pulse`). RN app writes via `WidgetBridge` native module.
- **Android**: SharedPreferences (`pulse_widget_data`).

### 9.5 Widget Refresh Model

Do not promise a fixed interval. The correct contract is:
- Widget content is **budgeted and system-scheduled**
- App writes shared snapshot when app data changes
- Widget timelines reload only when warranted
- User can always tap through to open app for freshest data

### 9.6 Maturity Warning

`expo-widgets` is alpha and iOS-only (as of March 2026). The recommended approach: `npx expo prebuild`, write WidgetKit extension in Swift directly in `ios/PulseWidget/`, create a small `WidgetBridge` native module for App Group data sharing. ~200-300 lines of native code per platform.

---

## 10. Operations and Governance

### 10.1 Feed Validation in CI

Add schema validation for all mobile feed files. **Failures must fail the build.**

### 10.2 Compliance Continuity

The mobile app inherits the compliance posture of the existing crawler. It consumes the same ranked/static outputs. The app never crawls sources directly. Keep current policy posture: respect source restrictions upstream, do not expand rights assumptions on mobile.

### 10.3 Observability

At minimum track:
- Hourly build success/failure
- Per-source crawl health (existing `source_health.json`)
- Mobile feed generation success/failure
- Diff generation correctness
- Push sends by build_id
- Push ticket outcomes (sent/delivered/failed)
- Receipt failures by error code
- Dead token removal count
- Widget data freshness ("Updated Xm ago" in widget UI)

### 10.4 App Store Compliance

| Risk | Mitigation |
|------|-----------|
| "Repackaged website" rejection | Native nav, widgets, push, saved articles, offline cache, search |
| Content aggregator concerns | Structured filtering, freshness system, editorial curation (Must Read, Frontier) |
| Minimal functionality | Search, saved, notification prefs, section following, widgets |
| Privacy | No user accounts, no PII beyond device token |

---

## 11. Code Reuse from Web Codebase

### 11.1 Direct Ports (80%+ reuse)

| Web File | Mobile Port | Changes |
|----------|------------|---------|
| `useArticles.js` | `useArticles.ts` | Replace fetch with TanStack Query, add types |
| `useFilters.js` | `useFilters.ts` | Pure logic port, add types |
| THEMES dict in NeuralBackground.jsx | `theme.ts` | Extract, works as-is |
| fuse.js search logic | Same npm package | Identical usage |
| Freshness concepts from freshness.py | `freshness.ts` | Port Python → TypeScript |

### 11.2 Shared Contract for Android

Share these across platforms (not the UI):
- Feed schema (manifest, section, article JSON)
- Article ID scheme
- Subscription model
- Notification payload schema
- Deep link format
- Freshness scoring formula

---

## 12. Build and Distribution

### 12.1 Expo Configuration (`app.json`)

```json
{
  "expo": {
    "name": "Pulse",
    "slug": "elevendots-pulse",
    "version": "1.0.0",
    "orientation": "default",
    "icon": "./assets/icon.png",
    "splash": { "image": "./assets/splash.png", "backgroundColor": "#08080f" },
    "ios": {
      "bundleIdentifier": "dev.elevendots.pulse",
      "supportsTablet": true,
      "infoPlist": { "UIBackgroundModes": ["remote-notification"] }
    },
    "android": {
      "package": "dev.elevendots.pulse",
      "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#08080f" }
    },
    "plugins": ["expo-router", "expo-font",
      ["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#4a9eed" }]
    ],
    "scheme": "pulse"
  }
}
```

### 12.2 EAS Build Profiles (`eas.json`)

```json
{
  "cli": { "version": ">= 13.0.0" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "ios": { "simulator": false } },
    "production": { "ios": { "autoIncrement": true }, "android": { "autoIncrement": true } }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "iparikshitdubey@gmail.com", "ascAppId": "YOUR_ASC_APP_ID" }
    }
  }
}
```

### 12.3 CLI Workflow (Claude Code)

```bash
# Setup
npx create-expo-app elevendots-pulse-app --template tabs
cd elevendots-pulse-app
npx expo install @shopify/react-native-skia expo-notifications expo-blur expo-font @shopify/flash-list

# Development
npx expo start                          # Metro bundler
npx expo start --ios                    # iOS simulator
npx expo start --android                # Android emulator

# Native code (Phase 4+)
npx expo prebuild                       # Generate ios/ and android/
npx expo run:ios                        # Build + run on simulator

# Cloud builds (no Xcode needed)
eas build --platform ios --profile development
eas build --platform ios --profile production
eas submit --platform ios               # Submit to App Store Connect
```

---

## 13. Repo Structure

```
elevendots-pulse/                       # Existing repo, extended
├── crawler/                            # Existing
├── data/                               # Existing
├── scripts/
│   ├── build_mobile_feed.py            # NEW — generates mobile feed
│   ├── validate_mobile_feed.py         # NEW — validates against schemas
│   ├── generate_section_og.py          # Existing
│   └── fetch_traffic_stats.py          # Existing
├── schemas/                            # NEW — JSON schemas for feed contract
│   ├── manifest.schema.json
│   ├── home.schema.json
│   ├── section.schema.json
│   ├── search-index.schema.json
│   ├── changes.schema.json
│   ├── article-detail.schema.json
│   └── notification-payload.schema.json
├── site/                               # Existing web SPA
│   └── public/
│       └── mobile/                     # Generated by build_mobile_feed.py
├── mobile/                             # NEW — Expo app
│   ├── app/
│   ├── src/
│   ├── assets/
│   ├── app.json
│   ├── eas.json
│   └── package.json
├── workers/                            # NEW — Push notification service
│   └── notify/
│       ├── src/
│       ├── migrations/
│       ├── wrangler.toml
│       └── README.md
├── .github/workflows/
│   ├── crawl-and-deploy.yml            # Extended with mobile feed + push webhook
│   └── mobile-build.yml                # NEW — mobile CI (later)
├── tests/                              # Existing
├── CONTENT-POLICY.md                   # Existing
└── README.md                           # Existing
```

---

## 14. Implementation Phases

### Phase 0: Contract Freeze (Week 1)

**Goal**: Frozen feed contract. App and push service can start independently.

**Tasks**:
1. Design article ID algorithm, test against real corpus
2. Write JSON schemas for all mobile feed files
3. Implement `build_mobile_feed.py` with fixture generation
4. Implement `validate_mobile_feed.py`
5. Add schema validation to CI
6. Generate sample mobile artifacts from today's live Pulse data
7. Verify artifacts deploy to GitHub Pages at `/mobile/`
8. Freeze deep link routes
9. Document contract decisions

**Exit criteria**: Mobile feed files exist on live GitHub Pages. Schemas pass validation. App development can begin without contract ambiguity.

### Phase 1: App Shell + Reading (Weeks 2-3)

**Goal**: Working reading experience with all sections, search, offline cache.

**Tasks**:
1. Initialize Expo project with TypeScript + Expo Router
2. Tab navigation (6 sections + home)
3. Port `useArticles.ts` and `useFilters.ts`
4. Build ArticleCard, ArticleList, SectionPills components
5. TanStack Query data fetching with MMKV cache
6. Manifest-based hash invalidation
7. Search with fuse.js over `search-index.json`
8. Pull-to-refresh
9. Dark theme with section color tokens
10. Basic iPad adaptive layout (2-column at 768px+)

**Exit criteria**: TestFlight-capable reading build. No push dependency. No widget dependency.

### Phase 2: Polish + Saved Articles (Week 4)

**Goal**: Feature-complete reading experience for public beta.

**Tasks**:
1. Saved articles (MMKV-backed, persist across sessions)
2. Article detail with WebView/in-app browser fallback
3. Share sheet integration
4. App icon and splash screen (from existing favicon set)
5. Onboarding (section selection)
6. Settings screen
7. Neural background (simplified Skia or static)
8. Glass morphism effects (expo-blur)
9. Accessibility audit (VoiceOver, Dynamic Type)
10. Submit to TestFlight

**Exit criteria**: Stable private beta experience.

### Phase 3: Push Notifications (Week 5)

**Goal**: Users receive notifications for followed sections.

**Tasks**:
1. Deploy Cloudflare Worker + D1
2. Implement `/register-installation`, `/subscriptions`, `/notify-build`, `/health`
3. HMAC-signed webhook from GitHub Actions
4. Subscription UI in app settings
5. Notification tap → deep link handling
6. Batching and rate limiting
7. Receipt polling and dead-token pruning
8. Replay tooling for debugging

**Exit criteria**: Push notifications work end-to-end with operational reliability.

### Phase 4: iOS Widget (Week 6)

**Goal**: Home screen and Lock Screen widgets.

**Tasks**:
1. `npx expo prebuild` to generate `ios/`
2. WidgetKit extension target
3. `WidgetBridge` native module for App Group data sharing
4. TimelineProvider with hourly reload
5. Small (top headline) and Medium (3 headlines) widget views
6. Lock Screen widget
7. Widget deep link → app
8. Test widget refresh on real device

**Exit criteria**: iOS widgets in TestFlight.

### Phase 5: Android + Play Store (Later)

**Goal**: Android parity and Play Store listing.

**Tasks**:
1. `npx expo prebuild` for Android
2. Glance widget in Kotlin
3. SharedPreferences data bridge
4. Android-specific UI polish
5. Play Store submission

**Exit criteria**: Android app on Play Store.

---

## 15. TypeScript Data Model

```typescript
export type SectionKey = 'tech' | 'science' | 'philosophy' | 'world' | 'research' | 'misc';

export interface Article {
  id: string;
  title: string;
  source: string;
  source_url: string;
  section: SectionKey;
  subsection: string;
  published: string;
  published_confidence: 'high' | 'medium' | 'low';
  freshness_score: number;
  intro: string;
  url: string;
  access: 'free' | 'metered' | 'paywall';
  tier: 1 | 2 | 3;
}

export interface Manifest {
  feed_schema_version: number;
  build_id: string;
  generated_at: string;
  min_supported_app_version: string;
  sections: Record<SectionKey, { hash: string; count: number; updated_at: string }>;
  indexes: Record<'home' | 'search' | 'changes', { hash: string; updated_at: string }>;
  total_articles: number;
  crawler_version: string;
}

export interface SectionFeed {
  generated_at: string;
  articles: Article[];
}

export interface SearchItem {
  id: string;
  title: string;
  source: string;
  section: SectionKey;
  subsection: string;
  published: string;
  keywords: string[];
  url: string;
}

export interface SearchIndex {
  generated_at: string;
  items: SearchItem[];
}

export interface Changes {
  generated_at: string;
  build_id: string;
  previous_build_id: string;
  new_articles: Pick<Article, 'id' | 'title' | 'section' | 'subsection' | 'url' | 'published'>[];
  removed_article_ids: string[];
  updated_article_ids: string[];
  section_changes: Record<SectionKey, { added: number; removed: number }>;
}
```

---

## 16. Freshness Scoring Formula (TypeScript)

Ported from `crawler/freshness.py`:

```typescript
export function computeFreshnessScore(
  publishedConfidence: 'high' | 'medium' | 'low',
  publishedDate: Date | null,
  now: Date = new Date()
): number {
  const CONFIDENCE_WEIGHT = 100_000_000;
  const BUCKET_WEIGHT = 1_000_000;

  const confidenceMap = { high: 0, medium: 1, low: 2 };
  const confidence = confidenceMap[publishedConfidence];

  if (!publishedDate || publishedConfidence === 'low') {
    return confidence * CONFIDENCE_WEIGHT + 4 * BUCKET_WEIGHT + 999999;
  }

  const ageSeconds = Math.floor((now.getTime() - publishedDate.getTime()) / 1000);
  const bucket = ageSeconds < 3600 ? 0          // last_hour
    : ageSeconds < 21600 ? 1                     // last_6h
    : ageSeconds < 86400 ? 2                     // last_24h
    : ageSeconds < 259200 ? 3                    // last_72h
    : ageSeconds < 604800 ? 4                    // last_week
    : 5;                                         // stale

  return confidence * CONFIDENCE_WEIGHT + bucket * BUCKET_WEIGHT + ageSeconds;
}
```

---

## 17. Performance Architecture (First Principles)

### 17.1 The Fundamental Constraint

A mobile device is a battery-constrained, bandwidth-variable, memory-limited, thermally-throttled computer that the user holds in their hand. Every architectural decision must be evaluated against this reality. The first-principles chain is:

```
Battery is finite
  → Every CPU cycle costs energy
    → Every network request costs energy + time
      → Every JSON parse blocks the JS thread
        → Every blocked frame is a dropped frame
          → Every dropped frame is perceived as "slow"
```

Therefore: **minimize work at runtime by doing it at build time.** This is why Pulse is upstream-heavy and client-light. The crawler, ranker, deduplicator, and feed builder run in GitHub Actions (unlimited power, unlimited time). The app just fetches pre-computed results.

### 17.2 Network Performance

**Problem**: Mobile networks are high-latency, variable-bandwidth, and occasionally offline. A single monolithic `articles.json` (~200-500KB) wastes bandwidth when only one section changed.

**Solution (manifest-first incremental sync)**:

| Step | Payload Size | When |
|------|-------------|------|
| 1. Fetch manifest.json | ~1KB | Every launch |
| 2. Compare section hashes | 0 (local) | Every launch |
| 3. Fetch changed sections only | ~10-50KB each | Only when hash differs |
| 4. Fetch search-index.json | ~30-50KB | Only when hash differs |

**Quantitative analysis**: If the user opens the app 10 times between hourly builds, only the first open fetches changed sections. The other 9 opens fetch only the 1KB manifest and see no changes. Total wasted bandwidth: ~9KB instead of ~4.5MB (500KB x 9) if we naively re-fetched everything.

**HTTP caching**: GitHub Pages serves files with `Cache-Control` headers. The app should use `If-None-Match` (ETag) or `If-Modified-Since` headers to avoid re-downloading unchanged files even before hash comparison. This gives a double layer of cache validation: HTTP-level (304 Not Modified) + application-level (hash comparison).

**Connection-aware fetching**: On cellular, prioritize manifest + home.json only. Defer section pre-fetching until Wi-Fi. Use `NetInfo` from `@react-native-community/netinfo` to detect connection type.

### 17.3 Rendering Performance

**Problem**: React Native's bridge architecture means the JS thread and UI thread are separate. Heavy JS work (parsing large JSON, building search indexes, sorting arrays) blocks the JS thread, causing dropped frames and unresponsive scrolling.

**Solutions**:

1. **FlashList over FlatList**: `@shopify/flash-list` recycles cell views instead of creating new ones, reducing memory allocation and GC pauses. For a list of 87 tech articles with complex card layouts, FlashList reduces memory usage by ~70% compared to FlatList.

2. **Offload heavy computation**: JSON parsing and fuse.js index building should happen outside the render cycle. Use `InteractionManager.runAfterInteractions()` to defer non-critical work until after the navigation animation completes.

3. **Memoization**: Article cards should use `React.memo` with a custom comparator that checks only `id` and `freshness_score`. Section pill lists should use `useMemo` with section key as dependency.

4. **Image optimization**: Article source favicons and any thumbnails should use `expo-image` (not React Native's `Image`) for disk caching, progressive loading, and memory-efficient decoding.

5. **Hermes engine**: Expo uses Hermes by default, which provides ahead-of-time compilation of JavaScript to bytecode. This reduces startup time by ~30-50% compared to JSC. Verify Hermes is enabled in `app.json`.

### 17.4 Startup Performance

**Target**: First meaningful paint (cached data visible) in < 500ms. Fresh data visible in < 2s on Wi-Fi.

**Startup sequence (optimized)**:

```
T+0ms:    App process starts, Hermes loads bytecode
T+50ms:   React tree mounts, MMKV cache reads (synchronous, ~1ms)
T+100ms:  Cached home.json rendered → FIRST MEANINGFUL PAINT
T+150ms:  manifest.json fetch begins (background)
T+300ms:  Navigation animation completes
T+500ms:  manifest.json response arrives
T+600ms:  Hash comparison, 0-3 section fetches begin
T+1500ms: Changed sections arrive, UI updates (stale-while-revalidate)
T+2000ms: Search index rebuilt if changed
```

**Critical insight**: MMKV is synchronous (not async like AsyncStorage). This means cached data is available on the very first render cycle, before any `useEffect` fires. This eliminates the "loading spinner" problem entirely for returning users.

### 17.5 Memory Performance

**Budget**: Keep app memory under 150MB on iPhone (200MB on iPad). Exceeding this risks jetsam (OS kills the app).

**Strategies**:
- Store section JSON as strings in MMKV, parse on-demand when section is opened (lazy deserialization)
- FlashList's cell recycling keeps only ~20 cards in memory regardless of list length
- Neural background Skia canvas should use a fixed-size offscreen buffer, not scale with screen resolution on older devices
- Release search index from memory when search screen is dismissed

### 17.6 Battery Performance

**Rules**:
- No background polling. Period. Freshness comes from foreground fetch + push.
- Neural background animation runs at 30fps, not 60fps. At 60fps, GPU usage roughly doubles for a benefit most users cannot perceive on a phone screen.
- Reduce animation to static on Low Power Mode (detect via `expo-battery` or `react-native-device-info`)
- Network requests use HTTP/2 connection reuse to GitHub Pages (automatic with `fetch`)

### 17.7 Performance Monitoring

Instrument these metrics from day one:

| Metric | Target | Tool |
|--------|--------|------|
| Time to first meaningful paint (cached) | < 500ms | Custom timestamp logging |
| Time to fresh data | < 2s (Wi-Fi), < 5s (cellular) | TanStack Query timing |
| JS thread FPS during scroll | > 58fps | React DevTools / Flipper |
| Memory high water mark | < 150MB | Xcode Instruments |
| Bundle size (JS) | < 5MB | `npx expo export --dump-sourcemap` |
| Network bytes per session | < 100KB average | Custom logging |

---

## 18. Accuracy Architecture (First Principles)

### 18.1 The Accuracy Problem

Pulse's value proposition is: "I show you the freshest, most relevant articles from 165+ sources, correctly categorized, deduplicated, and ranked." If the mobile app shows stale data, miscategorized articles, or inconsistent rankings compared to the web, the product promise is broken.

Accuracy has three dimensions: **data fidelity** (is the data correct?), **temporal fidelity** (is the data fresh?), and **behavioral fidelity** (does the app behave the same as the web?).

### 18.2 Data Fidelity

**First principle**: The app must never transform, re-rank, or re-interpret the upstream data. The crawler + ranking pipeline is the single source of truth. The app is a faithful renderer of pre-computed decisions.

**Implications**:

1. **No client-side re-ranking**: The `freshness_score` in the feed is canonical. The app sorts by it. It does not recompute freshness based on the current time, because the score encodes confidence and bucket information that the app doesn't have the context to recompute.

2. **No client-side deduplication**: Deduplication happens in the crawler. If two similar articles appear in the feed, they were intentionally kept (different sources, different angles). The app does not second-guess this.

3. **Section and subsection assignment is upstream-only**: The app does not reassign articles to different sections or subsections. The feed is authoritative.

4. **Schema validation is the accuracy firewall**: JSON schema validation in CI ensures that every feed file has the correct structure, required fields, and valid types. This catches upstream bugs before they reach the app.

### 18.3 Temporal Fidelity

**First principle**: The user must always know how fresh their data is. Ambiguity about freshness is worse than showing stale data with a clear label.

**Implementations**:

1. **Manifest timestamp**: Every screen header shows "Updated Xm ago" based on `manifest.generated_at` vs. current time.

2. **Article freshness indicators**: Each article card shows its freshness badge (from the `freshness_score` bucket: "1h ago", "6h ago", "24h ago", "3d ago", "1w ago", "stale"). Low-confidence articles show "Date unknown" instead of a fabricated age.

3. **Stale data warning**: If the manifest is older than 2 hours (meaning the crawler may have failed), show a subtle warning: "Feed may be outdated. Pull to refresh."

4. **Offline indicator**: When the device is offline, show "Offline — showing cached data from Xm ago" so users don't mistake cached data for current data.

5. **No fabricated freshness**: The app never says "just now" or "live" unless the data was actually fetched within the last 60 seconds. Time displays use the server's `generated_at`, not the client's clock.

### 18.4 Behavioral Fidelity (Web-Mobile Consistency)

**First principle**: If a user sees article A ranked above article B on the web, they must see the same ordering on mobile. Behavioral inconsistency between platforms destroys trust.

**Critical consistency points**:

| Behavior | Web Implementation | Mobile Must Match |
|----------|-------------------|-------------------|
| Sort order | `freshness_score` ascending | Same — lower score = fresher |
| Research special sort | Must Read → Frontier → freshness | Same ordering logic in `useFilters.ts` |
| Low-confidence demotion | `published_confidence: low` → `last_week` bucket | Same — show "Date unknown", exclude from time filters |
| Subsection filtering | `useFilters.js` logic | Direct port to `useFilters.ts` |
| Time filter behavior | Exclude low-confidence from time filters | Same behavior |
| Subsection pill order | `order ?? 99` (not `|| 99` — handles falsy zero) | Same nullish coalescing |

**Testing strategy for behavioral fidelity**: Write snapshot tests that load the same `articles.json` through both the web `useFilters.js` and mobile `useFilters.ts`, and assert identical output ordering. Run these tests in CI for every feed contract change.

### 18.5 Search Accuracy

**First principle**: Search results should surface relevant articles even with typos, abbreviations, or partial matches, but should never surface completely irrelevant results.

**fuse.js configuration** (same as web):

```typescript
const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'source', weight: 0.2 },
    { name: 'section', weight: 0.1 },
    { name: 'subsection', weight: 0.1 },
    { name: 'keywords', weight: 0.2 },
  ],
  threshold: 0.4,          // 0 = exact match, 1 = match anything
  distance: 100,
  minMatchCharLength: 2,
  includeScore: true,
};
```

**Accuracy enhancements over web**: The mobile `search-index.json` includes a `keywords` field extracted during feed generation. This gives search a structured vocabulary that the web's fuse.js (which searches raw article data) doesn't have. Keywords are extracted from the title, source, section, and subsection using a simple tokenizer in `build_mobile_feed.py`.

### 18.6 Notification Accuracy

**First principle**: A notification should never tell the user about content that doesn't exist when they tap it.

**Race condition**: The push service sends a notification about "5 new articles in Tech," but by the time the user taps it (minutes to hours later), the next build may have changed the feed. The article referenced in the notification may have been deduplicated, re-ranked, or aged out.

**Mitigation**:
- Notifications link to section views (`pulse://section/tech`), not individual articles, unless the article has a stable ID that will persist across builds
- For "Must Read" and "Frontier" notifications that reference specific articles, use the stable article ID in the deep link (`pulse://article/tech-abc123`)
- The app, on receiving a deep link, first refreshes the manifest, then navigates. If the article no longer exists, show a graceful "Article no longer available" message, not a crash or blank screen

---

## 19. Compliance Architecture (First Principles)

### 19.1 The Compliance Landscape

Pulse operates at the intersection of content aggregation, push notifications, and app distribution. Each carries legal and ethical obligations:

| Domain | Obligation | Governing Authority |
|--------|-----------|-------------------|
| Content rights | Respect publishers' terms, robots.txt, copyright | Copyright law, robots.txt standard |
| User privacy | Minimal data collection, transparency | GDPR, CCPA, Apple/Google policies |
| App Store rules | No repackaged websites, proper content attribution | Apple App Review Guidelines, Google Play Policy |
| Push notifications | No spam, respect user preferences | Apple APNs guidelines, CAN-SPAM principles |
| Accessibility | Usable by people with disabilities | WCAG 2.1, Apple HIG, Android Accessibility |

### 19.2 Content Rights and Ethics

**First principle**: Pulse is a curation and routing service, not a content host. The app helps users discover articles and directs them to the original source. It does not substitute for visiting the source.

**What the app may display** (rights-safe):
- Article title (factual, not copyrightable in most jurisdictions)
- Source name and URL (factual attribution)
- Publication date and freshness metadata
- `og:description` or first paragraph excerpt (as fetched by `intro_fetcher.py` with robots/nosnippet compliance)
- Section and subsection classification (Pulse's own taxonomy)

**What the app must NOT do**:
- Display full article text (unless the source explicitly permits it via license)
- Cache or store full article content for offline reading (only metadata + intro)
- Strip ads or paywalls from source sites when opening in-app browser
- Present Pulse's excerpts as a substitute for visiting the source
- Scrape or display content from sources that have `nosnippet` or `noarchive` directives

**Source attribution**: Every article card and detail screen must prominently display the source name. The "Open in browser" action must go to the canonical source URL, not a Pulse-hosted copy.

**Existing compliance infrastructure** (inherited from crawler):
- `crawler/robots_checker.py` — respects `robots.txt` for every source
- `crawler/intro_fetcher.py` — respects `nosnippet` meta directives
- `CONTENT-POLICY.md` — documents the legal compliance spec
- `config/sources.yaml` — includes `policy` field per source

### 19.3 User Privacy

**First principle**: Collect the minimum data necessary for the product to function. Pulse Mobile collects almost nothing.

**Data inventory**:

| Data | Collected? | Stored Where | Purpose | Retention |
|------|-----------|-------------|---------|-----------|
| Device push token | Yes (opt-in) | Cloudflare D1 | Push notifications | Until uninstalled or token invalidated |
| Section subscriptions | Yes (opt-in) | Cloudflare D1 | Targeted push | Until changed by user |
| Platform (iOS/Android) | Yes | Cloudflare D1 | Push routing | With installation record |
| Installation UUID | Yes | Device + D1 | Idempotent registration | With installation record |
| App version | Yes | Cloudflare D1 | Compatibility | With installation record |
| Saved article IDs | Yes | Device only (MMKV) | Saved articles feature | Until user deletes |
| Article reading history | No | — | — | — |
| Location | No | — | — | — |
| Name, email, phone | No | — | — | — |
| Device fingerprint | No | — | — | — |
| Analytics / tracking | No | — | — | — |

**Privacy commitments**:
- No user accounts. No PII collected.
- No third-party analytics SDKs (no Firebase Analytics, no Mixpanel, no Amplitude)
- No advertising SDKs
- No cross-app tracking identifiers
- Push token is the only server-stored identifier, and it's opaque (Expo-generated UUID)
- Saved articles and reading state are local-only and never transmitted
- The app does not use `IDFA` (Identifier for Advertisers) and can truthfully answer "No" on Apple's App Tracking Transparency prompt

**Privacy policy**: Required by both App Store and Play Store. Must document: what data is collected, why, where it's stored, how to request deletion. For Pulse, this is a very short document because the data collection surface is minimal.

**GDPR compliance**: Since Pulse collects only push tokens (no PII), GDPR obligations are minimal. However, the push service should support a `/delete-installation` endpoint that removes all data for a given installation_id, in case a user requests data deletion.

### 19.4 App Store Compliance

**Apple App Review Guidelines — Key requirements**:

| Guideline | Pulse Compliance |
|-----------|-----------------|
| 4.2 Minimum Functionality | Native search, saved articles, push notifications, widgets, offline cache, section filtering — well beyond "repackaged website" |
| 4.2.6 Content aggregators | Pulse adds significant value: freshness ranking, deduplication, multi-source taxonomy, Must Read curation. Not a "simple collection of links" |
| 5.1.1 Data Collection | Minimal — push token only, no tracking, no PII |
| 5.1.2 Data Use and Sharing | No data shared with third parties |
| 2.5.4 Background execution | Push notifications via APNs (approved use). No background polling. |

**Google Play Policy — Key requirements**:

| Policy | Pulse Compliance |
|--------|-----------------|
| User Data policy | Privacy policy required (will provide) |
| Data Safety section | Declare: push tokens collected, no PII, no sharing |
| Deceptive behavior | Transparent about what Pulse does (aggregation + curation) |
| Spam & minimum functionality | Native features beyond web wrapper |

### 19.5 Push Notification Ethics

**First principle**: Notifications are a privilege granted by the user, not a marketing channel. Every notification must deliver genuine value.

**Rules**:

1. **Permission must be earned**: Don't request push permission on first launch. Wait until the user has used the app for a session or explicitly navigates to notification settings. Explain what they'll receive before asking.

2. **No dark patterns**: The permission request must have a clear "Not now" option. Denying push permission must not degrade the core reading experience.

3. **Content, not engagement bait**: Notifications contain article titles and section names. Never "You haven't opened Pulse in 3 days!" or "Your feed is waiting!" These are engagement manipulation, not user value.

4. **Respect frequency**: Maximum 2-3 notifications per hour, batched by section. Users who follow 6 sections should not receive 6 notifications per build.

5. **Easy unsubscribe**: One-tap unsubscribe from a notification's long-press action. Clear per-section toggle in settings. Unsubscribe must work immediately, not "within 24 hours."

6. **No silent data collection**: Background push notifications are used only for content update signaling, never for analytics pings or device fingerprinting.

### 19.6 Accessibility

**First principle**: Every user, regardless of ability, should be able to access Pulse's content.

**Requirements**:

| Feature | Implementation |
|---------|---------------|
| VoiceOver (iOS) / TalkBack (Android) | All interactive elements have `accessibilityLabel`. Article cards read: title, source, section, freshness. |
| Dynamic Type (iOS) | All text scales with system font size preference. Test at largest accessibility size. |
| Color contrast | All text meets WCAG 2.1 AA minimum (4.5:1 for body, 3:1 for large text). The dark theme's `#e4e4ed` on `#08080f` = 15.3:1 ratio (passes AAA). |
| Reduce Motion | When system "Reduce Motion" is enabled, disable neural background animation, disable card tilt effects, use simple crossfades instead of spring animations. |
| Screen magnification | UI must remain functional at 200% zoom. No content hidden behind non-scrollable areas. |
| Touch targets | Minimum 44x44pt for all interactive elements (Apple HIG minimum). |

**Testing**: Run VoiceOver audit on every screen before TestFlight submission. The Xcode Accessibility Inspector automates this.

### 19.7 Network Ethics

**First principle**: The app should be a good citizen of the internet.

- **Respect rate limits**: GitHub Pages has no explicit rate limit, but the app should not fetch more frequently than once per minute even during aggressive pull-to-refresh.
- **Respect cache headers**: Honor `Cache-Control`, `ETag`, and `Last-Modified` headers from GitHub Pages.
- **No scraping from the app**: The app never fetches article content from source websites. It only opens the source URL in an in-app browser or system browser, which is the user's own browsing action.
- **User-Agent**: The app's network requests include a proper `User-Agent` string identifying Pulse Mobile and version, not a spoofed browser UA.

### 19.8 Compliance Validation Checklist

Run before every App Store / Play Store submission:

- [ ] Privacy policy URL is live and accurate
- [ ] Data Safety / App Privacy questionnaire matches actual data collection
- [ ] Push permission is requested only after user context, not on first launch
- [ ] All interactive elements have accessibility labels
- [ ] Dynamic Type tested at largest size
- [ ] VoiceOver audit passed on all screens
- [ ] Reduce Motion respected (no animation when system setting is on)
- [ ] Color contrast meets WCAG 2.1 AA on all text
- [ ] Touch targets are minimum 44x44pt
- [ ] No third-party tracking SDKs included
- [ ] No IDFA usage
- [ ] Article attribution (source name) visible on every card
- [ ] "Open in browser" goes to canonical source URL
- [ ] No full article text cached or displayed (metadata + excerpt only)
- [ ] JSON schema validation passes in CI
- [ ] Push notification rate limiting is enforced
- [ ] `/delete-installation` endpoint works for GDPR requests

---

## 20. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Feed contract churn after app starts | Phase 0 freezes schemas with CI validation before app code |
| Push service looks simple but decays operationally | Implement receipts, dead-token cleanup, and replay from day one |
| Widget scope creeps into v1 | Widgets are Phase 4, explicitly after app core + push |
| Article IDs drift between builds | Formalized deterministic ID algorithm, tested against corpus |
| Visual ambition delays data correctness | Theme/motion sequenced AFTER manifest sync and caching work |
| Previous-state diff source is ambiguous | Fetch prior manifest from LIVE GitHub Pages, not CI workspace |
| App rejected as "repackaged website" | Native features: widgets, push, saved, offline, search |
| Content rights violation | Metadata + excerpt only, never full text. Respect nosnippet. Source attribution on every card |
| Accessibility failure | VoiceOver audit, Dynamic Type testing, contrast checks before every submission |
| Push notification fatigue | Hard cap 2-3/hr, section batching, no engagement bait |
| Privacy regulation exposure | Near-zero data collection, `/delete-installation` endpoint, no PII, no tracking SDKs |
| Performance regression on older devices | 30fps cap, Reduce Motion respect, memory budget monitoring, FlashList |

---

## 21. Existing Web Codebase Reference

**Repo**: `MrNullPointer/elevendots-pulse`
**Local path**: `/Users/rishi/Library/Mobile Documents/com~apple~CloudDocs/DEV/elevendots-pulse`
**Live site**: https://pulse.elevendots.dev

Key files for porting:

| File | Purpose |
|------|---------|
| `site/src/hooks/useArticles.js` | Data loading, section partitioning |
| `site/src/hooks/useFilters.js` | Subsection/time/access/sort filtering |
| `site/src/components/NeuralBackground.jsx` | Canvas neural constellation (747 lines, visual reference) |
| `site/src/components/ArticleCard.jsx` | Article card component |
| `site/src/components/SearchOverlay.jsx` | Fuzzy search with fuse.js |
| `site/src/components/SubsectionBar.jsx` | Subsection filter pills |
| `site/src/index.css` | All CSS with glass hierarchy tokens |
| `crawler/freshness.py` | Freshness scoring formula |
| `config/sources.yaml` | All 165+ sources with section/subsection config |
| `site/index.html` | OG meta tags, favicon links |

---

## 22. Immediate Next Steps

1. **Freeze the feed contract** (Phase 0)
2. Design the article ID algorithm and test against real corpus snapshots
3. Implement `build_mobile_feed.py` with fixture generation
4. Add schema validation to CI
5. Generate sample mobile artifacts from today's Pulse data
6. Start the Expo app only after those artifacts exist on GitHub Pages

---

*This document is the single source of truth for Pulse Mobile architecture. Update it as decisions change. Do not start app implementation until Phase 0 exit criteria are met.*
