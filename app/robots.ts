import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/app/", "/auth/"],
    },
    sitemap: "https://aisup.co.kr/sitemap.xml",
    host: "https://aisup.co.kr",
  };
}
