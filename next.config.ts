import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the app is served by Firebase Hosting; there is no Node server at runtime.
  output: "export",
};

export default nextConfig;
