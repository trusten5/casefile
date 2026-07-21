#!/bin/bash
# Full daily content-engine pipeline: generate copy, render slides, email a
# low-res preview to your phone. Triggered by launchd — see
# scripts/content-engine/com.casefile.content-engine.plist.
set -euo pipefail
cd "$(dirname "$0")/../.."

DATE=$(date +%Y-%m-%d)

npx tsx --env-file=.env.local scripts/content-engine/generate.ts
npx tsx --env-file=.env.local scripts/content-engine/render.ts "$DATE"
npx tsx --env-file=.env.local scripts/content-engine/sendEmail.ts "$DATE"
