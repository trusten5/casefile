// Emails a low-res JPEG preview of every slide in an approved+rendered
// batch to your phone via Mail.app (AppleScript) — no third-party email
// service needed, uses whatever account Mail.app already sends from.
//
// Sends one email PER POST rather than one email for the whole batch —
// bundling 20+ images into a single message showed up inconsistently
// (sometimes 0 of them arrived, per Mail/Gmail's own Sent record) even
// with correct attachment-insertion AppleScript. Smaller per-post emails
// (~6-8 images each) keep each message's payload well under whatever
// threshold was causing that.
//
// Run with: npx tsx scripts/content-engine/sendEmail.ts <date>
import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Draft } from "./generateCopy";

const PREVIEW_MAX_PX = 540;
const PREVIEW_QUALITY = 70;
const DELAY_BETWEEN_SENDS_MS = 3000;

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendMailWithAttachments(opts: { recipient: string; subject: string; body: string; attachmentPaths: string[] }) {
  const subject = escapeForAppleScript(opts.subject);
  const body = escapeForAppleScript(opts.body);
  // Attachments must be inserted into the message's `content` (not the
  // message itself) or Mail silently drops them. `visible:true` matters too
  // — an invisible message has no rendered content view for the attachment
  // to land in. The `delay` gives Mail a moment to finish inserting before
  // `send` fires.
  const attachmentLines = opts.attachmentPaths
    .map(
      (p) =>
        `make new attachment with properties {file name:(POSIX file "${escapeForAppleScript(p)}") as alias} at after the last paragraph`
    )
    .join("\n      ");

  const script = `
tell application "Mail"
  set newMsg to make new outgoing message with properties {subject:"${subject}", content:"${body}", visible:true}
  tell newMsg
    make new to recipient at end of to recipients with properties {address:"${escapeForAppleScript(opts.recipient)}"}
    tell content
      ${attachmentLines}
    end tell
  end tell
  delay 2
  send newMsg
end tell
`;

  const scriptDir = mkdtempSync(join(tmpdir(), "content-engine-send-"));
  const scriptPath = join(scriptDir, "send.applescript");
  writeFileSync(scriptPath, script);
  execFileSync("osascript", [scriptPath]);
  rmSync(scriptDir, { recursive: true, force: true });
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

  for (let i = 0; i < drafts.length; i++) {
    const { label, post } = drafts[i];
    const postDir = join(batchDir, label);
    const slideFiles = readdirSync(postDir)
      .filter((f) => f.endsWith(".png"))
      .sort();

    const attachmentPaths = slideFiles.map((file) => {
      const outPath = join(previewDir, `${label}-${file.replace(".png", ".jpg")}`);
      toJpegPreview(join(postDir, file), outPath);
      return outPath;
    });

    const body = `${label} — ${post.hook}\n\nCaption: ${post.caption}`;
    sendMailWithAttachments({
      recipient,
      subject: `Content ready — ${date} — ${label}`,
      body,
      attachmentPaths,
    });
    console.log(`[${label}] emailed ${attachmentPaths.length} preview images to ${recipient}`);

    if (i < drafts.length - 1) await sleep(DELAY_BETWEEN_SENDS_MS);
  }

  rmSync(previewDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
