import type { ReactNode } from "react";
import { useSessionState } from "@/components/session-picker";

export function PanelSection({
  title,
  subtitle,
  children,
  toolbar,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs tracking-[0.3em] text-racing uppercase mb-2">
            // módulo
          </div>
          <h1 className="font-display text-5xl md:text-6xl">{title.toUpperCase()}</h1>
          {subtitle && (
            <p className="mt-3 text-muted-foreground max-w-2xl">{subtitle}</p>
          )}
        </div>
        {toolbar}
      </div>
      {children}
    </section>
  );
}

export function RequireSession({
  children,
  needsRace = false,
}: {
  children: ReactNode;
  needsRace?: boolean;
}) {
  const { sessionKey } = useSessionState();
  if (!sessionKey) {
    return (
      <div className="p-8 border border-dashed border-border text-muted-foreground text-sm">
        Selecciona una sesión arriba para cargar los datos.
        {needsRace && " Este módulo está pensado para sesiones de tipo Race."}
      </div>
    );
  }
  return <>{children}</>;
}

export function Loading({ label = "Cargando datos…" }: { label?: string }) {
  return (
    <div className="p-12 border border-border bg-surface text-center">
      <div className="inline-flex items-center gap-3 font-mono text-xs text-muted-foreground tracking-widest">
        <span className="h-2 w-2 rounded-full bg-racing animate-pulse" />
        {label.toUpperCase()}
      </div>
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="p-8 border border-destructive/40 bg-destructive/10 text-sm">
      <div className="font-mono text-xs text-destructive tracking-widest mb-2">// error</div>
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="p-8 border border-dashed border-border text-sm text-muted-foreground">
      {children}
    </div>
  );
}
