import type { SupabaseClient } from "@supabase/supabase-js";

export type UserPreferences = {
  dailyGoal: number;
  school: string | null;
  major: string | null;
  experience: string | null;
  resumeUrl: string | null;
  coverLetterUrl: string | null;
  digestEnabled: boolean;
  digestCadence: "daily" | "weekly";
};

const DEFAULT_PREFERENCES: UserPreferences = {
  dailyGoal: 1,
  school: null,
  major: null,
  experience: null,
  resumeUrl: null,
  coverLetterUrl: null,
  digestEnabled: false,
  digestCadence: "daily",
};

// Most users won't have a row yet (only created once they save something on
// /profile) — .maybeSingle() plus these defaults means every caller gets a
// complete, always-valid preferences object either way.
export async function getUserPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPreferences> {
  const { data } = await supabase
    .from("user_preferences")
    .select(
      "daily_goal, school, major, experience, resume_url, cover_letter_url, digest_enabled, digest_cadence"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DEFAULT_PREFERENCES;
  return {
    dailyGoal: data.daily_goal,
    school: data.school,
    major: data.major,
    experience: data.experience,
    resumeUrl: data.resume_url,
    coverLetterUrl: data.cover_letter_url,
    digestEnabled: data.digest_enabled,
    digestCadence: data.digest_cadence,
  };
}

export type FilterScope = "feed" | "applications";

export type FilterValues = {
  company: string;
  roleType: string;
  location: string;
  keyword: string;
  level: string;
};

export type SuggestedPreset = { name: string } & Partial<FilterValues>;

// The "a few pre-set" combos the user asked for — shown on /profile as
// one-click "+ Add" buttons that create a real saved_filters row via the
// normal create action, so there's no separate built-in-vs-custom concept
// anywhere else in the app once one's been added.
export const SUGGESTED_FEED_PRESETS: SuggestedPreset[] = [
  { name: "Internships", roleType: "internship" },
  { name: "Full-time roles", roleType: "full_time" },
  { name: "Remote", location: "Remote" },
  { name: "PhD roles", level: "phd" },
];

export const SUGGESTED_APPLICATION_PRESETS: SuggestedPreset[] = [
  { name: "Internships", roleType: "internship" },
  { name: "Full-time roles", roleType: "full_time" },
  { name: "PhD roles", level: "phd" },
];
