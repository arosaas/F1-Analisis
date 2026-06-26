import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/f1-hero-aston.avif";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "F1 Analytics — Análisis de Fórmula 1 en tiempo real" },
      { name: "description", content: "Panel open-source para analizar telemetría, ritmo de carrera, estrategia de neumáticos, posiciones y mapas de velocidad de F1." },
      { property: "og:title", content: "F1 Analytics — Análisis de Fórmula 1 en tiempo real" },
      { property: "og:description", content: "Telemetría, ritmo de carrera y estrategia de neumáticos en un panel open-source." },
    ],
  }),
  component: Landing,
});

const REPO_URL = "https://github.com/arosaas/F1-Analisis";

const MODULES = [
  { n: "01", title: "Clasificación", to: "/panel/clasificacion", desc: "Comparativa de telemetría entre dos pilotos en su vuelta más rápida: velocidad, acelerador, freno y marcha." },
  { n: "02", title: "Ritmo de Carrera", to: "/panel/ritmo", desc: "Evolución del tiempo de vuelta y ritmo medio sobre vueltas limpias para cada piloto." },
  { n: "03", title: "Estrategia de Neumáticos", to: "/panel/neumaticos", desc: "Stints por piloto y compuestos utilizados a lo largo de la sesión." },
  { n: "04", title: "Posiciones en Carrera", to: "/panel/posiciones", desc: "Posición de cada piloto al final de cada vuelta para ver adelantamientos y paradas." },
  { n: "05", title: "Mapa de Velocidad", to: "/panel/mapa", desc: "Trazado del circuito coloreado por velocidad en cada punto de la vuelta más rápida." },
  { n: "06", title: "Pilotos", to: "/panel/pilotos", desc: "Clasificación del campeonato de pilotos de la temporada seleccionada." },
  { n: "07", title: "Equipos", to: "/panel/equipos", desc: "Clasificación del campeonato de constructores con barras de progreso." },
];

const STACK = [
  { name: "React", role: "UI" },
  { name: "TanStack", role: "Router" },
  { name: "FastF1", role: "Telemetría" },
  { name: "FastAPI", role: "Backend" },
  { name: "Recharts", role: "Gráficos" },
  { name: "Tailwind", role: "Estilos" },
];


function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Telemetry />
      <Modules />
      <Architecture />
      <Stack />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-racing shadow-racing" />
          <span className="font-display text-xl tracking-wider">F1 ANALYTICS</span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#modules" className="hover:text-foreground transition-colors">Módulos</a>
          <a href="#architecture" className="hover:text-foreground transition-colors">Arquitectura</a>
          <a href="#stack" className="hover:text-foreground transition-colors">Stack</a>
        </nav>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 text-sm font-medium bg-racing text-racing-foreground hover:opacity-90 transition-opacity"
        >
          Ver en GitHub →
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative min-h-screen pt-16 overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImg}
          alt="Aston Martin F1 en pista"
          width={1920}
          height={1280}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 gradient-hero-overlay" />
        <div className="absolute inset-0 grid-bg opacity-40" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-24 md:pt-32 pb-20">
        <h1 className="font-display text-[12vw] md:text-[8rem] leading-[1] tracking-tight">
          ANÁLISIS
          <br />
          <span className="text-racing">DE FÓRMULA 1</span>
          <br />
          SIN FILTROS.
        </h1>

        <p className="mt-8 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
          Panel para diseccionar telemetría, estrategia de neumáticos, ritmo de
          carrera y mapas de velocidad de cada Gran Premio. Datos servidos en
          local por un backend{" "}
          <span className="text-foreground font-mono text-base">FastAPI</span> sobre{" "}
          <span className="text-foreground font-mono text-base">FastF1</span>.
        </p>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            to="/panel"
            className="group inline-flex items-center gap-3 px-7 py-4 bg-racing text-racing-foreground font-medium tracking-wide shadow-racing hover:translate-y-[-2px] transition-transform"
          >
            ABRIR PANEL
            <span className="font-mono text-sm group-hover:translate-x-1 transition-transform">→</span>
          </Link>
          <a
            href="#modules"
            className="inline-flex items-center gap-3 px-7 py-4 border border-border hover:border-racing transition-colors font-medium tracking-wide"
          >
            VER MÓDULOS
          </a>
        </div>
      </div>
    </section>
  );
}

