import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Warranty Vault',
  description:
    'Track product warranties, invoices, manuals, and purchase documents in one personal dashboard.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = window.localStorage.getItem('warranty-vault-theme') || 'system';
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark);
                document.documentElement.classList.toggle('dark', shouldUseDark);
                document.documentElement.style.colorScheme = shouldUseDark ? 'dark' : 'light';
              } catch {}
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__warrantyVaultWebMCP = window.__warrantyVaultWebMCP || {
                status: 'booting',
                tools: [],
                listTools: function () { return this.tools; },
                executeTool: function () {
                  return { error: 'Warranty Vault tools are still loading.' };
                }
              };
              window.warrantyVaultAgent = window.__warrantyVaultWebMCP;
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
