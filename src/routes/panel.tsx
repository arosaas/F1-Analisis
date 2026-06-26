import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { SessionPicker, SessionProvider } from "@/components/session-picker";

export const Route = createFileRoute("/panel")({
  head: () => ({
    meta: [
      { title: "Panel — F1 Analytics" },
      { name: "description", content: "Telemetría, ritmo, neumáticos, posiciones, mapa de velocidad y campeonato en vivo." },
    ],
  }),
  component: PanelLayout,
});

const TABS = [
  { to: "/panel", label: "Resumen", end: true },
  { to: "/panel/clasificacion", label: "Clasificación" },
  { to: "/panel/ritmo", label: "Ritmo" },
  { to: "/panel/neumaticos", label: "Neumáticos" },
  { to: "/panel/posiciones", label: "Posiciones" },
  { to: "/panel/mapa", label: "Mapa" },
  { to: "/panel/pilotos", label: "Pilotos" },
  { to: "/panel/equipos", label: "Equipos" },
];

function PanelLayout() {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-background text-foreground">
        <PanelHeader />
        <div className="max-w-7xl mx-auto px-6 pt-28 pb-20 space-y-8">
          <SessionPicker />
          <Outlet />
        </div>
      </div>
    </SessionProvider>
  );
}

function PanelHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="h-3 w-3 rounded-full bg-racing shadow-racing" />
          <span className="font-display text-xl tracking-wider">F1 ANALYTICS</span>
        </Link>
        <nav className="flex-1 overflow-x-auto">
          <ul className="flex items-center gap-1 justify-end font-mono text-xs uppercase tracking-widest">
            {TABS.map((t) => {
              const active = t.end ? pathname === t.to : pathname.startsWith(t.to);
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    className={
                      "px-3 py-2 border-b-2 whitespace-nowrap transition-colors " +
                      (active
                        ? "border-racing text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground")
                    }
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
