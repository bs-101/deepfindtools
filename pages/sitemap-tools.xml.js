export default function SitemapTools() {
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
  const urls = data.tools.map((tool) => ({
    loc: `${base}/sites/${encodeURIComponent(tool.id)}.html`,
    lastmod: tool.updatedAt || tool.createdAt || today,
    priority: tool.featured ? "0.8" : "0.7",
  }));
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${xmlEscape(url.loc)}</loc><lastmod>${xmlEscape(url.lastmod)}</lastmod><changefreq>weekly</changefreq><priority>${url.priority}</priority></url>`),
    "</urlset>",
  ].join("\n");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.write(body);
  res.end();
  return { props: {} };
}
