export default function Rss() {
  return null;
}

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function getServerSideProps({ res }) {
  const { getPublicData, newsDescription, newsDetailHref, siteBase, sortNewsByDate } = await import("../src/lib/server-data.js");
  const base = siteBase();
  const data = await getPublicData();
  const items = sortNewsByDate(data.news).slice(0, 60);
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    "<title>DeepFind Tools 每日 AI 资讯</title>",
    `<link>${xmlEscape(`${base}/daily-ai-news`)}</link>`,
    "<description>AI 行业新闻、模型动态、产品更新、融资和工具教程。</description>",
    ...items.map((item) => {
      const link = `${base}${newsDetailHref(item)}`;
      const pubDate = item.publishedAt ? new Date(`${item.publishedAt}T00:00:00+08:00`).toUTCString() : new Date().toUTCString();
      return [
        "<item>",
        `<title>${xmlEscape(item.title)}</title>`,
        `<link>${xmlEscape(link)}</link>`,
        `<guid>${xmlEscape(link)}</guid>`,
        `<pubDate>${xmlEscape(pubDate)}</pubDate>`,
        `<description>${xmlEscape(newsDescription(item))}</description>`,
        "</item>",
      ].join("");
    }),
    "</channel>",
    "</rss>",
  ].join("\n");
  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.write(body);
  res.end();
  return { props: {} };
}
