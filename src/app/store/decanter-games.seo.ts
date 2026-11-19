/** Structured data for /apps/decanter/games: a breadcrumb and the list of games with their ratings. */
import { SITE_URL } from '../seo.service';
import { DECANTER_GAMES } from './decanter-games.data';

export function decanterGamesJsonLd(): object {
  const url = `${SITE_URL}/apps/decanter/games`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Projects', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Decanter', item: `${SITE_URL}/apps/decanter` },
          { '@type': 'ListItem', position: 3, name: 'Which games work', item: url },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Windows games tested with Decanter',
        url,
        numberOfItems: DECANTER_GAMES.length,
        itemListElement: DECANTER_GAMES.map((g, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${g.name}: ${g.rating ? g.rating.charAt(0).toUpperCase() + g.rating.slice(1) : 'Not tested yet'}`,
        })),
      },
    ],
  };
}
