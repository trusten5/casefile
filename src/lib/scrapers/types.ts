export type RawPosting = {
  title: string;
  location: string | null;
  url: string;
  roleType: "internship" | "new_grad" | "full_time";
  postedAt: string;
  isPhd: boolean;
};

export type SeedCompany = {
  name: string;
  slug: string;
  ats: "greenhouse" | "lever" | "ashby";
  boardToken: string;
  // Omitted for companies pulled from the community directory where we
  // couldn't confidently confirm the real domain — falls back to an
  // initials avatar rather than risk showing the wrong company's logo.
  domain?: string;
};

// Word-boundary matched so "International"/"Internal" don't false-positive
// (naive /intern/i matches both as substrings). Co-op counts as an
// internship-equivalent "while in college" role.
// ponytail: keyword list, not exhaustive (misses e.g. "summer analyst") — add
// terms here if a real posting title slips through uncaught.
const INTERNSHIP_PATTERN = /\b(interns?|internships?|co[-\s]?ops?)\b/i;

// Not-an-internship doesn't imply new-grad — a title with neither pattern is
// just as likely a senior/experienced-hire role. Only tag "new_grad" when
// the title actually says so; everything else falls back to the honest,
// unclaimed "full_time" bucket instead of assuming entry-level.
// ponytail: keyword list, not exhaustive — add terms here if a genuinely
// entry-level posting keeps landing in full_time uncaught.
const NEW_GRAD_PATTERN =
  /\bnew.?grad(uate)?s?\b|\bentry.?level\b|\bearly.?career\b|\buniversity (grad|hire)s?\b|\brecent grad(uate)?s?\b|\bclass of \d{4}\b/i;

export function inferRoleType(title: string): RawPosting["roleType"] {
  if (INTERNSHIP_PATTERN.test(title)) return "internship";
  if (NEW_GRAD_PATTERN.test(title)) return "new_grad";
  return "full_time";
}

// ponytail: title keyword only — misses PhD requirements buried in the full
// job description, but that's a detail-fetch away (same tradeoff as the
// deferred cover-letter data).
const PHD_PATTERN = /\b(ph\.?d\.?|doctoral)\b/i;

export function isPhdRole(title: string): boolean {
  return PHD_PATTERN.test(title);
}
