import Head from "next/head";
import { ToolDetailPage } from "../../src/client-app.jsx";

export default function ToolRoute({ id, title, description, image, jsonLd, initialData, canonical }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        {image ? <meta property="og:image" content={image} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>
      <ToolDetailPage toolId={id} initialData={initialData} />
    </>
  );
}

export async function getStaticPaths() {
  const { getPublicPaths } = await import("../../src/lib/server-data.js");
  const data = await getPublicPaths();
  return {
    paths: data.tools.map((tool) => ({ params: { id: String(tool.id) } })),
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  const { categoryName, findTool, getPublicData, siteBase, toolDescription } = await import("../../src/lib/server-data.js");
  const initialData = await getPublicData();
  const id = params?.id || "";
  const tool = findTool(initialData, id);
  if (!tool) return { notFound: true, revalidate: 60 };
  const base = siteBase();
  const category = categoryName(initialData.categories, tool.category);
  const description = toolDescription(tool, initialData.categories);
  const image = tool.logo?.startsWith("/") ? `${base}${tool.logo}` : tool.logo || "";
  const canonical = `${base}/sites/${encodeURIComponent(id)}.html`;
  return {
    props: {
      id,
      title: `${tool.name} - ${tool.summary || category} | DeepFind Tools`,
      description,
      image,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: tool.name,
        description: tool.summary || description,
        applicationCategory: tool.category || "AIApplication",
        url: canonical,
        image,
        offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
      },
      canonical,
      initialData,
    },
    revalidate: 300,
  };
}
