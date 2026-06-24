import Head from "next/head";
import { DailyNewsPage } from "../../src/client-app.jsx";

export default function DailyRoute({ initialData, base }) {
  return (
    <>
      <Head>
        <title>每日 AI 资讯 - DeepFind Tools</title>
        <meta name="description" content="DeepFind Tools 每日 AI 资讯，整理 AI 行业新闻、模型动态、产品更新、融资和工具教程。" />
        <link rel="canonical" href={`${base}/daily-ai-news`} />
        <meta property="og:title" content="每日 AI 资讯 - DeepFind Tools" />
        <meta property="og:description" content="AI 行业新闻、模型动态、产品更新、融资和工具教程。" />
      </Head>
      <DailyNewsPage initialData={initialData} />
    </>
  );
}

export async function getStaticProps() {
  const { getPublicData, siteBase } = await import("../../src/lib/server-data.js");
  return {
    props: { initialData: await getPublicData(), base: siteBase() },
    revalidate: 300,
  };
}
