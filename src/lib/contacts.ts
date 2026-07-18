// Root buckets for the network tree — a contact with no specific referrer
// (see referred_by_contact_id) attaches to one of these instead. "Referral"
// covers being introduced by someone who isn't themselves a tracked contact;
// once the referrer IS a tracked contact, the specific referral edge takes
// over placement in the tree and this category is just metadata.
export const HOW_MET_CATEGORIES = [
  { value: "alumni", label: "Alumni" },
  { value: "past_job", label: "Past job" },
  { value: "cold_outreach", label: "Cold outreach" },
  { value: "event", label: "Event" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
] as const;
