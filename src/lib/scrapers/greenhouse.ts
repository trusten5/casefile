import { inferRoleType, isPhdRole, type RawPosting } from "./types";

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string } | null;
  first_published: string | null;
  updated_at: string;
};

export async function fetchGreenhousePostings(boardToken: string): Promise<RawPosting[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Greenhouse board "${boardToken}" returned ${res.status}`);

  const { jobs } = (await res.json()) as { jobs: GreenhouseJob[] };
  return jobs.map((job) => ({
    title: job.title,
    location: job.location?.name ?? null,
    url: job.absolute_url,
    roleType: inferRoleType(job.title),
    postedAt: job.first_published ?? job.updated_at,
    isPhd: isPhdRole(job.title),
  }));
}
