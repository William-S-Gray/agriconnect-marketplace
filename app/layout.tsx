import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from './providers';
import { DemoModeBanner } from '@/components/DemoModeBanner';

export const metadata: Metadata = {
  // Resolves the relative og:image below to an absolute URL, which social
  // crawlers require. Set APP_URL to the deployed origin.
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: 'AgriConnect — Zimbabwe Farm-to-Market Marketplace',
  description:
    'Buy fresh produce direct from verified Zimbabwe farmers. Better prices, EcoCash secured payments, no middlemen.',
  authors: [{ name: 'AgriConnect' }],
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: "AgriConnect — Fresh From Zimbabwe's Farms",
    description:
      'Buy fresh produce direct from verified Zimbabwe farmers. Better prices, EcoCash secured payments.',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: "AgriConnect — Fresh From Zimbabwe's Farms",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "AgriConnect — Fresh From Zimbabwe's Farms",
    description:
      'Buy fresh produce direct from verified Zimbabwe farmers. Better prices, EcoCash secured payments.',
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#2D6C50',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Applies the saved theme before first paint. Inline by necessity: any
          external script would run after the first paint and cause a flash.
          Reading the nonce makes every page dynamic, which is required anyway:
          a prerendered page would carry no nonce and fail the CSP.
        */}
        <script
          nonce={headers().get('x-nonce') ?? undefined}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Providers>
          <DemoModeBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
