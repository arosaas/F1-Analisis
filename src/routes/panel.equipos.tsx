import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ErrorBox, Loading, PanelSection, RequireSession } from "@/components/panel-ui";
import { constructorStandings } from "@/lib/ergast";
import { YEARS, useSessionState } from "@/components/session-picker";
import { openf1 } from "@/lib/openf1";
import { boxStats, buildTeamPaceTable, enrichLaps, orderTeamsByMedianPace, type DriverRaceLap } from "@/lib/analysis";

export const Route = createFileRoute("/panel/equipos")({
  component: () => (
    <PanelSection
      title="Equipos"
      subtitle="Clasificación del campeonato de constructores y comparativa de ritmo entre equipos en la carrera seleccionada."
    >
      <Standings />
      <TeamPace />
    </PanelSection>
  ),
});

function Standings() {
  const [year, setYear] = useState(2025);
  const q = useQuery({
    queryKey: ["constructor-standings", year],
    queryFn: () => constructorStandings(year),
    staleTime: 3.6e6,
  });
  const max = q.data ? Math.max(...q.data.map((s) => Number(s.points))) : 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">CAMPEONATO DE CONSTRUCTORES</h2>
        <div className="flex gap-1">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={
                "px-3 py-1.5 font-mono text-xs border transition-colors " +
                (year === y ? "bg-racing border-racing text-racing-foreground" : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      {q.isLoading && <Loading label="Cargando constructores" />}
      {q.error && <ErrorBox error={q.error} />}
      {q.data && (
        <div className="space-y-px bg-border">
          {q.data.map((s) => {
            const pts = Number(s.points);
            const pct = max ? (pts / max) * 100 : 0;
            return (
              <div key={s.Constructor.constructorId} className="bg-background p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="flex items-baseline gap-4">
                    <span className="font-display text-3xl text-racing w-10">{s.position.padStart(2, "0")}</span>
                    <span className="font-display text-2xl">{s.Constructor.name.toUpperCase()}</span>
                    <span className="font-mono text-xs text-muted-foreground">{s.Constructor.nationality}</span>
                  </div>
                  <div className="flex items-baseline gap-4 font-mono text-sm">
                    <span className="text-muted-foreground">{s.wins} victorias</span>
                    <span className="font-display text-3xl text-foreground">{s.points}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-surface relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-racing" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeamPace() {
  const { sessionKey } = useSessionState();
  return (
    <div className="space-y-4 pt-12 border-t border-border">
      <h2 className="font-display text-2xl">RITMO DE EQUIPO EN LA SESIÓN</h2>
      <p className="text-sm text-muted-foreground">
        Distribución del tiempo de vuelta (vueltas representativas) de todos los pilotos, agrupados por equipo, ordenados por mediana (más rápido a la izquierda).
      </p>
      <RequireSession>
        {sessionKey && <PaceInner />}
      </RequireSession>
    </div>
  );
}

function PaceInner() {
  const { sessionKey } = useSessionState();
  const driversQ = useQuery({ queryKey: ["drivers", sessionKey], queryFn: () => openf1.drivers(sessionKey!), staleTime: 3.6e6 });
  const lapsQ = useQuery({ queryKey: ["laps-all", sessionKey], queryFn: () => openf1.laps(sessionKey!), staleTime: 3.6e6 });
  const stintsQ = useQuery({ queryKey: ["stints", sessionKey], queryFn: () => openf1.stints(sessionKey!), staleTime: 3.6e6 });

  const data = useMemo(() => {
    const drivers = driversQ.data ?? [];
    const laps = lapsQ.data ?? [];
    const stints = stintsQ.data ?? [];
    const byDriver = new Map<number, DriverRaceLap[]>();
    for (const d of drivers) {
      const dl = laps.filter((l) => l.driver_number === d.driver_number);
      const ds = stints.filter((s) => s.driver_number === d.driver_number);
      byDriver.set(d.driver_number, enrichLaps(dl, ds));
    }
    const table = buildTeamPaceTable(byDriver, drivers);
    const order = orderTeamsByMedianPace(table);
    return { table, order };
  }, [driversQ.data, lapsQ.data, stintsQ.data]);

  if (driversQ.isLoading || lapsQ.isLoading || stintsQ.isLoading) return <Loading label="Cargando ritmos de equipo" />;
  if (driversQ.error || lapsQ.error || stintsQ.error) return <ErrorBox error={driversQ.error ?? lapsQ.error ?? stintsQ.error} />;
  if (!data.order.length) return <ErrorBox error="No hay vueltas representativas para esta sesión." />;

  const all: number[] = [];
  for (const team of data.order) all.push(...(data.table.get(team)?.times ?? []));
  const min = Math.min(...all), max = Math.max(...all);

  const W = 1000, H = 420, padL = 80, padR = 20, padT = 20, padB = 60;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const colW = innerW / data.order.length;
  const ys = (v: number) => padT + ((v - min) / (max - min)) * innerH;

  return (
    <div className="bg-surface border border-border p-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* eje Y con ticks */}
        {Array.from({ length: 5 }).map((_, i) => {
          const v = min + (i / 4) * (max - min);
          const y = ys(v);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" />
              <text x={padL - 8} y={y + 4} fontSize={10} fill="var(--muted-foreground)" textAnchor="end" fontFamily="var(--font-mono)">
                {v.toFixed(2)}s
              </text>
            </g>
          );
        })}
        {data.order.map((team, i) => {
          const entry = data.table.get(team)!;
          const stats = boxStats(entry.times);
          if (!stats) return null;
          const cx = padL + colW * (i + 0.5);
          const bw = Math.min(40, colW * 0.5);
          return (
            <g key={team}>
              <line x1={cx} y1={ys(stats.min)} x2={cx} y2={ys(stats.max)} stroke="var(--muted-foreground)" />
              <line x1={cx - bw / 2} y1={ys(stats.min)} x2={cx + bw / 2} y2={ys(stats.min)} stroke="var(--muted-foreground)" />
              <line x1={cx - bw / 2} y1={ys(stats.max)} x2={cx + bw / 2} y2={ys(stats.max)} stroke="var(--muted-foreground)" />
              <rect x={cx - bw / 2} y={ys(stats.q1)} width={bw} height={ys(stats.q3) - ys(stats.q1)} fill={entry.color} fillOpacity={0.7} stroke={entry.color} />
              <line x1={cx - bw / 2} y1={ys(stats.median)} x2={cx + bw / 2} y2={ys(stats.median)} stroke="#000" strokeWidth={2} />
              <text x={cx} y={H - padB + 18} fontSize={10} fill="var(--foreground)" textAnchor="end" fontFamily="var(--font-mono)" transform={`rotate(-35 ${cx} ${H - padB + 18})`}>
                {team}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
