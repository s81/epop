import type { Metadata } from 'next';
import './globals.css';
import { RegisterSw } from '@/components/RegisterSw';

export const metadata: Metadata = {
  title: 'e-pop MES',
  icons: '/icon.svg',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
        <RegisterSw />
      </body>
    </html>
  );
}
