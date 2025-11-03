/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    
    // Externalize playwright-core to avoid bundling issues
    if (isServer) {
      config.externals = [...(config.externals || []), 'playwright-core'];
    }
    
    return config;
  },
};

export default nextConfig;
