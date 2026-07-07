export default function SitemapCategories() {
  return null;
}

const xmlEscape = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export async function getServerSideProps({ res }) {
  const { getPublicData, siteBase } = await import("../src/lib/server-data.js");
  const base = siteBase();
  const data = await getPublicData();
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${base}/`, priority: "1.0" },
    { loc: `${base}/daily-ai-news`, priority: "0.9" },
    { loc: `${base}/submit`, priority: "0.65" },
    { loc: `${base}/category/latest`, priority: "0.82" },
    { loc: `${base}/category/featured`, priority: "0.82" },
    ...data.categories.map((category) => ({
      loc: `${base}/category/${encodeURIComponent(category.id)}`,
      priority: "0.8",
    })),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${xmlEscape(url.loc)}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>${url.priority}</priority></url>`),
    "</urlset>",
  ].join("\n");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.write(body);
  res.end();
  return { props: {} };
}
