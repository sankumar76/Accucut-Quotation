import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import './globals.css';
import { PRODUCT_NAME_IN_A_SENTENCE } from '@/lib/product-name';
import { NONCE_HEADER, NONCE_PATTERN } from '@/lib/security/csp';
import { SITE_NAME, TITLE_TEMPLATE } from '@/lib/page-metadata';

import { FONT_VARIABLE_CLASSES } from './fonts/fonts';

// Generic wording only: no cost, rate or customer data in a page title or a sharing preview (FR-089, UX spec section 8).
const SITE_DESCRIPTION = `Accucut Lasers ${PRODUCT_NAME_IN_A_SENTENCE}: assign, prepare, review and approve estimates.`;

// No page is indexable until the web address and sharing image are decided (FR-089, architecture section 8).
export const metadata: Metadata = {
  title: { default: SITE_NAME, template: TITLE_TEMPLATE },
  description: SITE_DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: { type: 'website', siteName: SITE_NAME, title: SITE_NAME, description: SITE_DESCRIPTION },
  twitter: { card: 'summary' },
  icons: { icon: '/accucut-logo.jpg' },
};

/**
 * Every page is rendered per request, never built ahead of time: the Content Security Policy carries a nonce made for each request (`src/proxy.ts`),
 * and Next.js can put it on its own scripts only while it renders for a request. A page built at build time would have scripts without a nonce, and the policy
 * would stop them (DEF-054). Reading the request's headers here makes the whole tree dynamic, so a new page cannot forget it.
 *
 * The nonce also goes to the browser's own code as `__webpack_nonce__`: a library that adds a `<style>` element when a dialog opens (Radix's scroll lock) reads
 * the nonce there, and without it the policy blocks the element. The script that sets it carries the nonce itself.
 */
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // The proxy sets this header, but this is written into a script, so it is checked to be a nonce (base64) and not trusted for where it came from.
  const sent = (await headers()).get(NONCE_HEADER);
  const nonce = sent !== null && NONCE_PATTERN.test(sent) ? sent : null;
  return (
    <html lang="en-IN" className={FONT_VARIABLE_CLASSES}>
      <body>
        {nonce === null ? null : <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `window.__webpack_nonce__=${JSON.stringify(nonce)};` }} />}
        {children}
      </body>
    </html>
  );
}
