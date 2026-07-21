// Emails the copy-only draft (review.md — includes each slide's future
// filename) for review via Mail.app/AppleScript. Edit
// content/output/<date>/draft.json (not review.md — it isn't read back)
// before render.ts runs.
//
// Run with: npx tsx scripts/content-engine/sendDraftEmail.ts <date>
import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

function escapeForAppleScript(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function main() {
  const date = process.argv[2];
  if (!date) {
    console.error("Usage: npx tsx scripts/content-engine/sendDraftEmail.ts <date>");
    process.exit(1);
  }

  const recipient = process.env.ADMIN_EMAIL;
  if (!recipient) throw new Error("ADMIN_EMAIL is not set");

  const batchDir = join(__dirname, "..", "..", "content", "output", date);
  const reviewPath = join(batchDir, "review.md");
  if (!existsSync(reviewPath)) throw new Error(`No review found at ${reviewPath} — run generate.ts first.`);

  const review = readFileSync(reviewPath, "utf8");
  const body = `${review}\n\nEdit content/output/${date}/draft.json on your computer if you want changes. Images render and get emailed at 8:30am from whatever's in draft.json at that time.`;

  const scriptDir = mkdtempSync(join(tmpdir(), "content-engine-draft-email-"));
  const script = `
tell application "Mail"
  set newMsg to make new outgoing message with properties {subject:"Draft ready for review — ${date}", content:"${escapeForAppleScript(body)}", visible:false}
  tell newMsg
    make new to recipient at end of to recipients with properties {address:"${escapeForAppleScript(recipient)}"}
  end tell
  send newMsg
end tell
`;
  const scriptPath = join(scriptDir, "send.applescript");
  writeFileSync(scriptPath, script);
  execFileSync("osascript", [scriptPath]);
  rmSync(scriptDir, { recursive: true, force: true });

  console.log(`Emailed draft for review to ${recipient}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
