import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://panana.local";
  return [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/airport`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/airport/chat`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/airport/complete`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/home`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/category/for-you`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/category/new`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/category/popular`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/c/seola`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/c/seola/follows`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.4 },
    { url: `${base}/my`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/my/follows`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.3 },
    { url: `${base}/my/notifications`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.4 },
    { url: `${base}/my/account`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.4 },
    { url: `${base}/my/account/edit`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.3 },
    { url: `${base}/my/reset`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.3 },
    { url: `${base}/my/charge`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.3 },
    { url: `${base}/my/membership`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.3 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.2 },
  ];
}

