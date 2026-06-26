import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { useSessionState } from "@/components/session-picker";
import { ErrorBox, Loading, PanelSection, RequireSession } from "@/components/panel-ui";
import { fastestLap, lapEnd, openf1, teamColor, type Driver } from "@/lib/openf1";
import {
  buildSectorSummary,
  buildTelemetry,
  computeDeltaTime,
  formatTimedelta,
  type DriverLapTelemetry,
} from "@/lib/analysis";

export const Route = createFileRoute("/panel/clasificacion")({
  component: () => (
    <PanelSection
      title="Comparativa de Vuelta Rápida"
      subtitle="Compara la telemetría de la vuelta más rápida de dos pilotos en cualquier sesión. Velocidad, acelerador, freno, marcha y RPM en función de la distancia recorrida, más el delta de tiempo acumulado a lo largo de la vuelta."
    >
      <RequireSession>
        <Inner />
      </RequireSession>
    </PanelSection>
  ),
});

function Inner() {
  const { sessionKey } = useSessionState();
  const driversQ = useQuery({
    queryKey: ["drivers", sessionKey],
    queryFn: () => openf1.drivers(sessionKey!),
    staleTime: 3.6e6,
  });
  const drivers = driversQ.data ?? [];
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);

  if (drivers.length && a === null) setA(drivers[0].driver_number);
  if (drivers.length >= 2 && b === null) setB(drivers[1].driver_number);

  if (driversQ.isLoading) return <Loading label="Cargando pilotos" />;
  if (driversQ.error) return <ErrorBox error={driversQ.error} />;
  if (!drivers.length) return <ErrorBox error="No se encontraron pilotos para esta sesión." />;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-px bg-border">
        <DriverSelect label="Piloto 1 (referencia)" drivers={drivers} value={a} onChange={setA} />
        <DriverSelect label="Piloto 2" drivers={drivers} value={b} onChange={setB} />
      </div>
      {a && b && a === b && (
        <ErrorBox error="Selecciona dos pilotos diferentes para comparar." />
      )}
      {a && b && a !== b && (
        <Comparison
          driverA={drivers.find((d) => d.driver_number === a)!}
          driverB={drivers.find((d) => d.driver_number === b)!}
        />
      )}
    </div>
  );
}

