export interface PlaceSearchResult {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

const USER_AGENT = 'MyBaladi/1.0 (mobile app; client address picker)';

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) return [];

  const rows = (await response.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return rows.map((row) => ({
    id: String(row.place_id),
    label: row.display_name,
    latitude: Number(row.lat),
    longitude: Number(row.lon),
  }));
}
