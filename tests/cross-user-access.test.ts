// tests/cross-user-access.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSupabase } from "@/lib/supabase";

let mockUserId: string | null = null;
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mockUserId }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {},
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

const { updateApplicationStatus, deleteApplication } = await import(
  "@/app/(dashboard)/applications/actions"
);
const { deleteSavedFilter, setDefaultFilter } = await import(
  "@/app/(dashboard)/profile/actions"
);
const { logInteraction } = await import("@/app/(dashboard)/contacts/actions");

const OWNER = "test-cross-access-owner";
const ATTACKER = "test-cross-access-attacker";
const TEST_COMPANY_SLUG = "test-cross-access-co";

let applicationId: string;
let savedFilterId: string;
let contactId: string;
let companyId: string;

beforeAll(async () => {
  const supabase = getSupabase();

  // applications.company_id is NOT NULL — the brief's insert omits it, but
  // the real schema requires a company row to reference.
  const { data: company } = await supabase
    .from("companies")
    .upsert({ name: "Test Cross Access Co", slug: TEST_COMPANY_SLUG }, { onConflict: "slug" })
    .select("id")
    .single();
  companyId = company!.id;

  const { data: application } = await supabase
    .from("applications")
    .insert({
      user_id: OWNER,
      company_id: companyId,
      role_title: "Test Role",
      status: "applied",
      source: "manual",
    })
    .select("id")
    .single();
  applicationId = application!.id;

  const { data: filter } = await supabase
    .from("saved_filters")
    .insert({ user_id: OWNER, scope: "feed", name: "Test filter" })
    .select("id")
    .single();
  savedFilterId = filter!.id;

  const { data: contact } = await supabase
    .from("contacts")
    .insert({ user_id: OWNER, name: "Test Contact" })
    .select("id")
    .single();
  contactId = contact!.id;
});

afterAll(async () => {
  const supabase = getSupabase();
  await supabase.from("applications").delete().eq("user_id", OWNER);
  await supabase.from("saved_filters").delete().eq("user_id", OWNER);
  await supabase.from("contacts").delete().eq("user_id", OWNER);
  await supabase.from("companies").delete().eq("slug", TEST_COMPANY_SLUG);
});

describe("cross-user access", () => {
  it("cannot update another user's application status", async () => {
    mockUserId = ATTACKER;
    await expect(updateApplicationStatus(applicationId, "offer")).rejects.toThrow(
      "Application not found"
    );
  });

  it("cannot delete another user's application", async () => {
    mockUserId = ATTACKER;
    await deleteApplication(applicationId);

    const { data } = await getSupabase()
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .maybeSingle();
    expect(data).not.toBeNull();
  });

  it("cannot delete another user's saved filter", async () => {
    mockUserId = ATTACKER;
    await deleteSavedFilter(savedFilterId);

    const { data } = await getSupabase()
      .from("saved_filters")
      .select("id")
      .eq("id", savedFilterId)
      .maybeSingle();
    expect(data).not.toBeNull();
  });

  it("cannot set another user's saved filter as default", async () => {
    mockUserId = ATTACKER;
    await setDefaultFilter(savedFilterId, "feed", true);

    const { data } = await getSupabase()
      .from("saved_filters")
      .select("is_default")
      .eq("id", savedFilterId)
      .single();
    expect(data!.is_default).toBe(false);
  });

  it("cannot log an interaction against another user's contact", async () => {
    mockUserId = ATTACKER;
    const formData = new FormData();
    formData.set("type", "email");
    await expect(logInteraction(contactId, "/contacts", formData)).rejects.toThrow(
      "Contact not found"
    );
  });
});
