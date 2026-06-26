import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSessionState } from "@/components/session-picker";
import { ErrorBox, Loading, PanelSection, RequireSession } from "@/components/panel-ui";
import { openf1, teamColor } from "@/lib/openf1";
import { buildDegradationTable, buildStintsTable, enrichLaps, getCompoundUsageSummary } from "@/lib/analysis";
import { COMPOUND_COLORS } from "@/lib/format";

export const Route = createFileRoute("/panel/neumaticos")({
  component: () => (
    <PanelSection
      title="Estrategia de Neumáticos"
      subtitle="Stints por piloto, compuestos utilizados y degradación: cómo aumenta el tiempo de vuelta a medida que el neumático envejece."
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
  const stintsQ = useQuery({ queryKey: ["stints", sessionKey], queryFn: () => openf1.stints(sessionKey!), staleTime: 3.6e6 });
  const lapsQ = useQuery({ queryKey: ["laps-all", sessionKey], queryFn: () => openf1.laps(sessionKey!), staleTime: 3.6e6 });

  const drivers = driversQ.data ?? [];
  const stints = stintsQ.data ?? [];
  const laps = lapsQ.data ?? [];

  const grouped = useMemo(() => buildStintsTable(stints, drivers), [stints, drivers]);
  const usage = useMemo(() => getCompoundUsageSummary(stints), [stints]);
  const maxLap = Math.max(1, ...grouped.map((s) => s.endLap));

  const stintsByDriver = useMemo(() => {
    const m = new Map<number, typeof grouped>();
    for (const s of grouped) {
      const arr = m.get(s.driverNumber) ?? [];
      arr.push(s);
      m.set(s.driverNumber, arr);
    }
    return m;
  }, [grouped]);

  const [degDriver, setDegDriver] = useState<number | null>(null);
  if (drivers.length && degDriver === null) setDegDriver(drivers[0].driver_number);

  const degradationData = useMemo(() => {
    if (!degDriver) return [];
    const dLaps = laps.filter((l) => l.driver_number === degDriver);
    const dStints = stints.filter((s) => s.driver_number === degDriver);
    const enriched = enrichLaps(dLaps, dStints);
    const rows = buildDegradationTable(enriched);
    // Pivotar a {tyreLife, SOFT, MEDIUM, HARD, ...}
    const compounds = [...new Set(rows.map((r) => r.compound))];
    const byLife = new Map<number, Record<string, number | null>>();
    for (const r of rows) {
      let row = byLife.get(r.tyreLife);
      if (!row) { row = { tyreLife: r.tyreLife }; byLife.set(r.tyreLife, row); }
      row[r.compound] = r.lapTimeSeconds;
    }
    return { data: [...byLife.values()].sort((a, b) => (a.tyreLife as number) - (b.tyreLife as number)), compounds };
  }, [degDriver, laps, stints]);

  if (driversQ.isLoading || stintsQ.isLoading || lapsQ.isLoading) return <Loading label="Cargando neumáticos" />;
  if (driversQ.error || stintsQ.error || lapsQ.error) return <ErrorBox error={driversQ.error ?? stintsQ.error ?? lapsQ.error} />;

  return (
    <div className="space-y-8">
      {/* Resumen de uso de compuestos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border">
        {usage.map((u) => (
          <div key={u.compound} className="bg-background p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-3 w-3 rounded-full" style={{ background: COMPOUND_COLORS[u.compound] ?? COMPOUND_COLORS.UNKNOWN }} />
              <span className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase">{u.compound}</span>
            </div>
            <div className="font-display text-3xl">{u.totalLaps}</div>
            <div className="font-mono text-[10px] text-muted-foreground">vueltas totales</div>
          </div>
        ))}
      </div>

      {/* Gantt de stints */}
      <div className="bg-surface border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase">
          <span>Stints por piloto</span>
          <span>1 → {maxLap} vueltas</span>
        </div>
        <div className="divide-y divide-border">
          {[...stintsByDriver.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([dn, arr]) => {
              const d = drivers.find((x) => x.driver_number === dn);
              return (
                <div key={dn} className="grid grid-cols-12 gap-3 items-center px-6 py-3">
                  <div className="col-span-3 md:col-span-2 flex items-center gap-2 font-mono text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ background: teamColor(d) }} />
                    <span>{d?.name_acronym ?? `#${dn}`}</span>
                  </div>
                  <div className="col-span-9 md:col-span-10 relative h-6 bg-background border border-border">
                    {arr.map((s) => {
                      const left = ((s.startLap - 1) / maxLap) * 100;
                      const width = ((s.endLap - s.startLap + 1) / maxLap) * 100;
                      const color = COMPOUND_COLORS[s.compound] ?? COMPOUND_COLORS.UNKNOWN;
                      return (
                        <div
                          key={s.stint}
                          title={`Stint ${s.stint} · ${s.compound} · vueltas ${s.startLap}-${s.endLap} (${s.stintLength}v, edad inicial ${s.tyreAgeAtStart})`}
                          className="absolute top-0 bottom-0 flex items-center justify-center font-mono text-[10px] text-black/90 overflow-hidden border-r border-background"
                          style={{ left: `${left}%`, width: `${width}%`, background: color }}
                        >
                          {width > 6 ? s.stintLength : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Degradación por compuesto */}
      <div className="bg-surface border border-border p-6">
        <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
          <div>
            <div className="font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase">Degradación por compuesto</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tiempo de vuelta medio según la vida del neumático (TyreLife) para las vueltas rápidas del piloto.
            </p>
          </div>
          <select
            value={degDriver ?? ""}
            onChange={(e) => setDegDriver(Number(e.target.value))}
            className="bg-background border border-border font-mono text-xs px-3 py-2 outline-none"
          >
            {drivers.map((d) => (
              <option key={d.driver_number} value={d.driver_number}>{d.name_acronym}</option>
            ))}
          </select>
        </div>
        {degradationData && (degradationData as any).data?.length ? (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={(degradationData as any).data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="tyreLife" stroke="var(--muted-foreground)" fontSize={11}
                  label={{ value: "Vida del neumático (vueltas)", position: "insideBottom", offset: -2, fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${v.toFixed(1)}s`} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
                {(degradationData as any).compounds.map((c: string) => (
                  <Line key={c} type="monotone" dataKey={c} stroke={COMPOUND_COLORS[c] ?? COMPOUND_COLORS.UNKNOWN} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No hay vueltas representativas suficientes para este piloto.</div>
        )}
      </div>
    </div>
  );
}
