export type GeocodingResult = {
  latitude: number;
  longitude: number;
  displayName: string;
};

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";

export const geocodeCity = async (
  cityQuery: string
): Promise<GeocodingResult | null> => {
  const trimmed = cityQuery.trim();
  if (!trimmed) {
    return null;
  }

  const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(trimmed)}&format=json&limit=1&addressdetails=0`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ShabbatShalomApp/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!results.length) {
    return null;
  }

  const top = results[0];
  return {
    latitude: parseFloat(top.lat),
    longitude: parseFloat(top.lon),
    displayName: top.display_name,
  };
};

export const geocodeCitySuggestions = async (
  partialQuery: string,
  limit = 5
): Promise<GeocodingResult[]> => {
  const trimmed = partialQuery.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(trimmed)}&format=json&limit=${limit}&addressdetails=0&featuretype=city`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ShabbatShalomApp/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  return results.map((r) => ({
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
    displayName: r.display_name,
  }));
};
