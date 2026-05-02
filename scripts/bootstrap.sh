#!/usr/bin/env bash
# Bootstrap a product repo from forjio-service-template.
# Usage: ./scripts/bootstrap.sh <brand>
# Example: ./scripts/bootstrap.sh huudis
set -euo pipefail
brand="${1:?usage: bootstrap.sh <brand>}"
BrandCap="$(tr '[:lower:]' '[:upper:]' <<< "${brand:0:1}")${brand:1}"

echo "Renaming forjio-brand → $brand, Forjio Brand → $BrandCap ..."
# Replace across tracked files. Using find + portable sed.
find backend frontend cli e2e -type f \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.json' \
     -o -name '*.md' -o -name '*.yml' -o -name '*.example' -o -name '*.prisma' \) \
  -exec sed -i "s|forjio-brand|$brand|g; s|Forjio Brand|$BrandCap|g; s|forjio_brand|$(echo $brand | tr - _)|g" {} +

echo "Done. Commit the rename, install deps, and proceed per SETUP.md."
