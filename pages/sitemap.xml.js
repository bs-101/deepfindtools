export default function Sitemap() {
  return null;
}

export async function getServerSideProps({ res }) {
  const { siteBase } = await import("../src/lib/server-data.js");
  const base = siteBase();
  const today = new Date().toISOString().slice(0, 10);
  const xmlEscape = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  const urls = [
    `${base}/sitemap-categories.xml`,
    `${base}/sitemap-tools.xml`,
    `${base}/sitemap-news.xml`,
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <sitemap><loc>${xmlEscape(url)}</loc><lastmod>${today}</lastmod></sitemap>`),
    "</sitemapindex>",
  ].join("\n");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.write(body);
  res.end();
  return { props: {} };
}
