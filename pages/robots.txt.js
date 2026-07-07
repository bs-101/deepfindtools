export default function Robots() {
  return null;
}

export async function getServerSideProps({ res }) {
  const { siteBase } = await import("../src/lib/server-data.js");
  const base = siteBase();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.write(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\nSitemap: ${base}/sitemap.xml\nSitemap: ${base}/sitemap-tools.xml\nSitemap: ${base}/sitemap-news.xml\nSitemap: ${base}/sitemap-categories.xml\n`);
  res.end();
  return { props: {} };
}
