// Puerto TS de core/utils.py + analysis/*.py
// Mantenemos los mismos nombres y semántica de las funciones del repo Python.

import type { CarData, Lap, LocationPoint, Stint, Driver } from "./openf1";

// ===== core/utils.py =====
export function formatTimedelta(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return "—";
  const minutes = Math.floor(seconds / 60);
  const s = seconds - minutes * 60;
  if (minutes > 0) return `${minutes}:${s.toFixed(3).padStart(6, "0")}`;
  return `${s.toFixed(3)}s`;
}

// ===== analysis/qualifying.py =====

export interface DriverLapTelemetry {
  driverCode: string;
  lap: Lap;
  /** Telemetría con Distance (m) y Time (s relativo al inicio de vuelta) */
  telemetry: {
    distance: number[];
    time: number[];
    speed: number[];
    throttle: number[];
    brake: number[];
    nGear: number[];
    rpm: number[];
  };
  color: string;
}

/**
 * Construye telemetría procesada: añade Distance integrando velocidad sobre el
 * tiempo (equivalente a add_distance() de FastF1).
 */
export function buildTelemetry(samples: CarData[]): DriverLapTelemetry["telemetry"] {
  if (!samples.length) return { distance: [], time: [], speed: [], throttle: [], brake: [], nGear: [], rpm: [] };
  const sorted = samples.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const t0 = new Date(sorted[0].date).getTime();
  const time: number[] = [];
  const distance: number[] = [];
  const speed: number[] = [];
  const throttle: number[] = [];
  const brake: number[] = [];
  const nGear: number[] = [];
  const rpm: number[] = [];
  let cumDist = 0;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const tNow = (new Date(p.date).getTime() - t0) / 1000;
    if (i > 0) {
      const dt = tNow - time[i - 1];
      // velocidad media del intervalo, km/h -> m/s
      const vAvg = (sorted[i - 1].speed + p.speed) / 2 / 3.6;
      cumDist += vAvg * dt;
    }
    time.push(tNow);
    distance.push(cumDist);
    speed.push(p.speed);
    throttle.push(p.throttle);
    brake.push(p.brake);
    nGear.push(p.n_gear);
    rpm.push(p.rpm);
  }
  return { distance, time, speed, throttle, brake, nGear, rpm };
}

/** Versión Python: compute_delta_time — rejilla común de 1000 puntos por distancia. */
export function computeDeltaTime(
  ref: DriverLapTelemetry,
  comp: DriverLapTelemetry,
): { distance: number[]; delta: number[] } {
  const maxDistance = Math.min(
    ref.telemetry.distance[ref.telemetry.distance.length - 1] ?? 0,
    comp.telemetry.distance[comp.telemetry.distance.length - 1] ?? 0,
  );
  const N = 1000;
  const distance: number[] = new Array(N);
  for (let i = 0; i < N; i++) distance[i] = (i / (N - 1)) * maxDistance;
  const refTime = interp(distance, ref.telemetry.distance, ref.telemetry.time);
  const compTime = interp(distance, comp.telemetry.distance, comp.telemetry.time);
  const delta = compTime.map((v, i) => v - refTime[i]);
  return { distance, delta };
}

/** np.interp equivalente. xs e ys deben estar ordenados por xs ascendente. */
export function interp(xs: number[], xp: number[], yp: number[]): number[] {
  const out: number[] = new Array(xs.length);
  let j = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (x <= xp[0]) { out[i] = yp[0]; continue; }
    if (x >= xp[xp.length - 1]) { out[i] = yp[yp.length - 1]; continue; }
    while (j < xp.length - 1 && xp[j + 1] < x) j++;
    const x0 = xp[j], x1 = xp[j + 1], y0 = yp[j], y1 = yp[j + 1];
    out[i] = y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
  }
  return out;
}

export interface SectorSummaryRow {
  segment: string;
  refValue: number | null; // s
  compValue: number | null; // s
  diff: number | null; // s (comp - ref)
}

export function buildSectorSummary(ref: DriverLapTelemetry, comp: DriverLapTelemetry): SectorSummaryRow[] {
  const pairs: { label: string; key: keyof Lap }[] = [
    { label: "Vuelta completa", key: "lap_duration" },
    { label: "Sector 1", key: "duration_sector_1" },
    { label: "Sector 2", key: "duration_sector_2" },
    { label: "Sector 3", key: "duration_sector_3" },
  ];
  return pairs.map(({ label, key }) => {
    const r = ref.lap[key] as number | null;
    const c = comp.lap[key] as number | null;
    return {
      segment: label,
      refValue: r,
      compValue: c,
      diff: r != null && c != null ? c - r : null,
    };
  });
}

// ===== analysis/race_pace.py =====

