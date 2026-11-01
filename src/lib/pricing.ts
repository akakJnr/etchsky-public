import type { StarDetails } from '@/engine/types';

/**
 * PLACEHOLDER PRICING. Final prices come from the pricing model in the blueprint:
 * Price = TierBase x Visibility x Name x Longevity. These tiers only exist so the flow can be tested.
 */
export function priceFor(d: StarDetails): { usd: number; tier: string } {
  const m = d.m;
  let usd: number;
  let tier: string;
  if (m <= 2.5) { usd = 79; tier = 'One of the brightest stars in the sky'; }
  else if (m <= 4.5) { usd = 39; tier = 'Easy to see with the naked eye'; }
  else if (m <= 6.5) { usd = 19; tier = 'Visible from a dark sky'; }
  else if (m <= 10) { usd = 9; tier = 'Needs binoculars or a telescope'; }
  else { usd = 5; tier = 'Needs a telescope'; }
  if (d.n) usd = Math.round(usd * 1.5);
  return { usd, tier };
}

export const fmtUsd = (n: number) => `$${n.toLocaleString('en-US')}`;
