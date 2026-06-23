export default function Sitemap() {
  return null;
}

export async function getServerSideProps({ res }) {
  const { getPublicData, siteBase } = await import("../src/lib/server-data.js");
  const base = siteBase();
  const data = await getPublicData();
  const urls = [
    `${base}/`,
    `${base}/daily-ai-news/`,
    ...data.categories.map((category) => `${base}/category/${encodeURIComponent(category.id)}`),
    ...data.tools.map((tool) => `${base}/sites/${encodeURIComponent(tool.id)}.html`),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${url}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`),
    "</urlset>",
  ].join("\n");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.write(body);
  res.end();
  return { props: {} };
}
