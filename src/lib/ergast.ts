// Clasificaciones del campeonato.
// Por defecto vía el backend local (FastF1 -> Ergast). Sobreescribible con VITE_ERGAST_BASE.
const BASE = (import.meta.env.VITE_ERGAST_BASE as string | undefined) ?? "http://localhost:8000/ergast/f1";

export interface DriverStanding {
  position: string;
  points: string;
  wins: string;
  Driver: { driverId: string; givenName: string; familyName: string; code?: string; nationality: string };
  Constructors: { constructorId: string; name: string }[];
}

export interface ConstructorStanding {
  position: string;
  points: string;
  wins: string;
  Constructor: { constructorId: string; name: string; nationality: string };
}

export async function driverStandings(year: number): Promise<DriverStanding[]> {
  const res = await fetch(`${BASE}/${year}/driverstandings.json`);
  if (!res.ok) throw new Error(`Ergast drivers ${res.status}`);
  const json = await res.json();
  return json?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
}

export async function constructorStandings(year: number): Promise<ConstructorStanding[]> {
  const res = await fetch(`${BASE}/${year}/constructorstandings.json`);
  if (!res.ok) throw new Error(`Ergast constructors ${res.status}`);
  const json = await res.json();
  return json?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
}
