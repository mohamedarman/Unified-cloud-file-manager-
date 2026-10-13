#!/usr/bin/env bash
set -euo pipefail

echo "==> Running detekt with auto-correct..."
./gradlew detekt --auto-correct

echo "==> Running detekt, lint, unit tests, and Room schema generation..."
./gradlew detekt lint testDebugUnitTest :data:kspDebugKotlin

echo "==> Checking for uncommitted Room schema drift..."
if [ -n "$(git status --porcelain -- data/schemas)" ]; then
  echo "::error::Room schema changed without being committed."
  git status --porcelain -- data/schemas
  git diff -- data/schemas | head -100
  exit 1
fi

echo "==> All preflight verification checks passed successfully!"