function DriverSelect({
  label,
  drivers,
  value,
  onChange,
}: {
  label: string;
  drivers: Driver[];
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <label className="bg-background p-4 flex flex-col">
      <span className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-2">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent font-mono text-sm outline-none py-2"
      >
        {drivers.map((d) => (
          <option key={d.driver_number} value={d.driver_number}>
            {d.name_acronym} ({d.full_name}) — {d.team_name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Comparison({ driverA, driverB }: { driverA: Driver; driverB: Driver }) {
  const { sessionKey } = useSessionState();
  const q = useQuery({
    queryKey: ["quali", sessionKey, driverA.driver_number, driverB.driver_number],
    queryFn: async () => {
      const [lapsA, lapsB] = await Promise.all([
        openf1.laps(sessionKey!, driverA.driver_number),
        openf1.laps(sessionKey!, driverB.driver_number),
      ]);
      const fa = fastestLap(lapsA);
      const fb = fastestLap(lapsB);
      if (!fa || !fb) return { ok: false as const };
      const [carA, carB] = await Promise.all([
        openf1.carData(sessionKey!, driverA.driver_number, fa.date_start!, lapEnd(fa)),
        openf1.carData(sessionKey!, driverB.driver_number, fb.date_start!, lapEnd(fb)),
      ]);
      const telA: DriverLapTelemetry = { driverCode: driverA.name_acronym, lap: fa, telemetry: buildTelemetry(carA), color: teamColor(driverA) };
      const telB: DriverLapTelemetry = { driverCode: driverB.name_acronym, lap: fb, telemetry: buildTelemetry(carB), color: teamColor(driverB) };
      return { ok: true as const, telA, telB };
    },
    staleTime: 3.6e6,
  });

  if (q.isLoading) return <Loading label="Cargando telemetría de la vuelta rápida" />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data?.ok) return <ErrorBox error="Alguno de los pilotos no tiene una vuelta válida registrada en esta sesión." />;
  const { telA, telB } = q.data;

  const sectorSummary = buildSectorSummary(telA, telB);
  const delta = computeDeltaTime(telA, telB);

  // Construir series por canal mergeadas por distancia bucketada
  const channels: { key: keyof DriverLapTelemetry["telemetry"]; label: string; unit: string; step?: boolean; domain?: [number, number] }[] = [
    { key: "speed", label: "Velocidad", unit: "km/h" },
    { key: "throttle", label: "Acelerador", unit: "%", domain: [0, 100] },
    { key: "brake", label: "Freno", unit: "%", step: true, domain: [0, 100] },
    { key: "nGear", label: "Marcha", unit: "", step: true, domain: [0, 8] },
    { key: "rpm", label: "RPM", unit: "" },
  ];

  return (
    <div className="space-y-8">
      <SectorTable rows={sectorSummary} a={telA.driverCode} b={telB.driverCode} />
      {channels.map((c) => (
        <ChannelChart
          key={c.key}
          title={`${c.label}${c.unit ? ` (${c.unit})` : ""}`}
          telA={telA}
          telB={telB}
          channel={c.key}
          colorA={telA.color}
          colorB={telB.color}
          step={c.step}
          domain={c.domain}
        />
      ))}
      <DeltaChart delta={delta} ref={telA.driverCode} comp={telB.driverCode} color={telB.color} />
    </div>
  );
}

function SectorTable({ rows, a, b }: { rows: ReturnType<typeof buildSectorSummary>; a: string; b: string }) {
  return (
    <div className="bg-surface border border-border">
      <div className="px-6 py-3 border-b border-border font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase">
        Resumen de tiempos
      </div>
      <div className="grid grid-cols-12 px-6 py-3 border-b border-border font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
        <div className="col-span-4">Segmento</div>
        <div className="col-span-3 text-right">{a}</div>
        <div className="col-span-3 text-right">{b}</div>
        <div className="col-span-2 text-right">Diferencia</div>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => {
          const winnerA = r.refValue != null && r.compValue != null && r.refValue < r.compValue;
          const winnerB = r.refValue != null && r.compValue != null && r.compValue < r.refValue;
          return (
            <div key={r.segment} className="grid grid-cols-12 px-6 py-3 font-mono text-sm">
              <div className="col-span-4 text-muted-foreground">{r.segment}</div>
              <div className={"col-span-3 text-right " + (winnerA ? "text-racing" : "")}>{formatTimedelta(r.refValue)}</div>
              <div className={"col-span-3 text-right " + (winnerB ? "text-racing" : "")}>{formatTimedelta(r.compValue)}</div>
              <div className="col-span-2 text-right">
                {r.diff != null ? `${r.diff >= 0 ? "+" : ""}${r.diff.toFixed(3)}s` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChannelChart({
  title, telA, telB, channel, colorA, colorB, step, domain,
}: {
  title: string;
  telA: DriverLapTelemetry; telB: DriverLapTelemetry;
  channel: keyof DriverLapTelemetry["telemetry"];
  colorA: string; colorB: string;
  step?: boolean; domain?: [number, number];
}) {
  // Mergea por distancia en buckets de 25m
  const map = new Map<number, { d: number; A?: number; B?: number }>();
  for (let i = 0; i < telA.telemetry.distance.length; i++) {
    const k = Math.round(telA.telemetry.distance[i] / 25) * 25;
    const row = map.get(k) ?? { d: k };
    row.A = telA.telemetry[channel][i];
    map.set(k, row);
  }
  for (let i = 0; i < telB.telemetry.distance.length; i++) {
    const k = Math.round(telB.telemetry.distance[i] / 25) * 25;
    const row = map.get(k) ?? { d: k };
    row.B = telB.telemetry[channel][i];
    map.set(k, row);
  }
  const data = [...map.values()].sort((a, b) => a.d - b.d);
  return (
    <div className="bg-surface border border-border p-6">
      <div className="font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase mb-4">{title}</div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="d" stroke="var(--muted-foreground)" tickFormatter={(v) => `${Math.round(v)}m`} fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={domain ?? ["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12 }}
              labelFormatter={(v) => `${v} m`}
            />
            <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
            <Line type={step ? "stepAfter" : "monotone"} dataKey="A" name={telA.driverCode} stroke={colorA} dot={false} strokeWidth={1.8} isAnimationActive={false} connectNulls />
            <Line type={step ? "stepAfter" : "monotone"} dataKey="B" name={telB.driverCode} stroke={colorB} dot={false} strokeWidth={1.8} strokeDasharray="6 3" isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DeltaChart({
  delta, ref, comp, color,
}: { delta: { distance: number[]; delta: number[] }; ref: string; comp: string; color: string }) {
  const data = delta.distance.map((d, i) => ({
    d,
    delta: delta.delta[i],
    pos: delta.delta[i] > 0 ? delta.delta[i] : 0,
    neg: delta.delta[i] < 0 ? delta.delta[i] : 0,
  }));
  return (
    <div className="bg-surface border border-border p-6">
      <div className="font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase mb-1">
        Delta de tiempo: {comp} respecto a {ref}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Valores positivos = <span className="text-foreground">{comp}</span> más lento que {ref} en ese punto. Valores negativos = más rápido.
      </p>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="d" stroke="var(--muted-foreground)" tickFormatter={(v) => `${Math.round(v)}m`} fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${v.toFixed(2)}s`} />
            <Tooltip
              contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12 }}
              labelFormatter={(v) => `${v} m`}
              formatter={(v: any) => `${Number(v).toFixed(3)}s`}
            />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" />
            <Area type="monotone" dataKey="pos" fill="#ef4444" fillOpacity={0.18} stroke="none" isAnimationActive={false} />
            <Area type="monotone" dataKey="neg" fill="#22c55e" fillOpacity={0.18} stroke="none" isAnimationActive={false} />
            <Line type="monotone" dataKey="delta" stroke={color} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
