/** Recap PDF site map — static raster, tile grid, SVG banner fallbacks. */

const MAP_USER_AGENT = 'MyBaladi/1.0 (recap-pdf; contact@baladi.local)';

/** Raster fetch size (API limits); display is capped smaller in PDF CSS. */
export const RECAP_MAP_FETCH_WIDTH_PX = 480;
export const RECAP_MAP_FETCH_HEIGHT_PX = 172;

export function recapMapFetchDimensions(): { width: number; height: number } {
  return { width: RECAP_MAP_FETCH_WIDTH_PX, height: RECAP_MAP_FETCH_HEIGHT_PX };
}

function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom,
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += chars[(triplet >> 18) & 63];
    result += chars[(triplet >> 12) & 63];
    result += i + 1 < bytes.length ? chars[(triplet >> 6) & 63] : '=';
    result += i + 2 < bytes.length ? chars[triplet & 63] : '=';
  }
  return result;
}

function staticMapUrls(latitude: number, longitude: number, width: number, height: number): string[] {
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  const size = `${width}x${height}`;
  return [
    `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=15&size=${size}&markers=${lat},${lon},red-pushpin`,
    `https://static-maps.yandex.ru/1.x/?ll=${lon},${lat}&size=${size}&z=14&l=map&pt=${lon},${lat},pm2rdm`,
    `https://staticmap.openstreetmap.fr/staticmap.php?center=${lat},${lon}&zoom=15&size=${size}&markers=${lat},${lon},lightblue1`,
  ];
}

/** Fetch a raster map (capped size) for embedding in recap HTML/PDF. */
export async function fetchRecapMapRasterDataUri(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const { width, height } = recapMapFetchDimensions();
  for (const url of staticMapUrls(latitude, longitude, width, height)) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': MAP_USER_AGENT } });
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 400) continue;
      const contentType = (response.headers.get('content-type') || 'image/png').split(';')[0];
      if (!contentType.startsWith('image/')) continue;
      return `data:${contentType};base64,${bytesToBase64(new Uint8Array(buffer))}`;
    } catch {
      continue;
    }
  }
  return null;
}

/** SVG banner when raster/tiles unavailable (always works offline). */
export function buildRecapMapSvgDataUri(latitude: number, longitude: number): string {
  const lat = latitude.toFixed(5);
  const lon = longitude.toFixed(5);
  const grid = Array.from({ length: 9 }, (_, i) => {
    const x = (i % 3) * 280 + 140;
    const y = Math.floor(i / 3) * 133 + 66;
    return `<line x1="${x - 40}" y1="${y}" x2="${x + 40}" y2="${y}" stroke="#b8c9d9" stroke-width="2" opacity="0.5"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 400" width="840" height="400">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8f1f8"/>
      <stop offset="100%" stop-color="#c8d8e8"/>
    </linearGradient>
  </defs>
  <rect width="840" height="400" fill="url(#sky)"/>
  ${grid}
  <rect x="120" y="280" width="600" height="36" rx="4" fill="#a8bccf" opacity="0.45"/>
  <rect x="200" y="120" width="48" height="200" rx="3" fill="#9eb3c7" opacity="0.35"/>
  <path d="M420 168 L448 216 L420 248 L392 216 Z" fill="#F5B301" stroke="#1F2937" stroke-width="3"/>
  <circle cx="420" cy="210" r="7" fill="#1F2937"/>
  <text x="420" y="48" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" fill="#6B7280">Site location</text>
  <text x="420" y="368" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#1F2937">${lat}°, ${lon}°</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function wrapMapImageMarkup(src: string): string {
  return `<div class="site-map-wrap"><img class="site-map" src="${src}" alt="Site map"/></div>`;
}

function tileUrl(zoom: number, x: number, y: number): string {
  return `https://basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`;
}

async function fetchTileDataUri(zoom: number, x: number, y: number): Promise<string | null> {
  try {
    const response = await fetch(tileUrl(zoom, x, y), {
      headers: { 'User-Agent': MAP_USER_AGENT },
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 100) return null;
    return `data:image/png;base64,${bytesToBase64(new Uint8Array(buffer))}`;
  } catch {
    return null;
  }
}

function buildTileGridMarkup(tileSrcs: string[]): string {
  return `<div class="site-map-wrap site-map-tiles">
    <div class="site-map-grid">${tileSrcs.map((src) => `<img src="${src}" alt=""/>`).join('')}</div>
    <div class="site-map-pin" aria-hidden="true"></div>
  </div>`;
}

/** Tile grid with remote URLs (server Chromium may fetch during PDF render). */
export function buildOsmTileMapMarkup(latitude: number, longitude: number, zoom = 15): string {
  const cols = 3;
  const rows = 2;
  const centerX = lonToTileX(longitude, zoom);
  const centerY = latToTileY(latitude, zoom);
  const startX = centerX - Math.floor(cols / 2);
  const startY = centerY - Math.floor(rows / 2);
  const tileSrcs: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tileSrcs.push(tileUrl(zoom, startX + col, startY + row));
    }
  }
  return buildTileGridMarkup(tileSrcs);
}

/** Tile grid embedded as data URIs (reliable in PDF; no network at render time). */
export async function buildRecapTileMapEmbeddedMarkup(
  latitude: number,
  longitude: number,
  zoom = 15,
): Promise<string | null> {
  const cols = 3;
  const rows = 2;
  const centerX = lonToTileX(longitude, zoom);
  const centerY = latToTileY(latitude, zoom);
  const startX = centerX - Math.floor(cols / 2);
  const startY = centerY - Math.floor(rows / 2);
  const jobs: Promise<string | null>[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      jobs.push(fetchTileDataUri(zoom, startX + col, startY + row));
    }
  }
  const results = await Promise.all(jobs);
  if (results.some((uri) => !uri)) return null;
  return buildTileGridMarkup(results as string[]);
}

/** Best available rectangular map banner for recap PDF. */
export async function buildRecapSiteMapMarkup(
  latitude: number,
  longitude: number,
): Promise<string> {
  const raster = await fetchRecapMapRasterDataUri(latitude, longitude);
  if (raster) return wrapMapImageMarkup(raster);
  const embedded = await buildRecapTileMapEmbeddedMarkup(latitude, longitude);
  if (embedded) return embedded;
  const remoteTiles = buildOsmTileMapMarkup(latitude, longitude);
  if (remoteTiles) return remoteTiles;
  return wrapMapImageMarkup(buildRecapMapSvgDataUri(latitude, longitude));
}

/** Sync fallback when only coords are known at HTML build time. */
export function buildRecapSiteMapMarkupSync(latitude: number, longitude: number): string {
  return wrapMapImageMarkup(buildRecapMapSvgDataUri(latitude, longitude));
}
