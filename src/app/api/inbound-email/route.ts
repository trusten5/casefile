import { NextResponse } from "next/server";

// Postmark inbound webhook target. Phase 2 wires this up to: store the raw
// email in `inbound_emails`, classify + extract via Groq, and either commit
// to applications/contacts or flag for review depending on confidence.
export async function POST() {
  return NextResponse.json({ status: "not implemented" }, { status: 501 });
}
