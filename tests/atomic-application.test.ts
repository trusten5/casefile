// tests/atomic-application.test.ts
import { describe, expect, it } from "vitest";
import { getSupabase } from "@/lib/supabase";

describe("create_application_with_history RPC", () => {
  it("creates a linked application + status_history row", async () => {
    const supabase = getSupabase();
    const { data: company } = await supabase
      .from("companies")
      .insert({ name: "Test RPC Co", slug: `test-rpc-co-${Date.now()}` })
      .select("id")
      .single();

    const { data: applicationId, error } = await supabase.rpc(
      "create_application_with_history",
      {
        p_user_id: "test-rpc-user",
        p_company_id: company!.id,
        p_posting_id: null,
        p_role_title: "Test Role",
        p_role_type: "internship",
        p_is_phd: false,
      }
    );
    expect(error).toBeNull();

    const { data: history } = await supabase
      .from("status_history")
      .select("status")
      .eq("application_id", applicationId);
    expect(history).toHaveLength(1);
    expect(history![0].status).toBe("applied");

    await supabase.from("applications").delete().eq("id", applicationId);
    await supabase.from("companies").delete().eq("id", company!.id);
  });

  it("rolls back fully when company_id doesn't exist", async () => {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("create_application_with_history", {
      p_user_id: "test-rpc-user-rollback",
      p_company_id: "00000000-0000-0000-0000-000000000000",
      p_posting_id: null,
      p_role_title: "Test Role",
      p_role_type: "internship",
      p_is_phd: false,
    });
    expect(error).not.toBeNull();

    const { data: orphaned } = await supabase
      .from("applications")
      .select("id")
      .eq("user_id", "test-rpc-user-rollback");
    expect(orphaned).toHaveLength(0);
  });
});
