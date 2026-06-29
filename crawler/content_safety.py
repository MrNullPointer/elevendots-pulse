"""
Shared content-safety patterns for rendered article fields.

Single source of truth for the rules enforced at the two gates that must never
drift apart:

  * the crawler admission gate (``crawler/main.py``) — quarantines any article
    whose ``title``/``intro`` trips a pattern *before* it is written to
    ``data/articles.json``, and
  * the compliance re-validation gate (``tests/test_compliance.py`` ::
    ``TestArticleDataSafety``) — asserts the committed artifact is clean.

Both import these patterns from here, so the admission gate and the
re-validation gate can never enforce different rules.
"""

import re

# High-length, high-entropy patterns — these match REAL tokens (>=32 chars of
# token-alphabet material) rather than prose that mentions auth keywords.
RENDERED_CREDENTIAL_PATTERNS = [
    re.compile(r"\bBearer\s+[A-Za-z0-9\-._~+/]{32,}={0,2}\b"),
    re.compile(r"\bsk-[A-Za-z0-9]{32,}\b"),
    re.compile(r"\bghp_[A-Za-z0-9]{36}\b"),
    re.compile(r"\bgho_[A-Za-z0-9]{36,}\b"),
    re.compile(r"\bAKIA[A-Z0-9]{16}\b"),
    re.compile(
        r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b"
    ),
    re.compile(r"-----BEGIN\s+(?:RSA\s+|EC\s+)?PRIVATE\s+KEY-----"),
]

FORBIDDEN_RENDERED_HTML = [
    re.compile(r"<script", re.IGNORECASE),
    re.compile(r"javascript:", re.IGNORECASE),
    re.compile(r"on(?:click|error|load|mouseover)\s*=", re.IGNORECASE),
    re.compile(r"<iframe", re.IGNORECASE),
]

# Fields the frontend renders directly and that the gates therefore police.
CHECKED_FIELDS = ("title", "intro")


def find_unsafe_pattern(article: dict) -> tuple[str, str] | None:
    """Return ``(field, pattern)`` for the first safety pattern an article trips.

    Inspects the rendered fields (``title``/``intro``) against the forbidden
    HTML/JS patterns and the credential patterns. Returns ``None`` when the
    article is clean.
    """
    for field in CHECKED_FIELDS:
        text = article.get(field, "") or ""
        for pat in FORBIDDEN_RENDERED_HTML:
            if pat.search(text):
                return (field, pat.pattern)
        for pat in RENDERED_CREDENTIAL_PATTERNS:
            if pat.search(text):
                return (field, pat.pattern)
    return None
