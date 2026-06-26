import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSessionState } from "@/components/session-picker";
import { ErrorBox, Loading, PanelSection, RequireSession } from "@/components/panel-ui";
import { fastestLap, lapEnd, openf1, teamColor, type Driver } from "@/lib/openf1";
import { buildTrackSpeed, plasma } from "@/lib/analysis";
import { formatLapTime } from "@/lib/format";

export const Route = createFileRoute("/panel/mapa")({
  component: () => (
    <PanelSection
      title="Mapa de Velocidad"
      subtitle="Traza la vuelta más rápida del piloto sobre el circuito, coloreada según la velocidad alcanzada en cada punto (plasma)."
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
  const drivers = driversQ.data ?? [];
  const [dn, setDn] = useState<number | null>(null);
  if (drivers.length && dn === null) setDn(drivers[0].driver_number);

  if (driversQ.isLoading) return <Loading label="Cargando pilotos" />;
  if (driversQ.error) return <ErrorBox error={driversQ.error} />;
  const driver = drivers.find((d) => d.driver_number === dn);

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border p-4">
        <div className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-3">Piloto</div>
        <div className="flex flex-wrap gap-2">
          {drivers.map((d) => {
            const on = d.driver_number === dn;
            return (
              <button
                key={d.driver_number}
                onClick={() => setDn(d.driver_number)}
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
      {driver && <Map driver={driver} />}
    </div>
  );
}

function Map({ driver }: { driver: Driver }) {
  const { sessionKey } = useSessionState();
  const q = useQuery({
    queryKey: ["map", sessionKey, driver.driver_number],
    queryFn: async () => {
      const laps = await openf1.laps(sessionKey!, driver.driver_number);
      const fl = fastestLap(laps);
      if (!fl) return null;
      const [loc, car] = await Promise.all([
        openf1.location(sessionKey!, driver.driver_number, fl.date_start!, lapEnd(fl)),
        openf1.carData(sessionKey!, driver.driver_number, fl.date_start!, lapEnd(fl)),
      ]);
      return { fl, loc, car };
    },
    staleTime: 3.6e6,
  });

  const built = useMemo(() => {
    if (!q.data) return null;
    if (!q.data.loc.length) return null;
    const ts = buildTrackSpeed(q.data.loc, q.data.car) as { x: number[]; y: number[]; speed: number[] };
    const minX = Math.min(...ts.x), maxX = Math.max(...ts.x);
    const minY = Math.min(...ts.y), maxY = Math.max(...ts.y);
    const minSpeed = Math.min(...ts.speed);
    const maxSpeed = Math.max(...ts.speed);
    return { ...ts, minX, maxX, minY, maxY, minSpeed, maxSpeed };
  }, [q.data]);

  if (q.isLoading) return <Loading label="Cargando trazado y telemetría" />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data || !built) return <ErrorBox error="No hay datos de localización disponibles para este piloto en esta sesión." />;

  const W = 1000, H = 700, P = 40;
  const scaleX = (x: number) => P + ((x - built.minX) / (built.maxX - built.minX)) * (W - P * 2);
  const scaleY = (y: number) => H - P - ((y - built.minY) / (built.maxY - built.minY)) * (H - P * 2);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-px bg-border">
        <Stat label="Vuelta rápida" value={formatLapTime(q.data.fl.lap_duration)} />
        <Stat label="V. mínima" value={`${Math.round(built.minSpeed)} km/h`} />
        <Stat label="V. máxima" value={`${Math.round(built.maxSpeed)} km/h`} accent />
      </div>
      <div className="bg-surface border border-border p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {/* asfalto: línea negra gruesa de fondo */}
          <polyline
            points={built.x.map((_, i) => `${scaleX(built.x[i])},${scaleY(built.y[i])}`).join(" ")}
            fill="none" stroke="#000" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round"
          />
          {/* segmentos coloreados por velocidad */}
          {built.x.slice(0, -1).map((_, i) => (
            <line
              key={i}
              x1={scaleX(built.x[i])} y1={scaleY(built.y[i])}
              x2={scaleX(built.x[i + 1])} y2={scaleY(built.y[i + 1])}
              stroke={plasma((built.speed[i] - built.minSpeed) / Math.max(1, built.maxSpeed - built.minSpeed))}
              strokeWidth={7} strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="mt-4 flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>{Math.round(built.minSpeed)} km/h</span>
          <div
            className="flex-1 h-2"
            style={{
              background: `linear-gradient(to right, ${plasma(0)}, ${plasma(0.25)}, ${plasma(0.5)}, ${plasma(0.75)}, ${plasma(1)})`,
            }}
          />
          <span>{Math.round(built.maxSpeed)} km/h</span>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Tonos más claros / amarillos indican mayor velocidad; tonos más oscuros / morados indican frenadas o curvas lentas.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-background p-4">
      <div className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-1">{label}</div>
      <div className={"font-display text-2xl " + (accent ? "text-racing" : "")}>{value}</div>
    </div>
  );
}