export interface DriverRaceLap {
  lapNumber: number;
  lapTimeSeconds: number;
  compound: string | null;
  tyreLife: number | null;
  stint: number | null;
  isPitOut: boolean;
  isPitIn: boolean;
}

/** Equivalente a pick_quicklaps(threshold): vueltas con LapTime <= threshold * fastest. */
export function pickQuicklaps(laps: DriverRaceLap[], threshold = 1.07): DriverRaceLap[] {
  const valid = laps.filter((l) => l.lapTimeSeconds > 0);
  if (!valid.length) return [];
  const fastest = Math.min(...valid.map((l) => l.lapTimeSeconds));
  return valid.filter((l) => l.lapTimeSeconds <= threshold * fastest);
}

export interface PaceSummaryRow {
  driver: string;
  considered: number;
  mean: number;
  median: number;
  best: number;
  std: number;
}

export function summarizeAveragePace(
  byDriver: Map<string, DriverRaceLap[]>,
): PaceSummaryRow[] {
  const rows: PaceSummaryRow[] = [];
  for (const [driver, laps] of byDriver) {
    const quick = pickQuicklaps(laps);
    if (!quick.length) continue;
    const times = quick.map((l) => l.lapTimeSeconds);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const best = sorted[0];
    const variance = times.reduce((acc, v) => acc + (v - mean) ** 2, 0) / times.length;
    const std = Math.sqrt(variance);
    rows.push({ driver, considered: times.length, mean, median, best, std });
  }
  return rows.sort((a, b) => a.mean - b.mean);
}

// ===== analysis/tyre_strategy.py =====

export interface StintGrouped {
  driver: string;
  driverNumber: number;
  stint: number;
  compound: string;
  startLap: number;
  endLap: number;
  stintLength: number;
  tyreAgeAtStart: number;
}

export function buildStintsTable(stints: Stint[], drivers: Driver[]): StintGrouped[] {
  return stints
    .slice()
    .sort((a, b) => a.driver_number - b.driver_number || a.stint_number - b.stint_number)
    .map((s) => {
      const d = drivers.find((x) => x.driver_number === s.driver_number);
      return {
        driver: d?.name_acronym ?? `#${s.driver_number}`,
        driverNumber: s.driver_number,
        stint: s.stint_number,
        compound: s.compound,
        startLap: s.lap_start,
        endLap: s.lap_end,
        stintLength: s.lap_end - s.lap_start + 1,
        tyreAgeAtStart: s.tyre_age_at_start,
      };
    });
}

export interface DegradationRow { compound: string; tyreLife: number; lapTimeSeconds: number }

/** Media de tiempo de vuelta por (compuesto, vida del neumático) usando quicklaps. */
export function buildDegradationTable(laps: DriverRaceLap[]): DegradationRow[] {
  const quick = pickQuicklaps(laps).filter((l) => l.compound && l.tyreLife != null);
  const groups = new Map<string, number[]>();
  for (const l of quick) {
    const key = `${l.compound}|${l.tyreLife}`;
    const arr = groups.get(key) ?? [];
    arr.push(l.lapTimeSeconds);
    groups.set(key, arr);
  }
  const rows: DegradationRow[] = [];
  for (const [key, times] of groups) {
    const [compound, life] = key.split("|");
    rows.push({
      compound,
      tyreLife: Number(life),
      lapTimeSeconds: times.reduce((a, b) => a + b, 0) / times.length,
    });
  }
  return rows.sort((a, b) => a.compound.localeCompare(b.compound) || a.tyreLife - b.tyreLife);
}

export function getCompoundUsageSummary(stints: Stint[]): { compound: string; totalLaps: number }[] {
  const counts = new Map<string, number>();
  for (const s of stints) {
    counts.set(s.compound, (counts.get(s.compound) ?? 0) + (s.lap_end - s.lap_start + 1));
  }
  return [...counts.entries()]
    .map(([compound, totalLaps]) => ({ compound, totalLaps }))
    .sort((a, b) => b.totalLaps - a.totalLaps);
}

// ===== analysis/track_map.py =====

export interface TrackSpeedData {
  driverCode: string;
  lap: Lap;
  x: number[];
  y: number[];
  speed: number[]; // alineado con x/y por interp temporal
}

