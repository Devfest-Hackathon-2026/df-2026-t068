/** @type {import("next").NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR ?? ".next",
  transpilePackages: ["ideaweave-algorithm"],
};

export default nextConfig;
