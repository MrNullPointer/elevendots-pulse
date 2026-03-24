# ElevenDots Pulse — Knowledge Navigator

A config-driven knowledge aggregator with Apple Liquid Glass UI.
Surfaces headlines and previews from 100+ tech, science, and philosophy
sources. Updated every hour. 

## Quick start

```bash
pip install -r crawler/requirements.txt
cd site && npm install && cd ..
python -m crawler.main
cp data/articles.json site/public/articles.json
cd site && npm run dev
```

## Adding sources / sections / subsections

Edit `config/sources.yaml`. Push. Next crawl picks it up.
See `GUIDE.md` for full details.

## Architecture

```
sources.yaml → Python Crawler → articles.json → React Static Build → GitHub Pages
                    ↑                                                       ↑
            GitHub Actions (cron 1h)                                  pulse.elevendots.dev
```

## Docs

- `GUIDE.md` — Step-by-step build guide with Claude Code prompts
- `CONTENT-POLICY.md` — Legal compliance and content policy

## License

MIT
