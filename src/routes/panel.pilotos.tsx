import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ErrorBox, Loading, PanelSection, RequireSession } from "@/components/panel-ui";
import { driverStandings } from "@/lib/ergast";
import { YEARS, useSessionState } from "@/components/session-picker";
import { openf1, teamColor, type Driver } from "@/lib/openf1";
import { enrichLaps, pickQuicklaps, boxStats } from "@/lib/analysis";
import { formatLapTime } from "@/lib/format";

export const Route = createFileRoute("/panel/pilotos")({
  component: () => (
    <PanelSection
      title="Pilotos"
      subtitle="Clasificación del campeonato de pilotos y comparativa de ritmo entre compañeros de equipo en la carrera seleccionada."
    >
      <Standings />
      <TeammateComparison />
    </PanelSection>
  ),
});

function Standings() {
  const [year, setYear] = useState(2025);
  const q = useQuery({
    queryKey: ["driver-standings", year],
    queryFn: () => driverStandings(year),
    staleTime: 3.6e6,
  });
  const max = q.data ? Math.max(...q.data.map((s) => Number(s.points))) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">CAMPEONATO DE PILOTOS</h2>
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
      {q.isLoading && <Loading label="Cargando clasificación" />}
      {q.error && <ErrorBox error={q.error} />}
      {q.data && (
        <div className="space-y-px bg-border">
          {q.data.map((s) => {
            const pct = max ? (Number(s.points) / max) * 100 : 0;
            return (
              <div key={s.Driver.driverId} className="bg-background p-4 grid grid-cols-12 items-center gap-3">
                <div className="col-span-1 font-display text-2xl text-racing">{s.position.padStart(2, "0")}</div>
                <div className="col-span-3 font-mono text-sm">{s.Driver.givenName} <span className="font-semibold">{s.Driver.familyName}</span></div>
                <div className="col-span-3 font-mono text-xs text-muted-foreground">{s.Constructors[0]?.name}</div>
                <div className="col-span-4 h-1.5 bg-surface relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-racing" style={{ width: `${pct}%` }} />
                </div>
                <div className="col-span-1 text-right font-mono text-xs text-muted-foreground">{s.wins}v</div>
                <div className="col-span-12 md:col-span-12 mt-1 md:mt-0 hidden md:block" />
                <div className="col-span-12 md:absolute md:right-6 md:top-1/2 md:-translate-y-1/2 md:col-auto font-display text-2xl text-right">{s.points}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeammateComparison() {
  const { sessionKey } = useSessionState();
  return (
    <div className="space-y-4 pt-12 border-t border-border">
      <h2 className="font-display text-2xl">COMPARATIVA DE COMPAÑEROS DE EQUIPO</h2>
      <p className="text-sm text-muted-foreground">
        Distribución de tiempos de vuelta representativos (≤1.07× la mejor de cada piloto) entre dos compañeros de equipo en la sesión seleccionada arriba.
      </p>
      <RequireSession>
        {sessionKey && <Inner />}
      </RequireSession>
    </div>
  );
}

function Inner() {
  const { sessionKey } = useSessionState();
  const driversQ = useQuery({ queryKey: ["drivers", sessionKey], queryFn: () => openf1.drivers(sessionKey!), staleTime: 3.6e6 });
  const drivers = driversQ.data ?? [];
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  if (drivers.length && a === null) setA(drivers[0].driver_number);
  if (drivers.length >= 2 && b === null) setB(drivers[1].driver_number);

  if (driversQ.isLoading) return <Loading label="Cargando pilotos" />;
  if (driversQ.error) return <ErrorBox error={driversQ.error} />;

  const dA = drivers.find((d) => d.driver_number === a);
  const dB = drivers.find((d) => d.driver_number === b);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-px bg-border">
        <DriverPicker label="Piloto 1" drivers={drivers} value={a} onChange={setA} />
        <DriverPicker label="Piloto 2" drivers={drivers} value={b} onChange={setB} />
      </div>
      {a && b && a !== b && dA && dB && <Boxes driverA={dA} driverB={dB} />}
      {a && b && a === b && <ErrorBox error="Selecciona dos pilotos diferentes." />}
    </div>
  );
}

function DriverPicker({ label, drivers, value, onChange }: { label: string; drivers: Driver[]; value: number | null; onChange: (n: number) => void }) {
  return (
    <label className="bg-background p-4 flex flex-col">
      <span className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-2">{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} className="bg-transparent font-mono text-sm outline-none py-2">
        {drivers.map((d) => (
          <option key={d.driver_number} value={d.driver_number}>
            {d.name_acronym} — {d.team_name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Boxes({ driverA, driverB }: { driverA: Driver; driverB: Driver }) {
  const { sessionKey } = useSessionState();
  const q = useQuery({
    queryKey: ["teammate", sessionKey, driverA.driver_number, driverB.driver_number],
    queryFn: async () => {
      const [lA, lB, sA, sB] = await Promise.all([
        openf1.laps(sessionKey!, driverA.driver_number),
        openf1.laps(sessionKey!, driverB.driver_number),
        openf1.stints(sessionKey!),
        openf1.stints(sessionKey!),
      ]);
      return {
        a: pickQuicklaps(enrichLaps(lA, sA.filter((s) => s.driver_number === driverA.driver_number))).map((l) => l.lapTimeSeconds),
        b: pickQuicklaps(enrichLaps(lB, sB.filter((s) => s.driver_number === driverB.driver_number))).map((l) => l.lapTimeSeconds),
      };
    },
    staleTime: 3.6e6,
  });

  if (q.isLoading) return <Loading label="Cargando ritmos" />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data || (!q.data.a.length && !q.data.b.length)) return <ErrorBox error="No hay vueltas representativas para los pilotos seleccionados." />;

  const statsA = boxStats(q.data.a);
  const statsB = boxStats(q.data.b);
  const all = [...q.data.a, ...q.data.b];
  const min = Math.min(...all), max = Math.max(...all);

  return (
    <div className="grid md:grid-cols-2 gap-px bg-border">
      {[
        { d: driverA, s: statsA, times: q.data.a },
        { d: driverB, s: statsB, times: q.data.b },
      ].map(({ d, s, times }) => (
        <div key={d.driver_number} className="bg-background p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-3 w-3 rounded-full" style={{ background: teamColor(d) }} />
            <span className="font-display text-2xl">{d.name_acronym}</span>
            <span className="font-mono text-xs text-muted-foreground">{d.team_name}</span>
          </div>
          {s ? (
            <>
              <BoxPlot stats={s} min={min} max={max} color={teamColor(d)} times={times} />
              <div className="grid grid-cols-3 gap-px bg-border mt-4">
                <Mini label="Vueltas" value={String(times.length)} />
                <Mini label="Media" value={formatLapTime(times.reduce((a, b) => a + b, 0) / times.length)} />
                <Mini label="Mejor" value={formatLapTime(s.min)} accent />
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Sin vueltas representativas.</div>
          )}
        </div>
      ))}
    </div>
  );
}

function BoxPlot({ stats, min, max, color, times }: { stats: NonNullable<ReturnType<typeof boxStats>>; min: number; max: number; color: string; times: number[] }) {
  const W = 480, H = 110;
  const pad = 20;
  const xs = (v: number) => pad + ((v - min) / (max - min)) * (W - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke="var(--border)" />
      {/* whiskers */}
      <line x1={xs(stats.min)} y1={H / 2 - 20} x2={xs(stats.min)} y2={H / 2 + 20} stroke="var(--muted-foreground)" />
      <line x1={xs(stats.max)} y1={H / 2 - 20} x2={xs(stats.max)} y2={H / 2 + 20} stroke="var(--muted-foreground)" />
      <line x1={xs(stats.min)} y1={H / 2} x2={xs(stats.q1)} y2={H / 2} stroke="var(--muted-foreground)" />
      <line x1={xs(stats.q3)} y1={H / 2} x2={xs(stats.max)} y2={H / 2} stroke="var(--muted-foreground)" />
      {/* box */}
      <rect x={xs(stats.q1)} y={H / 2 - 25} width={xs(stats.q3) - xs(stats.q1)} height={50} fill={color} fillOpacity={0.6} stroke={color} />
      {/* median */}
      <line x1={xs(stats.median)} y1={H / 2 - 25} x2={xs(stats.median)} y2={H / 2 + 25} stroke="#000" strokeWidth={2} />
      {/* points */}
      {times.map((t, i) => (
        <circle key={i} cx={xs(t)} cy={H / 2} r={2} fill="#fff" fillOpacity={0.4} />
      ))}
      <text x={pad} y={H - 4} fontSize={10} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">{min.toFixed(2)}s</text>
      <text x={W - pad} y={H - 4} fontSize={10} fill="var(--muted-foreground)" textAnchor="end" fontFamily="var(--font-mono)">{max.toFixed(2)}s</text>
    </svg>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-background p-3">
      <div className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground uppercase">{label}</div>
      <div className={"font-mono text-sm " + (accent ? "text-racing" : "")}>{value}</div>
    </div>
  );
}
