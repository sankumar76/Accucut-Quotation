import { isIP } from 'node:net';

/**
 * The address a request came from, for the per-address sign-in limit (architecture section 6 "Rate limits").
 *
 * The portal runs behind one reverse proxy (ADR-002) that sets `X-Forwarded-For`. A proxy appends the address it
 * saw to whatever the client sent, so the **last** entry is the one our own proxy wrote and the earlier ones can be
 * forged by the client. Only a well-formed IP address is accepted; anything else counts as "no address", so a
 * crafted header can neither create endless counters nor smuggle text into the table key.
 */

const FORWARDED_FOR = 'x-forwarded-for';

function headerValue(headers: Readonly<Record<string, unknown>>): string | null {
  const value = headers[FORWARDED_FOR];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').join(',');
  return null;
}

/** The client address, or null when the header is absent or its last entry is not an IP address. */
export function clientAddressFrom(headers: Readonly<Record<string, unknown>> | undefined): string | null {
  if (headers === undefined) return null;
  const value = headerValue(headers);
  if (value === null) return null;
  const last = value.split(',').at(-1)?.trim() ?? '';
  return isIP(last) === 0 ? null : last.toLowerCase();
}
