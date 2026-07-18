import { inferRoleType, isPhdRole, type RawPosting } from "./types";

type AshbyJob = {
  title: string;
  location: string | null;
  jobUrl: string;
  publishedAt: string;
  isListed: boolean;
};

export async function fetchAshbyPostings(boardToken: string): Promise<RawPosting[]> {
  const res = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${boardToken}?includeCompensation=false`,
    { next: { revalidate: 0 }, signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`Ashby board "${boardToken}" returned ${res.status}`);

  const { jobs } = (await res.json()) as { jobs: AshbyJob[] };
  return jobs
    .filter((job) => job.isListed)
    .map((job) => ({
      title: job.title,
      location: job.location ?? null,
      url: job.jobUrl,
      roleType: inferRoleType(job.title),
      postedAt: job.publishedAt,
      isPhd: isPhdRole(job.title),
    }));
}
