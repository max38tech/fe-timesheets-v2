
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Add this for optimal serverful deployments
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com', // This covers the new URL format
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
