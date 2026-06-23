import Head from "next/head";
import { CategoryPage } from "../../src/client-app.jsx";

export default function CategoryRoute({ id, title, description, initialData, canonical }) {
  return (
    <>
      <Head>
        <title>{title} - DeepFind Tools</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={`${title} - DeepFind Tools`} />
        <meta property="og:description" content={description} />
      </Head>
      <CategoryPage categoryId={id} initialData={initialData} />
    </>
  );
}

export async function getStaticPaths() {
  const { getPublicPaths } = await import("../../src/lib/server-data.js");
  const data = await getPublicPaths();
  const ids = ["latest", "featured", ...data.categories.map((item) => item.id)];
  return {
    paths: ids.map((id) => ({ params: { id } })),
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  const { categoryName, getPublicData, siteBase } = await import("../../src/lib/server-data.js");
  const initialData = await getPublicData();
  const id = params?.id || "all";
  const title = id === "latest" ? "最新收录" : id === "featured" ? "热门工具" : categoryName(initialData.categories, id);
  const base = siteBase();
  return {
    props: {
      id,
      title,
      description: `DeepFind Tools ${title} 分类，整理相关 AI 工具、官网入口、标签和使用简介。`,
      initialData,
      canonical: `${base}/category/${encodeURIComponent(id)}`,
    },
    revalidate: 300,
  };
}
