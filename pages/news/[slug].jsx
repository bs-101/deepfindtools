import Head from "next/head";
import { NewsDetailPage } from "../../src/client-app.jsx";

export default function NewsRoute({ slug, title, description, image, jsonLd, canonical, initialData }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        {image ? <meta property="og:image" content={image} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>
      <NewsDetailPage newsSlug={slug} initialData={initialData} />
    </>
  );
}

export async function getStaticPaths() {
  const { getPublicPaths, newsSlug } = await import("../../src/lib/server-data.js");
  const data = await getPublicPaths();
  return {
    paths: data.news.map((item) => ({ params: { slug: newsSlug(item) } })),
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  const { findNews, getPublicData, newsDescription, newsSlug, siteBase } = await import("../../src/lib/server-data.js");
  const initialData = await getPublicData();
  const slug = params?.slug || "";
  const item = findNews(initialData, slug);
  if (!item) return { notFound: true, revalidate: 60 };
  const base = siteBase();
  const canonicalSlug = newsSlug(item);
  const canonical = `${base}/news/${encodeURIComponent(canonicalSlug)}`;
  const image = item.coverImage?.startsWith("/") ? `${base}${item.coverImage}` : item.coverImage || "";
  const description = newsDescription(item);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: item.title,
    description,
    datePublished: item.publishedAt || item.createdAt || null,
    dateModified: item.updatedAt || item.createdAt || item.publishedAt || null,
    author: { "@type": "Organization", name: item.sourceName || "DeepFind Tools" },
    publisher: {
      "@type": "Organization",
      name: "DeepFind Tools",
      logo: { "@type": "ImageObject", url: `${base}/favicon.svg` },
    },
    mainEntityOfPage: canonical,
    image: image || null,
  };
  return {
    props: {
      slug: canonicalSlug,
      title: `${item.title} - 每日 AI 资讯 | DeepFind Tools`,
      description,
      image,
      jsonLd,
      canonical,
      initialData,
    },
    revalidate: 300,
  };
}
