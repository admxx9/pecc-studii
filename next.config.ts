
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
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
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      { // Add this block for Google Images hostname
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
        port: '',
        pathname: '/**',
      },
      { // Add this block for Discord Images hostname
        protocol: 'https',
        hostname: 'media.discordapp.net',
        port: '',
        pathname: '/**',
      },
      { // Add this block for Vecteezy Images hostname
        protocol: 'https',
        hostname: 'static.vecteezy.com',
        port: '',
        pathname: '/**',
      },
      { // Add this block for Freepik Images hostname
        protocol: 'https',
        hostname: 'img.freepik.com',
        port: '',
        pathname: '/**',
      },
      { // Add this block for Imgur Images hostname
        protocol: 'https',
        hostname: 'i.imgur.com',
        port: '',
        pathname: '/**',
      },
      { // Add this block for IBB Images hostname
        protocol: 'https',
        hostname: 'i.ibb.co',
        port: '',
        pathname: '/**',
      },
      { // Add this block for PagBank QR Code Images
        protocol: 'https',
        hostname: 'qr.pagseguro.uol.com.br',
        port: '',
        pathname: '/**',
      },
      { // Add this block for PagBank Sandbox QR Code Images
        protocol: 'https',
        hostname: 'sandbox.api.pagseguro.com',
        port: '',
        pathname: '/**',
      },
      { // Add this block for GTA5-Mods Images
        protocol: 'https',
        hostname: 'img.gta5-mods.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;

