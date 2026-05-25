// Geocoding via Nominatim (OSM) + routing via OSRM — ambos públicos e gratuitos.
// Sem necessidade de API key.

export type LatLng = { lat: number; lon: number };

export async function geocode(address: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export async function routeDistanceKm(origin: LatLng, dest: LatLng): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${dest.lon},${dest.lat}?overview=false`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    const meters = data?.routes?.[0]?.distance;
    if (typeof meters !== "number") return null;
    return Math.round((meters / 1000) * 100) / 100;
  } catch {
    return null;
  }
}

export async function calcularDistanciaKm(origemEndereco: string, destinoEndereco: string): Promise<number | null> {
  const [a, b] = await Promise.all([geocode(origemEndereco), geocode(destinoEndereco)]);
  if (!a || !b) return null;
  return routeDistanceKm(a, b);
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
