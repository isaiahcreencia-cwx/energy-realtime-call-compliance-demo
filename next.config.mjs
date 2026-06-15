/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Allow importing the demo policy and transcript as raw strings so they
    // are bundled into the build and always available on Vercel.
    config.module.rules.push({
      test: /\.(md|txt)$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
