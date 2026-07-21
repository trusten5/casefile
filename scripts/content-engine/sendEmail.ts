// Emails a low-res JPEG preview of every slide in an approved+rendered
// batch to your phone via Mail.app (AppleScript) — no third-party email
// service needed, uses whatever account Mail.app already sends from.
//
// Run with: npx tsx scripts/content-engine/sendEmail.ts <date>
import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Draft } from "./generateCopy";

const PREVIEW_MAX_PX = 540;
const PREVIEW_QUALITY = 70;

function toJpegPreview(pngPath: string, outPath: string) {
  execFileSync("sips", [
    "-s",
    "format",
    "jpeg",
    "-Z",
    String(PREVIEW_MAX_PX),
    "--setProperty",
    "formatOptions",
    String(PREVIEW_QUALITY),
    pngPath,
    "--out",
    outPath,
  ]);
}

function escapeForAppleScript(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function main() {
  const date = process.argv[2];
  if (!date) {
    console.error("Usage: npx tsx scripts/content-engine/sendEmail.ts <date>");
    process.exit(1);
  }

  const recipient = process.env.ADMIN_EMAIL;
  if (!recipient) throw new Error("ADMIN_EMAIL is not set");

  const batchDir = join(__dirname, "..", "..", "content", "output", date);
  const draftPath = join(batchDir, "draft.json");
  if (!existsSync(draftPath)) throw new Error(`No draft found at ${draftPath} — run generate.ts + render.ts first.`);
  const drafts: Draft[] = JSON.parse(readFileSync(draftPath, "utf8"));

  const previewDir = mkdtempSync(join(tmpdir(), "content-engine-preview-"));
  const attachmentPaths: string[] = [];
  const bodyLines: string[] = [`Content batch for ${date}`, ""];

  for (const { label, post } of drafts) {
    bodyLines.push(`— ${label} —`, `Hook: ${post.hook}`, "");
    const postDir = join(batchDir, label);
    const slideFiles = readdirSync(postDir)
      .filter((f) => f.endsWith(".png"))
      .sort();

    for (const file of slideFiles) {
      const jpgName = `${label}-${file.replace(".png", ".jpg")}`;
      const outPath = join(previewDir, jpgName);
      toJpegPreview(join(postDir, file), outPath);
      attachmentPaths.push(outPath);
    }
  }

  const subject = escapeForAppleScript(`Content batch ready — ${date}`);
  const body = escapeForAppleScript(bodyLines.join("\n"));
  const attachmentLines = attachmentPaths
    .map((p) => `make new attachment with properties {file name:(POSIX file "${escapeForAppleScript(p)}")} at after the last paragraph`)
    .join("\n    ");

  const script = `
tell application "Mail"
  set newMsg to make new outgoing message with properties {subject:"${subject}", content:"${body}", visible:false}
  tell newMsg
    make new to recipient at end of to recipients with properties {address:"${escapeForAppleScript(recipient)}"}
    ${attachmentLines}
  end tell
  send newMsg
end tell
`;

  const scriptPath = join(previewDir, "send.applescript");
  writeFileSync(scriptPath, script);
  execFileSync("osascript", [scriptPath]);

  rmSync(previewDir, { recursive: true, force: true });
  console.log(`Emailed ${attachmentPaths.length} preview images to ${recipient}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
