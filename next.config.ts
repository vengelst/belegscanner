import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
