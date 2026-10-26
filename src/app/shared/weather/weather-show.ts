/**
 * weather-show.ts — Menu → Settings → Weather (a device preference, plain localStorage like Environment detail):
 * full, soft (no streaks or flashes; the tint stays) or off (the pip only). The rules stay on every setting. No imports,
 * so the settings sheet does not pull the weather tables into its chunk.
 */
export type WeatherShow = 'full' | 'soft' | 'off';
export const WEATHER_SHOWS: readonly WeatherShow[] = ['full', 'soft', 'off'];
export const WEATHER_SHOW_KEY = 'eclipse-td-weather';
