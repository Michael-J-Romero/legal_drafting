/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
      'canvas-prebuilt': false,
    };

    return config;
  },
};

module.exports = nextConfig;
