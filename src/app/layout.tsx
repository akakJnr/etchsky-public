import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/instrument-sans/index.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Etchsky: find a star and keep it',
  description:
    'Explore more than 119,000 real stars, learn what astronomers know about each one, and keep one in a public record with your name on it.',
  openGraph: {
    title: 'Etchsky',
    description: 'Find a star. Keep it in a public record.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#060912',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
