import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['@prisma/client'],
  // Allow up to 60MB request bodies for /api/uploads (file uploads). The
  // upload route enforces its own 50MB ceiling — this is just the body-parser
  // cap so Next.js doesn't reject the multipart payload before the route handler runs.
  // Without this, files larger than ~4MB hit "Body exceeded 1mb limit" /
  // "unexpected end of JSON input" errors on the server.
  experimental: {
    serverActions: {
      bodySizeLimit: '60mb',
    },
  },
};

export default nextConfig;
