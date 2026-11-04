import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import { FONT_VARIABLE_CLASSES } from './fonts/fonts';

const SITE_NAME = 'Accucut Quotation Portal';
// Generic wording only: no cost, rate or customer data in a page title or a sharing preview (FR-089, UX spec section 8).
const SITE_DESCRIPTION = 'Accucut Lasers quotation portal: assign, prepare, review and approve estimates.';

// No page is indexable until the web address and sharing image are decided (FR-089, architecture section 8).
export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: { type: 'website', siteName: SITE_NAME, title: SITE_NAME, description: SITE_DESCRIPTION },
  twitter: { card: 'summary' },
  icons: { icon: '/accucut-logo.jpg' },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-IN" className={FONT_VARIABLE_CLASSES}>
      <body>{children}</body>
    </html>
  );
}
