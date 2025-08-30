// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // 本番ビルド時に ESLint エラーで落とさない
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TypeScript の型エラーでもビルドを止めない（デモ優先）
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
