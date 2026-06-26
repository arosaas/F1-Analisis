import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { openf1 } from "@/lib/openf1";

type State = {
  year: number;
  meetingKey: number | null;
  sessionKey: number | null;
};

type Ctx = State & {
  setYear: (y: number) => void;
  setMeetingKey: (k: number | null) => void;
  setSessionKey: (k: number | null) => void;
};

const KEY = "f1a:session";
const SessionCtx = createContext<Ctx | null>(null);

const CURRENT_YEAR = 2026;
export const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    year: CURRENT_YEAR,
    meetingKey: null,
    sessionKey: null,
  });

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      if (raw) setState(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  return (
    <SessionCtx.Provider
      value={{
        ...state,
        setYear: (year) => setState({ year, meetingKey: null, sessionKey: null }),
        setMeetingKey: (meetingKey) => setState((s) => ({ ...s, meetingKey, sessionKey: null })),
        setSessionKey: (sessionKey) => setState((s) => ({ ...s, sessionKey })),
      }}
    >
      {children}
    </SessionCtx.Provider>
  );
}

export function useSessionState() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("SessionProvider missing");
  return ctx;
}

export function SessionPicker() {
  const { year, meetingKey, sessionKey, setYear, setMeetingKey, setSessionKey } = useSessionState();

  const meetingsQ = useQuery({
    queryKey: ["meetings", year],
    queryFn: () => openf1.meetings(year),
    staleTime: 60 * 60 * 1000,
  });

  const sessionsQ = useQuery({
    queryKey: ["sessions", meetingKey],
    queryFn: () => openf1.sessions(meetingKey!),
    enabled: !!meetingKey,
    staleTime: 60 * 60 * 1000,
  });

  const meetings = (meetingsQ.data ?? []).slice().sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime(),
  );
  const sessions = (sessionsQ.data ?? []).slice().sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime(),
  );

  return (
    <div className="bg-surface border border-border">
      <div className="px-6 py-3 border-b border-border flex items-center justify-between">
        <span className="font-mono text-xs tracking-[0.3em] text-racing uppercase">
          // sesión activa
        </span>
        {sessionKey && (
          <span className="font-mono text-xs text-muted-foreground">
            session_key: <span className="text-foreground">{sessionKey}</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
        <Field label="Temporada">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="picker"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Field>
        <Field label={`Gran Premio ${meetingsQ.isLoading ? "(cargando…)" : `(${meetings.length})`}`}>
          <select
            value={meetingKey ?? ""}
            onChange={(e) => setMeetingKey(e.target.value ? Number(e.target.value) : null)}
            className="picker"
            disabled={!meetings.length}
          >
            <option value="">Selecciona…</option>
            {meetings.map((m) => (
              <option key={m.meeting_key} value={m.meeting_key}>
                {m.meeting_name} — {m.country_code}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Sesión ${sessionsQ.isLoading ? "(cargando…)" : `(${sessions.length})`}`}>
          <select
            value={sessionKey ?? ""}
            onChange={(e) => setSessionKey(e.target.value ? Number(e.target.value) : null)}
            className="picker"
            disabled={!sessions.length}
          >
            <option value="">Selecciona…</option>
            {sessions.map((s) => (
              <option key={s.session_key} value={s.session_key}>
                {s.session_name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <style>{`
        .picker {
          width: 100%;
          background: transparent;
          color: var(--foreground);
          padding: 14px 16px;
          font-family: var(--font-mono);
          font-size: 14px;
          border: 0;
          outline: none;
          appearance: none;
          cursor: pointer;
        }
        .picker:disabled { opacity: 0.5; cursor: not-allowed; }
        .picker option { background: var(--surface); color: var(--foreground); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="bg-background flex flex-col">
      <span className="px-4 pt-3 font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
