import Head from "next/head";
import { LoginPage } from "../src/client-app.jsx";

export default function LoginRoute() {
  return (
    <>
      <Head>
        <title>后台登录 - DeepFind Tools</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <LoginPage />
    </>
  );
}