function Telemetry() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-6 font-mono text-xs">
        {[
          ["SECTOR 1", "24.812s"],
          ["SECTOR 2", "31.405s"],
          ["SECTOR 3", "22.197s"],
          ["TOP SPEED", "337 km/h"],
          ["TYRE", "C3 SOFT"],
          ["GAP", "+0.043"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center gap-3">
            <span className="text-muted-foreground tracking-widest">{k}</span>
            <span className="text-racing font-semibold">{v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Modules() {
  return (
    <section id="modules" className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-16">
          <div>
            <div className="font-mono text-xs tracking-[0.3em] text-racing uppercase mb-4">
              // 7 módulos
            </div>
            <h2 className="font-display text-6xl md:text-7xl max-w-2xl">
              CADA <span className="text-racing">DATO</span><br />
              EN SU SITIO.
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {MODULES.map((m) => (
            <Link
              key={m.n}
              to={m.to}
              className="group bg-background hover:bg-surface p-8 transition-colors relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-6">
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

          <a
            href="mailto:alejandrorosasarabia@gmail.com?subject=Contacto%20F1%20Analytics"
            className="group bg-background hover:bg-surface p-8 flex flex-col justify-between checker-bg transition-colors relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-6">
              <span className="font-mono text-xs text-muted-foreground tracking-widest">+ CONTACTO</span>
              <span className="font-mono text-xs text-racing opacity-0 group-hover:opacity-100 transition-opacity">
                ESCRIBIR →
              </span>
            </div>
            <div>
              <h3 className="font-display text-3xl mb-3 group-hover:text-racing transition-colors">CONTACTO</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ¿Sugerencias, bugs o ideas para nuevos módulos? Mándame un correo y lo charlamos.
              </p>
              <p className="mt-4 font-mono text-xs text-foreground">alejandrorosasarabia@gmail.com</p>
            </div>
            <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-racing group-hover:w-full transition-all duration-500" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Architecture() {
  const layers = [
    { tag: "backend/", title: "Acceso a datos", desc: "FastAPI + FastF1: descarga sesiones, gestiona la caché en ./cache y expone endpoints JSON." },
    { tag: "src/lib/", title: "Transformación", desc: "TypeScript puro: convierte datos crudos en tablas y series listas para graficar." },
    { tag: "src/routes/", title: "Interacción", desc: "React + TanStack Router. Se encarga del renderizado y los controles de usuario." },
  ];
  return (
    <section id="architecture" className="py-32 bg-surface border-y border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="font-mono text-xs tracking-[0.3em] text-racing uppercase mb-4">
          // arquitectura
        </div>
        <h2 className="font-display text-6xl md:text-7xl mb-16 max-w-3xl">
          TRES CAPAS.<br />
          <span className="text-racing">CERO ACOPLAMIENTO.</span>
        </h2>

        <div className="grid lg:grid-cols-3 gap-px bg-border">
          {layers.map((l, i) => (
            <div key={l.tag} className="bg-background p-10 relative">
              <div className="font-display text-7xl text-racing/20 absolute top-6 right-8">
                0{i + 1}
              </div>
              <div className="font-mono text-sm text-racing mb-6">{l.tag}</div>
              <h3 className="font-display text-3xl mb-4">{l.title.toUpperCase()}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{l.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 p-8 bg-background border border-border font-mono text-xs md:text-sm leading-relaxed overflow-x-auto">
          <pre className="text-muted-foreground">
{`f1_analytics/
├── backend/
│   ├── app.py                      # FastAPI + FastF1 (endpoints JSON)
│   └── requirements.txt
├── src/
│   ├── lib/
│   │   ├── openf1.ts               # Cliente HTTP -> backend FastF1
│   │   ├── ergast.ts               # Standings
│   │   └── analysis.ts             # Transformación de datos
│   └── routes/
│       ├── panel.clasificacion.tsx
│       ├── panel.ritmo.tsx
│       ├── panel.neumaticos.tsx
│       ├── panel.posiciones.tsx
│       ├── panel.mapa.tsx
│       ├── panel.pilotos.tsx
│       └── panel.equipos.tsx
├── cache/                          # Caché local de FastF1
└── start.sh / start.bat            # Lanza backend + frontend`}
          </pre>
        </div>
      </div>
    </section>
  );
}

function Stack() {
  return (
    <section id="stack" className="py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="font-mono text-xs tracking-[0.3em] text-racing uppercase mb-4">
          // stack técnico
        </div>
        <h2 className="font-display text-6xl md:text-7xl mb-16">
          CONSTRUIDO CON<br />
          <span className="text-racing">HERRAMIENTAS RÁPIDAS.</span>
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-border">
          {STACK.map((s) => (
            <div key={s.name} className="bg-background p-6 hover:bg-surface transition-colors">
              <div className="font-display text-2xl mb-1">{s.name.toUpperCase()}</div>
              <div className="font-mono text-xs text-muted-foreground tracking-widest">{s.role}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 checker-bg opacity-30" />
      <div className="relative max-w-5xl mx-auto px-6 text-center">
        <h2 className="font-display text-6xl md:text-8xl mb-8 leading-none">
          LISTO PARA<br />
          <span className="text-racing">EL SEMÁFORO VERDE.</span>
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
          Clona el repositorio, ejecuta <span className="font-mono text-foreground">./start.sh</span> y
          empieza a explorar la temporada que quieras.
        </p>

        <div className="inline-block text-left bg-background border border-border p-6 font-mono text-sm mb-12">
          <div className="text-muted-foreground"># 1. Clonar el repositorio</div>
          <div className="text-foreground">git clone {REPO_URL}.git</div>
          <div className="text-muted-foreground mt-4"># 2. Lanzar backend (FastF1) + frontend</div>
          <div className="text-racing">./start.sh</div>
          <div className="text-muted-foreground mt-1"># Windows:</div>
          <div className="text-racing">start.bat</div>
        </div>

        <div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-racing text-racing-foreground font-medium tracking-wide shadow-racing hover:translate-y-[-2px] transition-transform"
          >
            IR AL REPOSITORIO ↗
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-12 bg-surface">
      <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-racing" />
          <span className="font-display text-lg tracking-wider">F1 ANALYTICS</span>
          <span className="font-mono text-xs text-muted-foreground">v1.0</span>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          Hecho con FastF1 · Datos no afiliados a la FIA / Formula 1
        </div>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-muted-foreground hover:text-racing transition-colors"
        >
          github.com/arosaas/F1-Analisis ↗
        </a>
      </div>
    </footer>
  );
}
