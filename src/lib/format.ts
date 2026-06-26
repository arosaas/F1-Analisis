export function formatLapTime(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export function formatSeconds(s: number | null | undefined, digits = 3): string {
  if (s == null || !isFinite(s)) return "—";
  return `${s.toFixed(digits)}s`;
}

export function formatDelta(d: number): string {
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  return `${sign}${Math.abs(d).toFixed(3)}s`;
}

export const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ef4444",
  MEDIUM: "#facc15",
  HARD: "#f5f5f5",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
  UNKNOWN: "#6b7280",
};
