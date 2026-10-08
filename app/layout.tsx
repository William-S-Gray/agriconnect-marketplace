import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';

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

// Self-hosted from the @fontsource-variable packages: served from
// /_next/static, so the CSP's font-src 'self' allows them, and nothing is
// fetched from Google — not at runtime, and not at build time either
// (next/font/google downloaded them during `next build`, so a network blip
// failed the build). Variable fonts cover every weight the theme uses.
const playfair = localFont({
  src: '../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2',
  variable: '--font-playfair', weight: '400 900', display: 'swap',
});
const nunito = localFont({
  src: '../node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2',
  variable: '--font-nunito', weight: '200 1000', display: 'swap',
});
const jetbrains = localFont({
  src: '../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  variable: '--font-jetbrains', weight: '100 800', display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#2D6C50',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${nunito.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Applies the saved theme before first paint. Inline by necessity: any
          external script would run after the first paint and cause a flash.
          Reading the nonce makes every page dynamic, which is required anyway:
          a prerendered page would carry no nonce and fail the CSP.
        */}
        <script
          nonce={(await headers()).get('x-nonce') ?? undefined}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
