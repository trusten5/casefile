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
import { getUserTier, tierAtLeast } from "@/lib/subscriptions";
import { ROLE_TYPE_LABELS } from "@/lib/roleType";
import {
  updatePreferences,
  createSavedFilter,
  deleteSavedFilter,
  setDefaultFilter,
  updateDigestPreferences,
  createFeatureRequest,
} from "./actions";
import { createCheckoutSession, createPortalSession } from "@/app/pricing/actions";
import { OptionalField } from "./OptionalField";

export const dynamic = "force-dynamic";

const PLANS = [
  {
    tier: "plus" as const,
    name: "Plus",
    price: "$1.99/mo",
    annualPrice: "$19.99/yr",
    monthlyPriceId: process.env.STRIPE_PRICE_PLUS_MONTHLY!,
    annualPriceId: process.env.STRIPE_PRICE_PLUS_ANNUAL!,
    blurb: "Get emailed when new postings match your saved feed filter.",
  },
  {
    tier: "pro" as const,
    name: "Pro",
    price: "$9.99/mo",
    annualPrice: "$99/yr",
    monthlyPriceId: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    annualPriceId: process.env.STRIPE_PRICE_PRO_ANNUAL!,
    blurb: "Everything in Plus, plus AI-parsed application-status emails. Coming soon.",
  },
];

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
                    <span className="ml-2 rounded border border-status-offer px-2 py-0.5 font-mono text-[11px] font-medium text-status-offer">
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
                    className="rounded border border-paper-line px-3 py-1.5 text-xs text-ink"
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
            className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Company
          <input
            name="company"
            placeholder="Optional"
            className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Role type
          <select
            name="roleType"
            defaultValue=""
            className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
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
                className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-soft">
              Keyword
              <input
                name="keyword"
                placeholder="Optional"
                className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Level
          <select
            name="level"
            defaultValue=""
            className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            <option value="undergrad">Undergrad</option>
            <option value="phd">PhD</option>
          </select>
        </label>
        <button type="submit" className="rounded bg-ink px-4 py-2 text-sm font-medium text-paper">
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
                  className="rounded border border-paper-line px-3 py-1.5 text-xs text-ink-soft hover:border-ink-soft hover:text-ink"
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
  const tier = userId ? await getUserTier(supabase, userId) : "free";

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
          digestEnabled: false,
          digestCadence: "daily" as const,
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

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">Subscription</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Casefile stays free forever. These are optional add-ons.
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <div key={plan.tier} className="rounded border border-paper-line p-6">
              <h3 className="font-display text-xl font-semibold text-ink">{plan.name}</h3>
              <p className="mt-2 text-sm text-ink-soft">{plan.blurb}</p>
              <p className="mt-4 font-display text-2xl font-semibold text-ink">{plan.price}</p>
              <p className="text-xs text-ink-soft">or {plan.annualPrice} billed annually</p>

              {tier === plan.tier ? (
                <p className="mt-6 text-sm font-medium text-status-offer">Current plan</p>
              ) : plan.tier === "pro" ? (
                <button
                  type="button"
                  disabled
                  className="mt-6 w-full rounded border border-paper-line px-4 py-2 text-sm font-medium text-ink-soft"
                >
                  Coming soon
                </button>
              ) : tierAtLeast(tier, plan.tier) ? (
                <button
                  type="button"
                  disabled
                  className="mt-6 w-full rounded border border-paper-line px-4 py-2 text-sm font-medium text-ink-soft"
                >
                  Included in your plan
                </button>
              ) : (
                <form action={createCheckoutSession.bind(null, plan.annualPriceId)}>
                  <button
                    type="submit"
                    className="mt-6 w-full rounded border border-paper-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink-soft"
                  >
                    Subscribe annually
                  </button>
                </form>
              )}
              {!tierAtLeast(tier, plan.tier) && plan.tier === "plus" && (
                <form action={createCheckoutSession.bind(null, plan.monthlyPriceId)}>
                  <button
                    type="submit"
                    className="mt-2 w-full text-xs font-medium text-ink-soft hover:text-ink hover:underline"
                  >
                    or pay monthly instead
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        {tier !== "free" && (
          <form action={createPortalSession} className="mt-6">
            <button
              type="submit"
              className="rounded border border-paper-line px-4 py-1.5 text-sm font-medium text-ink hover:border-ink-soft"
            >
              Manage subscription
            </button>
          </form>
        )}
      </section>

      {tierAtLeast(tier, "plus") && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-ink">Email digest</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Requires a default feed filter (set one below) — the digest emails
            whatever that filter would show, since your last send.
          </p>
          <form action={updateDigestPreferences} className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="digestEnabled"
                defaultChecked={preferences.digestEnabled}
                className="h-4 w-4"
              />
              Enabled
            </label>
            <select
              name="digestCadence"
              defaultValue={preferences.digestCadence}
              className="rounded border border-paper-line px-3 py-1.5 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Mondays)</option>
            </select>
            <button
              type="submit"
              className="rounded border border-paper-line px-4 py-1.5 text-sm font-medium text-ink hover:border-ink-soft"
            >
              Save
            </button>
          </form>
        </section>
      )}

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
              className="w-24 rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
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
          <button type="submit" className="rounded bg-ink px-4 py-2 text-sm font-medium text-paper">
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
            className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            className="self-start rounded bg-ink px-4 py-2 text-sm font-medium text-paper"
          >
            Submit
          </button>
        </form>
      </section>
    </div>
  );
}
