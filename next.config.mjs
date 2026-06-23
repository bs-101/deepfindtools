const apiBase = process.env.API_INTERNAL_URL || "http://127.0.0.1:4173";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/sites/:id.html", destination: "/sites/:id" },
      { source: "/api/:path*", destination: `${apiBase}/api/:path*` },
      { source: "/data/:path*", destination: `${apiBase}/data/:path*` },
      { source: "/assets/:path*", destination: `${apiBase}/assets/:path*` },
    ];
  },
};

export default nextConfig;
