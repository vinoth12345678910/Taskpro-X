import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ This tells Next.js to generate static files (no server needed)
  output: "export",
  
  // ✅ Optional: Skip linting during build if you want
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
