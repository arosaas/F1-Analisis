import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useSessionState } from "@/components/session-picker";
import { ErrorBox, Loading, PanelSection, RequireSession } from "@/components/panel-ui";
import { openf1, teamColor } from "@/lib/openf1";

export const Route = createFileRoute("/panel/posiciones")({
  component: () => (
    <PanelSection title="Posiciones en Carrera" subtitle="Evolución de la posición de cada piloto al final de cada vuelta.">
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
  const posQ = useQuery({ queryKey: ["pos", sessionKey], queryFn: () => openf1.position(sessionKey!), staleTime: 3.6e6 });

  const drivers = driversQ.data ?? [];

  const data = useMemo(() => {
    const laps = lapsQ.data ?? [];
    const positions = (posQ.data ?? []).slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // For each driver, build laps with start times to associate position-at-lap-end
    const byDriver = new Map<number, Map<number, number>>(); // driverNumber -> lap -> position
    for (const d of drivers) {
      const dLaps = laps
        .filter((l) => l.driver_number === d.driver_number && l.date_start)
        .sort((a, b) => new Date(a.date_start!).getTime() - new Date(b.date_start!).getTime());
      const dPos = positions.filter((p) => p.driver_number === d.driver_number);
      const m = new Map<number, number>();
      for (const lap of dLaps) {
        const startMs = new Date(lap.date_start!).getTime();
        const endMs = startMs + (lap.lap_duration ?? 0) * 1000;
        // Last known position <= endMs
        let pos: number | null = null;
        for (const p of dPos) {
          const t = new Date(p.date).getTime();
          if (t <= endMs) pos = p.position;
          else break;
        }
        if (pos != null) m.set(lap.lap_number, pos);
      }
      byDriver.set(d.driver_number, m);
    }

    const allLaps = new Set<number>();
    for (const m of byDriver.values()) for (const k of m.keys()) allLaps.add(k);
    const lapsArr = [...allLaps].sort((a, b) => a - b);
    return lapsArr.map((lap) => {
      const row: Record<string, number | null> = { lap };
      for (const d of drivers) row[d.name_acronym] = byDriver.get(d.driver_number)?.get(lap) ?? null;
      return row;
    });
  }, [drivers, lapsQ.data, posQ.data]);

  if (driversQ.isLoading || lapsQ.isLoading || posQ.isLoading) return <Loading label="Cargando posiciones" />;
  if (driversQ.error || lapsQ.error || posQ.error) return <ErrorBox error={driversQ.error ?? lapsQ.error ?? posQ.error} />;
  if (!data.length) return <ErrorBox error="No hay datos de posición para esta sesión." />;

  return (
    <div className="bg-surface border border-border p-6">
      <div className="font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase mb-4">Posición vuelta a vuelta</div>
      <div style={{ width: "100%", height: 520 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="lap" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis reversed domain={[1, "dataMax"]} stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
            {drivers.map((d) => (
              <Line key={d.driver_number} type="monotone" dataKey={d.name_acronym} stroke={teamColor(d)} dot={false} strokeWidth={1.6} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
