/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure certain server deps are not bundled, avoiding parser issues in node_modules
  experimental: {
    serverComponentsExternalPackages: [
      'undici',
      '@langchain/core',
      '@langchain/openai', 
      '@langchain/textsplitters',
      // 'tiktoken'
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    // Silence optional native addon warnings from ws
    config.resolve.alias['bufferutil'] = false;
    config.resolve.alias['utf-8-validate'] = false;

    // Avoid bundling undici; Next 13.4's parser can choke on newer undici syntax
    if (isServer) {
      config.externals = [...(config.externals || []), 'undici'];
    } else {
      config.resolve.alias['undici'] = false;
    }
    
    return config;
  },
};

export default nextConfig;
