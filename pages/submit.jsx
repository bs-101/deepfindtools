import Head from "next/head";
import { SubmitPage } from "../src/client-app.jsx";

export default function SubmitRoute({ initialData, base }) {
  return (
    <>
      <Head>
        <title>提交 AI 工具收录 - DeepFind Tools</title>
        <meta name="description" content="向 DeepFind Tools 提交 AI 工具、产品更新或开源项目，审核通过后进入 AI 工具目录。" />
        <link rel="canonical" href={`${base}/submit`} />
      </Head>
      <SubmitPage initialData={initialData} />
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
