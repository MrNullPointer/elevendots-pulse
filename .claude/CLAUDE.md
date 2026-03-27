# Pulse Mobile — Claude Code Master Instructions

## Project Overview
Pulse (pulse.elevendots.dev) is a news aggregator crawling 165+ sources hourly
across 6 sections: Tech, Research, Science, Philosophy, World, Misc.
We are building a mobile app with Expo + React Native.

Full architecture: see PULSE-MOBILE-ARCHITECTURE.md in repo root.

## Frozen Architectural Decisions (NEVER deviate without explicit discussion)
1. App core: Expo SDK 52+ / React Native / TypeScript strict
2. Read path: GitHub Pages static JSON (zero-cost, globally cached)
3. Push backend: Cloudflare Worker + D1 (SQLite at edge)
4. State management: Zustand (global) + MMKV (persistence) + TanStack Query (server state)
5. Search: fuse.js over local search-index.json (no server search)
6. Navigation: Expo Router (file-based routing)
7. List rendering: @shopify/flash-list (NEVER FlatList)
8. No background refresh dependence — foreground-first freshness
9. No Live Activities — hourly refresh doesn't match ActivityKit
10. Widgets are Phase 4 only — not before app core + push stabilize
11. Article IDs: SHA-256 of normalized canonical URL (deterministic, stable)
12. No client-side re-ranking — feed freshness_score is canonical
13. No on-device crawling or ranking — keep computation in CI

## Build & Test Commands
### Python (feed builder, schemas)
- Build mobile feed: `python scripts/build_mobile_feed.py`
- Validate schemas: `python scripts/validate_mobile_feed.py --schemas schemas/ --feed site/public/mobile/`
- Run Python tests: `cd tests && python -m pytest -v`
- Run crawler: `python crawler/main.py` (needs env vars)

### Mobile (Expo app)
- Install deps: `cd mobile && npm install`
- Start dev: `cd mobile && npx expo start`
- iOS simulator: `cd mobile && npx expo run:ios`
- Run tests: `cd mobile && npm test -- --watchAll=false`
- Type check: `cd mobile && npx tsc --noEmit`
- Lint: `cd mobile && npx eslint src/ app/ --ext .ts,.tsx`
- EAS build (dev): `cd mobile && eas build --platform ios --profile development`
- EAS build (prod): `cd mobile && eas build --platform ios --profile production`

### Push Worker
- Dev server: `cd workers/notify && npx wrangler dev`
- Run tests: `cd workers/notify && npm test`
- Deploy: `cd workers/notify && npx wrangler deploy`
- D1 migrate: `cd workers/notify && npx wrangler d1 migrations apply pulse-push-db`

## Code Conventions
- TypeScript strict mode everywhere. No `any` unless explicitly justified with a comment.
- Functional components with hooks. No class components. Ever.
- Named exports for components, default exports for screens.
- Import order: react → react-native → expo → third-party → @/ local aliases
- Co-locate tests: Component.tsx → Component.test.tsx (same directory)
- Zustand stores in src/store/ — one store per domain (articles, saved, settings, notifications)
- Theme tokens in src/lib/theme.ts — NEVER hardcode colors, spacing, or font sizes
- All network requests go through src/lib/api.ts — no raw fetch() in components
- All async data fetching uses TanStack Query — NEVER useEffect + fetch
- Every interactive element MUST have accessibilityLabel
- Every screen title MUST have accessibilityRole="header"
- Touch targets minimum 44x44pt (iOS HIG requirement)

## Design System (match web exactly)
### Palettes
- Dark: background=#08080f, text=#e4e4ed, surface=rgba(255,255,255,0.03)
- Light: background=#f0f0ea, text=#1a1a2e, surface=rgba(0,0,0,0.03)

### Section Colors
- Tech=#4080FF, Research=#10B981, Science=#A050FF
- Philosophy=#E0A030, World=#DC2828, Misc=#A0A0C0, Home=#6868E0

### Typography
- Body/UI: DM Sans
- Code/timestamps: JetBrains Mono
- Sizes: Display=28, Title=22, Headline=18, Body=16, Caption=14, Badge=12

### Glass Hierarchy (5 levels)
- Atmosphere (transparent, no blur), Nav (0.7 opacity, 20px blur),
  Pill (0.03, 8px), Card (0.03, 12px), Focused (0.06, 16px)

## Performance Budgets (enforce in tests)
- First meaningful paint (cached): < 500ms
- JS thread FPS during scroll: > 58fps
- Memory high water mark: < 150MB (iPhone), < 200MB (iPad)
- Bundle size (JS): < 5MB
- Network bytes per session: < 100KB average
- Neural background CPU when idle: < 5%

## Current Phase
Phase 0 — Contract Freeze
(Update this line as we progress through phases)

## Key File References
- Architecture doc: @PULSE-MOBILE-ARCHITECTURE.md
- Web article card: @site/src/components/ArticleCard.jsx
- Web neural bg: @site/src/components/NeuralBackground.jsx
- Web search: @site/src/components/SearchOverlay.jsx
- Web useArticles: @site/src/hooks/useArticles.js
- Web useFilters: @site/src/hooks/useFilters.js
- Web CSS tokens: @site/src/index.css
- Freshness scoring: @crawler/freshness.py
- Source config: @config/sources.yaml
- Existing CI: @.github/workflows/
