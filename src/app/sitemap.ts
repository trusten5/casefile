import type { MetadataRoute } from "next";
import { getSupabase } from "@/lib/supabase";

// /companies/[slug] pages are public (see proxy.ts's isProtectedRoute) and
// are the long-tail SEO surface — one page per company with its open roles.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const supabase = getSupabase();
  const { data: companies } = await supabase
    .from("companies")
    .select("slug")
    .not("slug", "is", null);

  const companyRoutes: MetadataRoute.Sitemap = (companies ?? []).map((c) => ({
    url: `${siteUrl}/companies/${c.slug}`,
    changeFrequency: "daily",
  }));

  return [
    { url: siteUrl, changeFrequency: "hourly", priority: 1 },
    { url: `${siteUrl}/feed`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/companies`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly" },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly" },
    ...companyRoutes,
  ];
}
