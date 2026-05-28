import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3002/api/:path*',
      },
      {
        source: '/memory/:path*',
        destination: 'http://localhost:3002/memory/:path*',
      }
    ];
  },
};

export default nextConfig;
