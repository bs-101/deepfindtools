export default function Robots() {
  return null;
}

export async function getServerSideProps({ res }) {
  const { siteBase } = await import("../src/lib/server-data.js");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.write(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\nSitemap: ${siteBase()}/sitemap.xml\n`);
  res.end();
  return { props: {} };
}
