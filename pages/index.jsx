import Head from "next/head";
import { HomePage } from "../src/client-app.jsx";

export default function IndexPage({ initialData, base }) {
  return (
    <>
      <Head>
        <title>DeepFind Tools - AI 工具导航与每日资讯</title>
        <meta name="description" content="DeepFind Tools 收录 AI 写作、AI 绘画、AI 视频、AI 办公、AI 编程等工具，提供每日 AI 资讯、分类导航和工具详情页。" />
        <link rel="canonical" href={`${base}/`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="DeepFind Tools - AI 工具导航与每日资讯" />
        <meta property="og:description" content="发现、筛选并了解常用 AI 工具，查看每日 AI 资讯和工具详情。" />
        <meta property="og:url" content={`${base}/`} />
      </Head>
      <HomePage initialData={initialData} />
    </>
  );
}

export async function getStaticProps() {
  const { getPublicData, siteBase } = await import("../src/lib/server-data.js");
  return {
    props: { initialData: await getPublicData(), base: siteBase() },
    revalidate: 300,
  };
}
