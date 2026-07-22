import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { Flash } from "@/components/Flash";
import {
  getUserPreferences,
  SUGGESTED_FEED_PRESETS,
  SUGGESTED_APPLICATION_PRESETS,
  type FilterScope,
  type SuggestedPreset,
} from "@/lib/preferences";
import { ROLE_TYPE_LABELS } from "@/lib/roleType";
import {
  updatePreferences,
  createSavedFilter,
  deleteSavedFilter,
  setDefaultFilter,
  createFeatureRequest,
} from "./actions";
import { OptionalField } from "./OptionalField";

export const dynamic = "force-dynamic";

type SavedFilterRow = {
  id: string;
  scope: string;
  name: string;
  company: string;
  role_type: string;
  location: string;
  keyword: string;
  level: string;
  is_default: boolean;
};

function summarize(f: SavedFilterRow) {
  const parts: string[] = [];
  if (f.role_type) parts.push(ROLE_TYPE_LABELS[f.role_type] ?? f.role_type);
  if (f.level) parts.push(f.level === "phd" ? "PhD" : "Undergrad");
  if (f.location) parts.push(f.location);
  if (f.company) parts.push(f.company);
  if (f.keyword) parts.push(`"${f.keyword}"`);
  return parts.length > 0 ? parts.join(" · ") : "All postings";
}

function FilterScopeSection({
  title,
  scope,
  filters,
  suggestions,
  showLocationKeyword,
}: {
  title: string;
  scope: FilterScope;
  filters: SavedFilterRow[];
  suggestions: SuggestedPreset[];
  showLocationKeyword: boolean;
}) {
  const existingNames = new Set(filters.map((f) => f.name));

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>

      {filters.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">No saved filters yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-paper-line">
          {filters.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {f.name}
                  {f.is_default && (
                    <span className="ml-2 rounded-full bg-status-offer/15 px-2 py-0.5 font-mono text-[11px] font-medium text-status-offer">
                      Default
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-ink-soft">{summarize(f)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form action={setDefaultFilter.bind(null, f.id, scope, !f.is_default)}>
                  <button
                    type="submit"
                    className="rounded-md border border-paper-line px-3 py-1.5 text-xs text-ink"
                  >
                    {f.is_default ? "Unset default" : "Set as default"}
                  </button>
                </form>
                <form action={deleteSavedFilter.bind(null, f.id)}>
                  <button type="submit" className="text-xs text-ink-soft hover:text-status-rejected">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={createSavedFilter} className="mt-4 flex flex-wrap items-end gap-4">
        <input type="hidden" name="scope" value={scope} />
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Name
          <input
            name="name"
            required
            placeholder="e.g. Remote internships"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Company
          <input
            name="company"
            placeholder="Optional"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Role type
          <select
            name="roleType"
            defaultValue=""
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="">All roles</option>
            {Object.entries(ROLE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {showLocationKeyword && (
          <>
            <label className="flex flex-col gap-1 text-xs text-ink-soft">
              Location contains
              <input
                name="location"
                placeholder="Optional"
                className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-soft">
              Keyword
              <input
                name="keyword"
                placeholder="Optional"
                className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Level
          <select
            name="level"
            defaultValue=""
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            <option value="undergrad">Undergrad</option>
            <option value="phd">PhD</option>
          </select>
        </label>
        <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
          Save filter
        </button>
      </form>

      {suggestions.some((s) => !existingNames.has(s.name)) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions
            .filter((s) => !existingNames.has(s.name))
            .map((s) => (
              <form key={s.name} action={createSavedFilter}>
                <input type="hidden" name="scope" value={scope} />
                <input type="hidden" name="name" value={s.name} />
                <input type="hidden" name="company" value={s.company ?? ""} />
                <input type="hidden" name="roleType" value={s.roleType ?? ""} />
                <input type="hidden" name="location" value={s.location ?? ""} />
                <input type="hidden" name="keyword" value={s.keyword ?? ""} />
                <input type="hidden" name="level" value={s.level ?? ""} />
                <button
                  type="submit"
                  className="rounded-full border border-paper-line px-3 py-1.5 text-xs text-ink-soft hover:border-ink-soft hover:text-ink"
                >
                  + {s.name}
                </button>
              </form>
            ))}
        </div>
      )}
    </section>
  );
}

export default async function ProfilePage(props: PageProps<"/profile">) {
  const { userId } = await auth();
  const searchParams = await props.searchParams;
  const flash = typeof searchParams.flash === "string" ? searchParams.flash : undefined;
  const supabase = getSupabase();

  const [preferences, { data: filters, error }] = await Promise.all([
    userId
      ? getUserPreferences(supabase, userId)
      : Promise.resolve({
          dailyGoal: 1,
          school: null,
          major: null,
          experience: null,
          resumeUrl: null,
          coverLetterUrl: null,
        }),
    userId
      ? supabase
          .from("saved_filters")
          .select("id, scope, name, company, role_type, location, keyword, level, is_default")
          .eq("user_id", userId)
          .order("name")
          .returns<SavedFilterRow[]>()
      : Promise.resolve({ data: [] as SavedFilterRow[], error: null }),
  ]);

  const feedFilters = (filters ?? []).filter((f) => f.scope === "feed");
  const applicationFilters = (filters ?? []).filter((f) => f.scope === "applications");

  return (
    <div>
      <Flash message={flash} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-ink">Profile</h1>
        <UserButton />
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Preferences, saved searches, and a few details about you.
      </p>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">About you</h2>
        <form action={updatePreferences} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs text-ink-soft">
            Daily application goal
            <input
              type="number"
              name="dailyGoal"
              min={1}
              defaultValue={preferences.dailyGoal}
              className="w-24 rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>
          <OptionalField name="school" label="School" defaultValue={preferences.school ?? ""} />
          <OptionalField name="major" label="Major" defaultValue={preferences.major ?? ""} />
          <OptionalField
            name="experience"
            label="Experience / grad year"
            defaultValue={preferences.experience ?? ""}
            placeholder="e.g. Rising junior, SWE"
          />
          <OptionalField
            name="resumeUrl"
            label="Resume link"
            defaultValue={preferences.resumeUrl ?? ""}
          />
          <OptionalField
            name="coverLetterUrl"
            label="Cover letter link"
            defaultValue={preferences.coverLetterUrl ?? ""}
          />
          <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
            Save
          </button>
        </form>
      </section>

      {error && (
        <p className="mt-6 text-sm text-status-rejected">
          Couldn&apos;t load saved filters: {error.message}
        </p>
      )}

      <FilterScopeSection
        title="Feed search presets"
        scope="feed"
        filters={feedFilters}
        suggestions={SUGGESTED_FEED_PRESETS}
        showLocationKeyword
      />
      <FilterScopeSection
        title="Applications search presets"
        scope="applications"
        filters={applicationFilters}
        suggestions={SUGGESTED_APPLICATION_PRESETS}
        showLocationKeyword={false}
      />

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">Feature requests</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Missing something? Tell us what would make Casefile more useful.
        </p>
        <form action={createFeatureRequest} className="mt-4 flex flex-col gap-3">
          <textarea
            name="body"
            required
            maxLength={2000}
            rows={4}
            placeholder="What would help your internship search?"
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            className="self-start rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper"
          >
            Submit
          </button>
        </form>
      </section>
    </div>
  );
}
