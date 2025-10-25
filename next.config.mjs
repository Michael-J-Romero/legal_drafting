const nextConfig = {
  reactStrictMode: false,
  typescript: {
    // Allow production builds to succeed even if the project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Let Vercel builds continue when lint warnings exist.
    ignoreDuringBuilds: true,
  },
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
