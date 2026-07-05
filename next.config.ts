import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // wasm package must load its binary from node_modules at runtime
  serverExternalPackages: ["rosu-pp-js"],
};

export default nextConfig;
