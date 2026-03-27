---
paths:
  - "schemas/**/*.json"
---
# JSON Schema Rules
- Draft 2020-12 (JSON Schema specification)
- Every schema has $id, $schema, title, description
- Required fields explicitly listed (not implicit)
- Article IDs: pattern "^[a-z]+-[a-f0-9]{12}$" (section prefix + 12-char hex)
- Timestamps: format "date-time" (ISO 8601)
- Section keys: enum ["tech","science","philosophy","world","research","misc"]
- No additionalProperties: false on top-level (allows forward-compatible evolution)
- additionalProperties: false on nested objects that must be exact
- All numeric fields have minimum/maximum constraints where logical
- freshness_score: integer, minimum 0
- feed_schema_version: integer, minimum 1
