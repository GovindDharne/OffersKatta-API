/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@offerhub/ui', '@offerhub/shared'],
  // Lint runs in CI / dev, not in the production image build.
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL_INTERNAL ?? 'http://api:4000';
    return [{ source: '/proxy/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
