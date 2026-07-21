#!/bin/bash
# Stage 1 of 2 (8:00am): generate copy-only draft, email it for review.
# Triggered by launchd — see
# scripts/content-engine/com.casefile.content-engine-draft.plist.
set -euo pipefail
cd "$(dirname "$0")/../.."

DATE=$(date +%Y-%m-%d)

npx tsx --env-file=.env.local scripts/content-engine/generate.ts
npx tsx --env-file=.env.local scripts/content-engine/sendDraftEmail.ts "$DATE"
