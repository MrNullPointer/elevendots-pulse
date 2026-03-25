"""
Post-build script: Generate section HTML files with per-section OG tags.

Takes the built dist/index.html (which has the correct hashed JS/CSS bundle
references) and creates copies at dist/{section}/index.html with modified
OG meta tags so social media crawlers see section-specific previews.

Run AFTER `npm run build`, BEFORE deploy.

Usage: python scripts/generate_section_og.py
"""

import os
import re

DIST_DIR = os.path.join("site", "dist")

SECTIONS = {
    "tech": {
        "title": "Tech — Pulse by elevendots",
        "description": "Computing, chips, AI, systems, and emerging hardware. Curated from 100+ sources.",
        "image": "og-article-default.png",
    },
    "science": {
        "title": "Science — Pulse by elevendots",
        "description": "Astronomy, chemistry, biology, physics, and beyond. Curated from 100+ sources.",
        "image": "og-section-science.png",
    },
    "philosophy": {
        "title": "Philosophy — Pulse by elevendots",
        "description": "Ideas, ethics, mind, knowledge, and meaning. Curated from 100+ sources.",
        "image": "og-section-philosophy.png",
    },
    "world": {
        "title": "World — Pulse by elevendots",
        "description": "Global news, politics, economics, geopolitics, and public policy. Curated from 140+ sources.",
        "image": "og-homepage.png",  # Reuse homepage OG until dedicated world card is designed
    },
    "misc": {
        "title": "Miscellaneous — Pulse by elevendots",
        "description": "Essays, culture, long reads, and uncategorized gems. Curated from 140+ sources.",
        "image": "og-section-misc.png",
    },
}

BASE_URL = "https://pulse.elevendots.dev"


def main():
    index_path = os.path.join(DIST_DIR, "index.html")
    with open(index_path, "r") as f:
        base_html = f.read()

    for slug, meta in SECTIONS.items():
        html = base_html

        # Replace <title>
        html = re.sub(
            r"<title>[^<]*</title>",
            f"<title>{meta['title']}</title>",
            html,
        )

        # Replace og:title
        html = re.sub(
            r'<meta property="og:title" content="[^"]*"',
            f'<meta property="og:title" content="{meta["title"]}"',
            html,
        )

        # Replace og:description
        html = re.sub(
            r'<meta property="og:description" content="[^"]*"',
            f'<meta property="og:description" content="{meta["description"]}"',
            html,
        )

        # Replace og:url
        html = re.sub(
            r'<meta property="og:url" content="[^"]*"',
            f'<meta property="og:url" content="{BASE_URL}/{slug}"',
            html,
        )

        # Replace og:image
        html = re.sub(
            r'<meta property="og:image" content="[^"]*"',
            f'<meta property="og:image" content="{BASE_URL}/og/{meta["image"]}"',
            html,
        )

        # Replace twitter:title
        html = re.sub(
            r'<meta name="twitter:title" content="[^"]*"',
            f'<meta name="twitter:title" content="{meta["title"]}"',
            html,
        )

        # Replace twitter:description
        html = re.sub(
            r'<meta name="twitter:description" content="[^"]*"',
            f'<meta name="twitter:description" content="{meta["description"]}"',
            html,
        )

        # Replace twitter:image
        html = re.sub(
            r'<meta name="twitter:image" content="[^"]*"',
            f'<meta name="twitter:image" content="{BASE_URL}/og/{meta["image"]}"',
            html,
        )

        # Replace canonical
        html = re.sub(
            r'<link rel="canonical" href="[^"]*"',
            f'<link rel="canonical" href="{BASE_URL}/{slug}"',
            html,
        )

        # Write to dist/{slug}/index.html
        out_dir = os.path.join(DIST_DIR, slug)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "index.html")
        with open(out_path, "w") as f:
            f.write(html)

        print(f"  {slug}/index.html — og:image={meta['image']}")

    print(f"Generated {len(SECTIONS)} section OG pages")


if __name__ == "__main__":
    main()
