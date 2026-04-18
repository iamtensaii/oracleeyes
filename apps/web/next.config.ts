import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/predict", destination: "/", permanent: false },
      { source: "/agents", destination: "/?tab=agents", permanent: false },
    ];
  },
};

export default nextConfig;
