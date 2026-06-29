#!/usr/bin/env bash
# init.sh — Wrapper bash del verificador del harness (git-bash / CI).
# Equivale a `npm run harness:verify`. Úsalo: ./init.sh
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/scripts/harness/verify.mjs"