export function buildTrackSpeed(loc: LocationPoint[], car: CarData[]): TrackSpeedData["x"] extends never ? never : { x: number[]; y: number[]; speed: number[] } {
  const sortedLoc = loc.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const sortedCar = car.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const x = sortedLoc.map((p) => p.x);
  const y = sortedLoc.map((p) => p.y);
  // Para cada punto de localización, busca el sample de car_data más cercano por tiempo.
  let idx = 0;
  const speed = sortedLoc.map((p) => {
    const t = new Date(p.date).getTime();
    while (idx < sortedCar.length - 1 && new Date(sortedCar[idx + 1].date).getTime() <= t) idx++;
    const a = sortedCar[idx];
    const b = sortedCar[Math.min(idx + 1, sortedCar.length - 1)];
    if (!a) return 0;
    const ta = new Date(a.date).getTime();
    const tb = new Date(b.date).getTime();
    if (tb === ta) return a.speed;
    const k = Math.max(0, Math.min(1, (t - ta) / (tb - ta)));
    return a.speed + (b.speed - a.speed) * k;
  });
  return { x, y, speed } as any;
}

// ===== Colormap plasma (aproximación de matplotlib) =====
// Stops aproximados de matplotlib.cm.plasma
const PLASMA_STOPS: [number, [number, number, number]][] = [
  [0.0, [13, 8, 135]],
  [0.13, [75, 3, 161]],
  [0.25, [125, 3, 168]],
  [0.38, [168, 34, 150]],
  [0.5, [203, 70, 121]],
  [0.63, [229, 107, 93]],
  [0.75, [248, 148, 65]],
  [0.88, [253, 195, 40]],
  [1.0, [240, 249, 33]],
];

export function plasma(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < PLASMA_STOPS.length - 1 && PLASMA_STOPS[i + 1][0] < x) i++;
  const [t0, c0] = PLASMA_STOPS[i];
  const [t1, c1] = PLASMA_STOPS[Math.min(i + 1, PLASMA_STOPS.length - 1)];
  const k = t1 === t0 ? 0 : (x - t0) / (t1 - t0);
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * k);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * k);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

// ===== analysis/season_overview.py =====

export interface TeamPaceRow {
  driver: string;
  team: string;
  lapTimes: number[]; // segundos
}

/** Devuelve { team -> array de tiempos de vuelta limpias de todos sus pilotos } */
export function buildTeamPaceTable(
  driverLaps: Map<number, DriverRaceLap[]>,
  drivers: Driver[],
): Map<string, { color: string; times: number[]; drivers: string[] }> {
  const out = new Map<string, { color: string; times: number[]; drivers: string[] }>();
  for (const d of drivers) {
    const laps = driverLaps.get(d.driver_number);
    if (!laps) continue;
    const quick = pickQuicklaps(laps);
    if (!quick.length) continue;
    const cur = out.get(d.team_name) ?? { color: d.team_colour ? `#${d.team_colour}` : "#999", times: [], drivers: [] };
    cur.times.push(...quick.map((l) => l.lapTimeSeconds));
    if (!cur.drivers.includes(d.name_acronym)) cur.drivers.push(d.name_acronym);
    out.set(d.team_name, cur);
  }
  return out;
}

export function orderTeamsByMedianPace(table: Map<string, { times: number[] }>): string[] {
  const medians: [string, number][] = [];
  for (const [team, v] of table) {
    if (!v.times.length) continue;
    const sorted = [...v.times].sort((a, b) => a - b);
    medians.push([team, sorted[Math.floor(sorted.length / 2)]]);
  }
  return medians.sort((a, b) => a[1] - b[1]).map(([t]) => t);
}

/** Estadísticos para boxplot: min, q1, median, q3, max (sin outliers, igual a matplotlib showfliers=False) */
export function boxStats(values: number[]) {
  const n = values.length;
  if (!n) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = p * (n - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const q1 = q(0.25), median = q(0.5), q3 = q(0.75);
  const iqr = q3 - q1;
  const lower = sorted.find((v) => v >= q1 - 1.5 * iqr) ?? sorted[0];
  const upper = [...sorted].reverse().find((v) => v <= q3 + 1.5 * iqr) ?? sorted[n - 1];
  return { min: lower, q1, median, q3, max: upper };
}

// ===== Helpers de adaptación OpenF1 -> shape estilo FastF1 =====

/** Enriquece las vueltas con compound, tyreLife y stint a partir de los stints del piloto. */
export function enrichLaps(laps: Lap[], stints: Stint[]): DriverRaceLap[] {
  return laps
    .filter((l) => l.lap_duration != null && l.lap_duration > 0)
    .map((l) => {
      const s = stints.find((st) => l.lap_number >= st.lap_start && l.lap_number <= st.lap_end);
      return {
        lapNumber: l.lap_number,
        lapTimeSeconds: l.lap_duration as number,
        compound: s?.compound ?? null,
        tyreLife: s ? s.tyre_age_at_start + (l.lap_number - s.lap_start) : null,
        stint: s?.stint_number ?? null,
        isPitOut: Boolean(l.is_pit_out_lap),
        isPitIn: false,
      };
    });
}
