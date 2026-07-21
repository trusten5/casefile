#!/bin/bash
# Stage 2 of 2 (8:30am): render whatever's in today's draft.json (edited or
# not) into slide images, email the previews. Triggered by launchd — see
# scripts/content-engine/com.casefile.content-engine-render.plist.
set -euo pipefail
cd "$(dirname "$0")/../.."

DATE=$(date +%Y-%m-%d)

npx tsx --env-file=.env.local scripts/content-engine/render.ts "$DATE"
npx tsx --env-file=.env.local scripts/content-engine/sendEmail.ts "$DATE"
