/** One game in Decanter's catalog, as the website shows it (decanter-games.data.ts is generated). */
export interface DecanterGame {
  id: string;
  name: string;
  developer?: string | null;
  store: string;
  free: boolean;
  sizeGb?: number | null;
  blurb?: string | null;
  /** platinum / gold / silver / bronze / borked, or null: not tested yet. */
  rating: 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked' | null;
  meaning?: string | null;
  antiCheat?: { status?: string | null; system?: string | null; notes?: string | null } | null;
  knownIssues: { summary: string; workaround?: string | null }[];
  reports: number;
  /** The latest real test. */
  tested?: { date?: string | null; macos?: string | null; chip?: string | null; gptk?: string | null; notes?: string | null };
  /** Why it can't run (a known limitation, not a test). */
  why?: string | null;
  /** Not out on PC yet: what's known about when. */
  coming?: string | null;
}
