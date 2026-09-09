/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.dev',
      },
      {
        protocol: 'https',
        hostname: process.env.R2_PUBLIC_HOSTNAME || '*.cloudflarestorage.com',
      },
    ],
  },
};

module.exports = nextConfig;
