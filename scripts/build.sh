#!/bin/bash
# ---------------------------------------------------------------------------
# Elevendots-Pulse — Local Build Script
#
# Developer: Parikshit Dubey
# Contact:   support@elevendots.ai
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=========================================="
echo "Elevendots-Pulse Local Build"
echo "=========================================="

echo ""
echo "Step 1: Running crawler..."
cd "$ROOT"
python -m crawler.main

echo ""
echo "Step 2: Copying articles.json..."
cp data/articles.json site/public/articles.json

echo ""
echo "Step 3: Building static site..."
cd "$ROOT/site"
npm run build

echo ""
echo "Done! Preview with: npx serve site/dist"
