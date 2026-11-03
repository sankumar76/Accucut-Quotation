import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

// No page is indexable until the web address and sharing image are decided (FR-089, architecture section 8).
export const metadata: Metadata = {
  title: 'Accucut Quotation Portal',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
