import { inferRoleType, isPhdRole, type RawPosting } from "./types";

type LeverPosting = {
  text: string;
  hostedUrl: string;
  categories: { location?: string };
  createdAt: number;
};

export async function fetchLeverPostings(boardToken: string): Promise<RawPosting[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${boardToken}?mode=json`, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Lever board "${boardToken}" returned ${res.status}`);

  const postings = (await res.json()) as LeverPosting[];
  return postings.map((posting) => ({
    title: posting.text,
    location: posting.categories.location ?? null,
    url: posting.hostedUrl,
    roleType: inferRoleType(posting.text),
    postedAt: new Date(posting.createdAt).toISOString(),
    isPhd: isPhdRole(posting.text),
  }));
}
