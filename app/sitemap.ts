import type { MetadataRoute } from "next";
import { supabaseAnon } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

const SITE_URL = "https://aisup.co.kr";
const PAGE_SIZE = 1000;

type SitemapAnnouncement = {
  id: number;
  created_at: string;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE_URL}/announcements`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.2,
    },
  ];

  try {
    const announcements: SitemapAnnouncement[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabaseAnon
        .from("announcements_public")
        .select("id,created_at")
        .eq("status", "open")
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw new Error(error.message);
      const rows = (data ?? []) as SitemapAnnouncement[];
      announcements.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }

    return [
      ...staticPages,
      ...announcements.map((item) => ({
        url: `${SITE_URL}/announcements/${item.id}`,
        lastModified: new Date(item.created_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return staticPages;
  }
}
