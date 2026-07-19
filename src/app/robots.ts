import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything under (dashboard) except the public /feed and /companies
      // routes requires a signed-in user — see isProtectedRoute in proxy.ts.
      disallow: ["/dashboard", "/applications", "/contacts", "/profile", "/admin", "/api"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
