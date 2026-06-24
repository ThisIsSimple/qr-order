import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@qr/ui", "@qr/db", "@qr/types"],
};

export default nextConfig;
