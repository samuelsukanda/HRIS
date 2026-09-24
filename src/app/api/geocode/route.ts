import { getSessionUser } from "@/lib/server/session";

type GeoResult = { label: string; latitude: number; longitude: number };

const CACHE = new Map<string, { at: number; results: GeoResult[] }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const u = await getSessionUser();
  if (!u) return Response.json({ ok: false }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 3) return Response.json({ ok: false, error: "Query minimal 3 karakter" }, { status: 400 });

  const key = q.toLowerCase();
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Response.json({ results: hit.results });

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("accept-language", "id");
    url.searchParams.set("q", q);
    const res = await fetch(url, {
      headers: { "User-Agent": "hris-app/0.1 (internal admin geocoding)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return Response.json({ ok: false, error: "Gagal mencari lokasi" }, { status: 502 });
    const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    const results: GeoResult[] = rows.map((r) => ({
      label: r.display_name,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
    }));
    if (CACHE.size > 100) CACHE.clear();
    CACHE.set(key, { at: Date.now(), results });
    return Response.json({ results });
  } catch {
    return Response.json({ ok: false, error: "Gagal mencari lokasi" }, { status: 502 });
  }
}
