"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";
// Type-only import — no runtime code from scripts/content-engine ships in
// the app bundle, just the shape of a batch draft.
import type { Draft } from "../../../../../scripts/content-engine/generateCopy";
import type { AssetType } from "../../../../../scripts/content-engine/pillars";

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorized");
}

export async function saveContentDraft(batchDate: string, formData: FormData) {
  await requireAdmin();

  const postCount = Number(formData.get("postCount"));
  const drafts: Draft[] = [];

  for (let i = 0; i < postCount; i++) {
    const slideCount = Number(formData.get(`slideCount__${i}`));
    const slides: Draft["post"]["slides"] = [];
    for (let j = 0; j < slideCount; j++) {
      const photo = String(formData.get(`photo__${i}__${j}`) ?? "").trim();
      slides.push({
        text: String(formData.get(`text__${i}__${j}`) ?? ""),
        assetType: String(formData.get(`assetType__${i}__${j}`) ?? "photos") as AssetType,
        photo: photo || null,
      });
    }

    drafts.push({
      label: String(formData.get(`label__${i}`)),
      pillarTitle: String(formData.get(`pillarTitle__${i}`)),
      post: {
        hook: String(formData.get(`hook__${i}`) ?? ""),
        caption: String(formData.get(`caption__${i}`) ?? ""),
        hashtags: String(formData.get(`hashtags__${i}`) ?? "")
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean),
        slides,
      },
    });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("content_drafts")
    .update({ drafts, edited: true, updated_at: new Date().toISOString() })
    .eq("batch_date", batchDate);
  if (error) throw error;

  revalidatePath("/admin/content");
  redirect(`/admin/content?flash=${encodeURIComponent("Saved — the 8:30am render will use this version")}`);
}
