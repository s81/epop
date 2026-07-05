import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'e-pop Manufacturing Execution System',
    short_name: 'e-pop MES',
    description: 'Shop floor tablet for manufacturing execution',
    start_url: '/tablet',
    display: 'standalone',
    background_color: '#111827',
    theme_color: '#111827',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
