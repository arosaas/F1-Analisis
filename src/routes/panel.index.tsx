import { Link, createFileRoute } from "@tanstack/react-router";
import { useSessionState } from "@/components/session-picker";
import { useQuery } from "@tanstack/react-query";
import { openf1 } from "@/lib/openf1";

export const Route = createFileRoute("/panel/")({
  component: PanelHome,
});

const MODULES = [
  { to: "/panel/clasificacion", n: "01", title: "Clasificación", desc: "Comparativa de telemetría entre dos pilotos en su vuelta más rápida." },
  { to: "/panel/ritmo", n: "02", title: "Ritmo de Carrera", desc: "Evolución del tiempo de vuelta y ritmo medio por piloto." },
  { to: "/panel/neumaticos", n: "03", title: "Estrategia de Neumáticos", desc: "Stints de cada piloto y compuestos utilizados." },
  { to: "/panel/posiciones", n: "04", title: "Posiciones en Carrera", desc: "Evolución de la posición vuelta a vuelta." },
  { to: "/panel/mapa", n: "05", title: "Mapa de Velocidad", desc: "Trazado del circuito coloreado por velocidad alcanzada." },
  { to: "/panel/pilotos", n: "06", title: "Pilotos", desc: "Clasificación del campeonato de pilotos." },
  { to: "/panel/equipos", n: "07", title: "Equipos", desc: "Clasificación del campeonato de constructores." },
];

function PanelHome() {
  const { sessionKey, year } = useSessionState();

  const sessionQ = useQuery({
    queryKey: ["session-meta", sessionKey],
    queryFn: async () => {
      if (!sessionKey) return null;
      const drivers = await openf1.drivers(sessionKey);
      return { drivers };
    },
    enabled: !!sessionKey,
    staleTime: 60 * 60 * 1000,
  });

  const drivers = sessionQ.data?.drivers ?? [];

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-3 gap-px bg-border">
        <Stat label="Temporada" value={String(year)} />
        <Stat label="Sesión seleccionada" value={sessionKey ? `#${sessionKey}` : "—"} />
        <Stat label="Pilotos en sesión" value={sessionKey ? String(drivers.length) : "—"} />
      </div>

      {!sessionKey && (
        <div className="p-8 border border-dashed border-border text-muted-foreground text-sm">
          Selecciona una temporada, un Gran Premio y una sesión para activar los módulos.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
        {MODULES.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="group bg-background hover:bg-surface p-8 transition-colors relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="font-mono text-xs text-muted-foreground tracking-widest">{m.n}</span>
              <span className="font-mono text-xs text-racing opacity-0 group-hover:opacity-100 transition-opacity">
                ABRIR →
              </span>
            </div>
            <h3 className="font-display text-3xl mb-3 group-hover:text-racing transition-colors">
              {m.title.toUpperCase()}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
            <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-racing group-hover:w-full transition-all duration-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-6">
      <div className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-2">
        {label}
      </div>
      <div className="font-display text-4xl">{value}</div>
    </div>
  );
}
