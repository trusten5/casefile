import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client for server-side routes only (webhooks, server components).
// Never import this into client components — it bypasses row-level security.
//
// Built lazily (not at module scope) so importing this file doesn't throw
// during Next's build-time route collection when env vars aren't set yet —
// the error only surfaces when a request actually needs the client.
let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return client;
}
