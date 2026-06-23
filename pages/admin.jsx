import dynamic from "next/dynamic";
import Head from "next/head";

const AdminPage = dynamic(() => import("../src/client-app.jsx").then((module) => module.AdminPage), { ssr: false });

export default function AdminRoute() {
  return (
    <>
      <Head>
        <title>内容后台 - DeepFind Tools</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AdminPage />
    </>
  );
}

export async function getServerSideProps({ req }) {
  const apiBase = process.env.API_INTERNAL_URL || "http://127.0.0.1:4173";
  try {
    const response = await fetch(`${apiBase}/api/session`, {
      headers: { cookie: req.headers.cookie || "" },
    });
    const session = await response.json();
    if (!session.authenticated) return { notFound: true };
    return { props: {} };
  } catch {
    return { notFound: true };
  }
}
