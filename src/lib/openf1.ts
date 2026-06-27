// Cliente compatible con la API de OpenF1.
// Por defecto apunta al backend local FastAPI+FastF1 (http://localhost:8000/v1).
// Se puede sobreescribir con VITE_API_BASE (por ejemplo "https://api.openf1.org/v1").

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:8000/v1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const maxAttempts = 5;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url.toString());
      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(8000, 600 * 2 ** (attempt - 1)) + Math.random() * 250;
        if (attempt < maxAttempts) {
          await sleep(wait);
          continue;
        }
        throw new Error(`OpenF1 ${path} ${res.status} — límite de peticiones alcanzado. Espera unos segundos y vuelve a intentarlo.`);
      }
      if (!res.ok) throw new Error(`OpenF1 ${path} ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (attempt >= maxAttempts) break;
      await sleep(400 * attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`OpenF1 ${path} failed`);
}

export interface Meeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name: string;
  country_name: string;
  country_code: string;
  circuit_short_name: string;
  date_start: string;
  year: number;
}

export interface Session {
  session_key: number;
  session_name: string; // "Race", "Qualifying", "Sprint", "Practice 1"...
  session_type: string;
  meeting_key: number;
  date_start: string;
  date_end: string;
  year: number;
  country_name: string;
  circuit_short_name: string;
}

export interface Driver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string; // hex without #
  headshot_url?: string;
  country_code?: string;
  session_key: number;
}

export interface Lap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  date_start: string | null;
  is_pit_out_lap: boolean;
  st_speed: number | null;
  session_key: number;
}

export interface CarData {
  date: string;
  driver_number: number;
  speed: number;
  throttle: number;
  brake: number;
  n_gear: number;
  rpm: number;
  drs: number;
}

export interface LocationPoint {
  date: string;
  driver_number: number;
  x: number;
  y: number;
  z: number;
}

export interface Stint {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number;
  compound: string; // SOFT / MEDIUM / HARD / INTERMEDIATE / WET
  tyre_age_at_start: number;
  session_key: number;
}

export interface Position {
  date: string;
  driver_number: number;
  position: number;
  session_key: number;
}

export const openf1 = {
  meetings: (year: number) => get<Meeting[]>("meetings", { year }),
  sessions: (meeting_key: number) => get<Session[]>("sessions", { meeting_key }),
  drivers: (session_key: number) => get<Driver[]>("drivers", { session_key }),
  laps: (session_key: number, driver_number?: number) =>
    get<Lap[]>("laps", { session_key, driver_number }),
  stints: (session_key: number) => get<Stint[]>("stints", { session_key }),
  position: (session_key: number) => get<Position[]>("position", { session_key }),
  carData: (session_key: number, driver_number: number, dateGte: string, dateLte: string) =>
    get<CarData[]>("car_data", {
      session_key,
      driver_number,
      "date>=": dateGte,
      "date<=": dateLte,
    }),
  location: (session_key: number, driver_number: number, dateGte: string, dateLte: string) =>
    get<LocationPoint[]>("location", {
      session_key,
      driver_number,
      "date>=": dateGte,
      "date<=": dateLte,
    }),
};

export function fastestLap(laps: Lap[]): Lap | null {
  const valid = laps.filter(
    (l) => l.lap_duration != null && l.lap_duration > 0 && !l.is_pit_out_lap && l.date_start,
  );
  if (!valid.length) return null;
  return valid.reduce((a, b) => (a.lap_duration! < b.lap_duration! ? a : b));
}

// Normaliza timestamps "naive" de FastF1 (sin zona) asumiendo UTC
export function normalizeIsoUtc(iso: string): string {
  if (!iso) return iso;
  // Si ya trae Z o offset (+hh:mm / -hh:mm), no tocar
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) return iso;
  return iso + "Z";
}

export function lapStart(lap: { date_start: string }) {
  return normalizeIsoUtc(lap.date_start);
}

export function lapEnd(lap: { date_start: string; duration?: number; lap_duration?: number }) {
  const start = new Date(normalizeIsoUtc(lap.date_start)).getTime();
  const dur = (lap.duration ?? lap.lap_duration ?? 0) * 1000;
  return new Date(start + dur).toISOString();
}


export function teamColor(d: Pick<Driver, "team_colour"> | undefined, fallback = "#9ca3af"): string {
  if (!d?.team_colour) return fallback;
  return d.team_colour.startsWith("#") ? d.team_colour : `#${d.team_colour}`;
}
