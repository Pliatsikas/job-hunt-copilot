import type { MetadataRoute } from "next";

/**
 * The signed-in half of the app is private by definition — a crawler cannot
 * reach it, and listing it as disallowed is the honest instruction rather
 * than letting crawlers discover redirects to /login. Only the marketing
 * surface (/, /login, /register) is fair game.
 *
 * No sitemap: three public pages, no discovery problem to solve (NOTES.md).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/today", "/applications", "/insights", "/usage", "/profile", "/api/"],
    },
  };
}
