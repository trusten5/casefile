import Stripe from "stripe";

// Lazy singleton, same pattern as src/lib/supabase.ts — importing this
// file shouldn't throw at build time before STRIPE_SECRET_KEY is set.
let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return client;
}
