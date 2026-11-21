/**
 * /apps/decanter/gta-6-mac — "GTA 6 on Mac": what Decanter is doing to run GTA 6's story mode on
 * Apple silicon when the PC version comes out. Everything here must stay true: no PC version exists
 * yet, and GTA Online-style anti-cheat won't run on a Mac. Update the dates when Rockstar announces.
 */
import { SITE_URL } from '../seo.service';

export const GTA6_PATH = 'apps/decanter/gta-6-mac';
export const GTA6_TITLE = 'GTA 6 on Mac: getting ready for story mode | Decanter';
export const GTA6_DESCRIPTION =
  'Can you play GTA 6 on a Mac? Not yet: it is out on PS5 and Xbox, and the PC version is not announced. ' +
  'Decanter, the free Mac app for Windows games, is getting ready to run GTA 6 story mode on Apple silicon the day it reaches PC.';

export interface Gta6Faq { q: string; a: string; }

export const GTA6_FAQ: Gta6Faq[] = [
  { q: 'Can I play GTA 6 on Mac right now?',
    a: 'No. GTA 6 came out on 19 November 2026 for PlayStation 5 and Xbox Series X|S only. There is no PC or Mac version yet, so nothing can run it on a Mac today, and anyone who says otherwise is not telling the truth.' },
  { q: 'When is GTA 6 coming to PC?',
    a: 'Rockstar has not announced a PC version or a date. Industry reports in October 2026 pointed to early 2027. We will update this page as soon as there is official news.' },
  { q: 'Will GTA 6 story mode work on Mac with Decanter?',
    a: 'That is what we are getting ready for. Decanter runs Windows games on Apple silicon through Wine and Apple\'s D3DMetal, and GTA V\'s story mode already runs on Mac this way. GTA 6 on PC will very likely use DirectX 12, which is exactly what D3DMetal translates. We will only say it works once we have played it.' },
  { q: 'Will GTA 6 Online work on Mac?',
    a: 'Very likely not. GTA Online on PC uses BattlEye anti-cheat, which needs Windows itself and does not run on Mac or Linux. GTA 6 Online will very likely use the same kind of protection. No Mac app can get around that, and we will not pretend otherwise.' },
  { q: 'Which Mac do I need?',
    a: 'A Mac with Apple silicon (M1 or later) and macOS 14 or later. GTA 6 is a demanding game, so expect the best results on Pro, Max and Ultra chips with plenty of memory. Decanter\'s Performance setting, a frame-rate limit and MetalFX upscaling help on smaller Macs.' },
  { q: 'Is Decanter free? Do I need Windows?',
    a: 'Decanter is free, with no ads and no account, and you do not need Windows. You buy GTA 6 on PC the normal way (for example on Steam or Rockstar\'s launcher) and play it in Decanter.' },
  { q: 'Can I use a controller?',
    a: 'Xbox controller support is built and comes with the next Decanter update: games will see your controller and switch to controller mode when you press a button.' },
];

export function gta6JsonLd(): object {
  const url = `${SITE_URL}/${GTA6_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Projects', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Decanter', item: `${SITE_URL}/apps/decanter` },
          { '@type': 'ListItem', position: 3, name: 'GTA 6 on Mac', item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: GTA6_FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };
}
