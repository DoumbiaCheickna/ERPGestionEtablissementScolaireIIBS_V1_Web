import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true }, // 👈 le lint ne bloque pas le build
};

export default nextConfig;
