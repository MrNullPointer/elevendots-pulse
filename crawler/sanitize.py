# ---------------------------------------------------------------------------
# Elevendots-Pulse Crawler — Content Sanitization
# Redacts credential-shaped tokens from scraped third-party text.
#
# Rationale (CONTENT-POLICY §1.4, §2.3):
#   Pulse scrapes titles/intros from 165+ upstream sources. A compromised or
#   poorly-edited upstream page could contain a real API key, Bearer token,
#   or private key fragment in its <title> or meta description. Because the
#   frontend renders these fields directly, any such leak would be
#   re-published on pulse.elevendots.dev. This module is the last line of
#   defense before `data/articles.json` is written.
#
#   Redaction preserves the surrounding prose so the reader still sees
#   context (e.g., "... used Bearer [REDACTED] to authenticate ..."),
#   which is preferable to dropping the article entirely.
#
# Idempotent: safe to apply multiple times; `[REDACTED]` is not re-matched.
# ---------------------------------------------------------------------------

import re
from typing import List, Tuple

# Tight patterns — each requires enough entropy/length to indicate an actual
# credential rather than prose that merely mentions the keyword. The length
# floors are calibrated against real-world token shapes:
#   - OAuth 2.0 Bearer (RFC 6750): real tokens from major IdPs are >=32 chars
#   - OpenAI API keys:  sk-<48 chars>
#   - GitHub PATs:      ghp_<36 chars>
#   - AWS access keys:  AKIA<16 uppercase alnum>
#   - JWTs:             three base64url segments separated by '.'
_REDACTIONS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]{32,}={0,2}\b"), "Bearer [REDACTED]"),
    (re.compile(r"\bsk-[A-Za-z0-9]{32,}\b"), "[REDACTED]"),
    (re.compile(r"\bghp_[A-Za-z0-9]{36}\b"), "[REDACTED]"),
    (re.compile(r"\bgho_[A-Za-z0-9]{36,}\b"), "[REDACTED]"),
    (re.compile(r"\bAKIA[A-Z0-9]{16}\b"), "[REDACTED]"),
    (
        re.compile(
            r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b"
        ),
        "[REDACTED_JWT]",
    ),
    (
        re.compile(r"-----BEGIN\s+(?:RSA\s+|EC\s+)?PRIVATE\s+KEY-----"),
        "[REDACTED_PRIVATE_KEY]",
    ),
]


def redact_credentials(text: str) -> str:
    """Remove credential-shaped tokens from scraped text.

    Applied after HTML is stripped and BEFORE any length cap, so truncation
    cannot split a token and hide a partial match from downstream scanners.

    Args:
        text: Already-plaintext content (HTML should be stripped first).

    Returns:
        The same text with any credential-shaped substrings replaced by a
        short placeholder. Returns the input unchanged when it is falsy.
    """
    if not text:
        return text
    for pattern, replacement in _REDACTIONS:
        text = pattern.sub(replacement, text)
    return text
