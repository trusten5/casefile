import { currentUser } from "@clerk/nextjs/server";

// Single-owner project — no roles table, just a signed-in check against one
// known email. Swap for a real roles system if this ever needs more than
// one admin.
export async function isAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;

  const user = await currentUser();
  return user?.primaryEmailAddress?.emailAddress === adminEmail;
}
