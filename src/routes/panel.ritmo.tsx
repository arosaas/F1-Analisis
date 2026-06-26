import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useSessionState } from "@/components/session-picker";
import { ErrorBox, Loading, PanelSection, RequireSession } from "@/components/panel-ui";
import { openf1, teamColor } from "@/lib/openf1";
import { enrichLaps, summarizeAveragePace } from "@/lib/analysis";
import { formatLapTime } from "@/lib/format";

export const Route = createFileRoute("/panel/ritmo")({
  component: () => (
    <PanelSection
      title="Ritmo de Carrera"
      subtitle="Evolución del tiempo de vuelta a lo largo de la carrera para varios pilotos. El resumen inferior usa solo vueltas representativas (LapTime ≤ 1.07× la mejor vuelta del piloto)."
    >
      <RequireSession>
        <Inner />
      </RequireSession>
    </PanelSection>
  ),
});

function Inner() {
  const { sessionKey } = useSessionState();
  const driversQ = useQuery({ queryKey: ["drivers", sessionKey], queryFn: () => openf1.drivers(sessionKey!), staleTime: 3.6e6 });
  const lapsQ = useQuery({ queryKey: ["laps-all", sessionKey], queryFn: () => openf1.laps(sessionKey!), staleTime: 3.6e6 });
  const stintsQ = useQuery({ queryKey: ["stints", sessionKey], queryFn: () => openf1.stints(sessionKey!), staleTime: 3.6e6 });

  const drivers = driversQ.data ?? [];
  const [selected, setSelected] = useState<Set<number>>(new Set());

  if (drivers.length && selected.size === 0) {
    setSelected(new Set(drivers.slice(0, 3).map((d) => d.driver_number)));
  }

  const lapsData = useMemo(() => {
    const laps = lapsQ.data ?? [];
    const stints = stintsQ.data ?? [];
    const byDriverNum = new Map<number, ReturnType<typeof enrichLaps>>();
    for (const d of drivers) {
      const dLaps = laps.filter((l) => l.driver_number === d.driver_number);
      const dStints = stints.filter((s) => s.driver_number === d.driver_number);
      byDriverNum.set(d.driver_number, enrichLaps(dLaps, dStints));
    }
    return byDriverNum;
  }, [drivers, lapsQ.data, stintsQ.data]);

  const chartData = useMemo(() => {
    const byLap = new Map<number, Record<string, number | null>>();
    for (const d of drivers) {
      if (!selected.has(d.driver_number)) continue;
      const dLaps = lapsData.get(d.driver_number) ?? [];
      for (const l of dLaps) {
        let row = byLap.get(l.lapNumber);
        if (!row) { row = { lap: l.lapNumber }; byLap.set(l.lapNumber, row); }
        row[d.name_acronym] = l.lapTimeSeconds;
      }
    }
    return [...byLap.values()].sort((a, b) => (a.lap as number) - (b.lap as number));
  }, [drivers, selected, lapsData]);

  const summary = useMemo(() => {
    const byCode = new Map<string, ReturnType<typeof enrichLaps>>();
    for (const d of drivers) {
      const dl = lapsData.get(d.driver_number);
      if (dl) byCode.set(d.name_acronym, dl);
    }
    return summarizeAveragePace(byCode);
  }, [drivers, lapsData]);

  if (driversQ.isLoading || lapsQ.isLoading || stintsQ.isLoading) return <Loading label="Cargando vueltas" />;
  if (driversQ.error || lapsQ.error || stintsQ.error) return <ErrorBox error={driversQ.error ?? lapsQ.error ?? stintsQ.error} />;

  return (
    <div className="space-y-8">
      <div className="bg-surface border border-border p-4">
        <div className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-3">Pilotos a comparar</div>
        <div className="flex flex-wrap gap-2">
          {drivers.map((d) => {
            const on = selected.has(d.driver_number);
            return (
              <button
                key={d.driver_number}
                onClick={() => {
                  const next = new Set(selected);
                  on ? next.delete(d.driver_number) : next.add(d.driver_number);
                  setSelected(next);
                }}
                className="px-3 py-1.5 font-mono text-xs border transition-all"
                style={{
                  borderColor: on ? teamColor(d) : "var(--border)",
                  background: on ? teamColor(d) : "transparent",
                  color: on ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {d.name_acronym}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-surface border border-border p-6">
        <div className="font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase mb-1">Evolución del tiempo de vuelta</div>
        <p className="text-xs text-muted-foreground mb-4">
          Se incluyen todas las vueltas con tiempo registrado. Para ritmo "puro" mira la tabla de abajo.
        </p>
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="lap" stroke="var(--muted-foreground)" fontSize={11}
                label={{ value: "Número de vuelta", position: "insideBottom", offset: -2, fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => formatLapTime(v)} width={70} domain={["auto", "auto"]}
                label={{ value: "Tiempo (s)", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12 }}
                formatter={(v: any) => formatLapTime(Number(v))}
              />
              <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
              {drivers.filter((d) => selected.has(d.driver_number)).map((d) => (
                <Line key={d.driver_number} type="monotone" dataKey={d.name_acronym} stroke={teamColor(d)} dot={{ r: 2 }} strokeWidth={1.4} isAnimationActive={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-surface border border-border">
        <div className="px-6 py-4 border-b border-border font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase">
          Resumen de ritmo (vueltas representativas, ≤1.07× la mejor del piloto)
        </div>
        <div className="grid grid-cols-12 px-6 py-3 border-b border-border font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
          <div className="col-span-1">#</div>
          <div className="col-span-2">Piloto</div>
          <div className="col-span-2 text-right">Vueltas</div>
          <div className="col-span-2 text-right">Media</div>
          <div className="col-span-2 text-right">Mediana</div>
          <div className="col-span-2 text-right">Mejor</div>
          <div className="col-span-1 text-right">σ</div>
        </div>
        <div className="divide-y divide-border">
          {summary.map((s, i) => (
            <div key={s.driver} className="grid grid-cols-12 px-6 py-3 font-mono text-sm">
              <div className="col-span-1 text-muted-foreground">{String(i + 1).padStart(2, "0")}</div>
              <div className="col-span-2">{s.driver}</div>
              <div className="col-span-2 text-right text-muted-foreground">{s.considered}</div>
              <div className="col-span-2 text-right">{formatLapTime(s.mean)}</div>
              <div className="col-span-2 text-right text-muted-foreground">{formatLapTime(s.median)}</div>
              <div className="col-span-2 text-right text-racing">{formatLapTime(s.best)}</div>
              <div className="col-span-1 text-right text-muted-foreground">{s.std.toFixed(3)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
