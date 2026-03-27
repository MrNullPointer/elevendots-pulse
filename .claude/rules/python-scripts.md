---
paths:
  - "scripts/**/*.py"
  - "tests/**/*.py"
---
# Python Script Rules
- Python 3.11+ with type hints on all function signatures
- Use pathlib for file paths, not os.path
- Use httpx for HTTP requests (async-capable, timeout-aware)
- All functions must have docstrings
- Use pytest for tests, not unittest
- JSON schema validation uses jsonschema library
- Hash computation uses hashlib.sha256
- URL normalization uses urllib.parse
- Output paths are always configurable via CLI args or function params
- Error handling: catch specific exceptions, never bare except
- Logging: use logging module, not print()
