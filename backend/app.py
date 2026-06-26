"""
F1 Analytics — Backend FastAPI + FastF1.

Expone los mismos endpoints que consume el frontend (compatibles en forma con
la API pública de OpenF1) pero los datos se obtienen vía FastF1, con caché
local en ./cache. Replica también las llamadas de standings (driverstandings /
constructorstandings) usando el módulo fastf1.ergast.

Ejecutar:
    python -m pip install -r backend/requirements.txt
    python -m uvicorn backend.app:app --reload --port 8000
"""
from __future__ import annotations

import math
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

import fastf1
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastf1.ergast import Ergast

# ---------- Cache ----------
CACHE_DIR = Path(os.environ.get("FASTF1_CACHE", "./cache")).resolve()
CACHE_DIR.mkdir(parents=True, exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))

app = FastAPI(title="F1 Analytics — FastF1 backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Mapeo de claves sintéticas ----------
# OpenF1 usa meeting_key y session_key numéricos. Sintetizamos:
#   meeting_key  = year * 100 + round_number
#   session_key  = meeting_key * 10 + session_index (1..5)
SESSION_NAMES = {
    "Practice 1": "Practice 1",
    "Practice 2": "Practice 2",
    "Practice 3": "Practice 3",
    "Sprint Qualifying": "Sprint Qualifying",
    "Sprint Shootout": "Sprint Shootout",
    "Sprint": "Sprint",
    "Qualifying": "Qualifying",
    "Race": "Race",
}


def split_session_key(session_key: int) -> tuple[int, int, int]:
    """session_key -> (year, round, session_index)."""
    meeting_key = session_key // 10
    session_index = session_key % 10
    year = meeting_key // 100
    round_number = meeting_key % 100
    return year, round_number, session_index


def split_meeting_key(meeting_key: int) -> tuple[int, int]:
    return meeting_key // 100, meeting_key % 100


def make_meeting_key(year: int, round_number: int) -> int:
    return year * 100 + round_number


def make_session_key(year: int, round_number: int, session_index: int) -> int:
    return make_meeting_key(year, round_number) * 10 + session_index


# ---------- Carga de sesiones (cacheada en memoria) ----------
@lru_cache(maxsize=64)
def get_schedule(year: int) -> pd.DataFrame:
    return fastf1.get_event_schedule(year, include_testing=False)


@lru_cache(maxsize=16)
def load_session_cached(year: int, round_number: int, session_index: int):
    schedule = get_schedule(year)
    row = schedule[schedule["RoundNumber"] == round_number]
    if row.empty:
        raise HTTPException(404, f"Round {round_number} no encontrado en {year}")
    session_name = row.iloc[0].get(f"Session{session_index}")
    if not session_name or (isinstance(session_name, float) and math.isnan(session_name)):
        raise HTTPException(404, f"Session{session_index} no existe en este meeting")
    session = fastf1.get_session(year, round_number, session_name)
    session.load(telemetry=True, laps=True, weather=False, messages=False)
    return session


def _iso(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return pd.Timestamp(value).isoformat()


def _secs(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, pd.Timedelta):
        return value.total_seconds()
    try:
        return float(value)
    except Exception:
        return None


def _clean(value: Any) -> Any:
    """Convierte NaN/NaT en None y numpy types en built-ins."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if isinstance(value, np.generic):
        return value.item()
    return value


# ---------- Endpoints ----------
@app.get("/v1/meetings")
def meetings(year: int = Query(...)) -> list[dict]:
    schedule = get_schedule(year)
    out = []
    for _, row in schedule.iterrows():
        round_number = int(row["RoundNumber"])
        date_start = row.get("Session1Date") or row.get("EventDate")
        out.append({
            "meeting_key": make_meeting_key(year, round_number),
            "meeting_name": row.get("EventName"),
            "meeting_official_name": row.get("OfficialEventName") or row.get("EventName"),
            "country_name": row.get("Country"),
            "country_code": (row.get("Country") or "")[:3].upper(),
            "circuit_short_name": row.get("Location"),
            "date_start": _iso(date_start),
            "year": year,
        })
    return out


@app.get("/v1/sessions")
def sessions(meeting_key: int = Query(...)) -> list[dict]:
    year, round_number = split_meeting_key(meeting_key)
    schedule = get_schedule(year)
    row = schedule[schedule["RoundNumber"] == round_number]
    if row.empty:
        raise HTTPException(404, "meeting no encontrado")
    row = row.iloc[0]
    out = []
    for i in range(1, 6):
        name = row.get(f"Session{i}")
        if not name or (isinstance(name, float) and math.isnan(name)):
            continue
        date_start = row.get(f"Session{i}DateUtc") or row.get(f"Session{i}Date")
        out.append({
            "session_key": make_session_key(year, round_number, i),
            "session_name": name,
            "session_type": name,
            "meeting_key": meeting_key,
            "date_start": _iso(date_start),
            "date_end": _iso(date_start),
            "year": year,
            "country_name": row.get("Country"),
            "circuit_short_name": row.get("Location"),
        })
    return out


@app.get("/v1/drivers")
def drivers(session_key: int = Query(...)) -> list[dict]:
    year, round_number, session_index = split_session_key(session_key)
    session = load_session_cached(year, round_number, session_index)
    results = session.results
    out = []
    seen = set()
    for _, r in results.iterrows():
        try:
            num = int(r["DriverNumber"])
        except Exception:
            continue
        if num in seen:
            continue
        seen.add(num)
        colour = r.get("TeamColor") or ""
        out.append({
            "driver_number": num,
            "full_name": r.get("FullName") or f"{r.get('FirstName','')} {r.get('LastName','')}".strip(),
            "name_acronym": r.get("Abbreviation"),
            "team_name": r.get("TeamName"),
            "team_colour": str(colour).lstrip("#"),
            "headshot_url": r.get("HeadshotUrl") or None,
            "country_code": r.get("CountryCode") or None,
            "session_key": session_key,
        })
    return out


@app.get("/v1/laps")
def laps(session_key: int = Query(...), driver_number: int | None = None) -> list[dict]:
    year, round_number, session_index = split_session_key(session_key)
    session = load_session_cached(year, round_number, session_index)
    laps_df = session.laps
    if driver_number is not None:
        laps_df = laps_df[laps_df["DriverNumber"] == str(driver_number)]
    out = []
    for _, l in laps_df.iterrows():
        try:
            dn = int(l["DriverNumber"])
        except Exception:
            continue
        out.append({
            "driver_number": dn,
            "lap_number": int(l["LapNumber"]) if not pd.isna(l["LapNumber"]) else None,
            "lap_duration": _secs(l.get("LapTime")),
            "duration_sector_1": _secs(l.get("Sector1Time")),
            "duration_sector_2": _secs(l.get("Sector2Time")),
            "duration_sector_3": _secs(l.get("Sector3Time")),
            "date_start": _iso(l.get("LapStartDate")),
            "is_pit_out_lap": bool(not pd.isna(l.get("PitOutTime"))),
            "st_speed": _clean(l.get("SpeedST")),
            "session_key": session_key,
        })
    return out


@app.get("/v1/stints")
def stints(session_key: int = Query(...)) -> list[dict]:
    year, round_number, session_index = split_session_key(session_key)
    session = load_session_cached(year, round_number, session_index)
    laps_df = session.laps.copy()
    if laps_df.empty:
        return []
    laps_df["DriverNumber"] = laps_df["DriverNumber"].astype(str)
    out = []
    for drv, drv_laps in laps_df.groupby("DriverNumber"):
        drv_laps = drv_laps.sort_values("LapNumber")
        # Agrupa por Stint
        for stint_num, st in drv_laps.groupby("Stint"):
            if pd.isna(stint_num):
                continue
            compound = st["Compound"].dropna().iloc[0] if not st["Compound"].dropna().empty else "UNKNOWN"
            lap_start = int(st["LapNumber"].min())
            lap_end = int(st["LapNumber"].max())
            tyre_age_start = st["TyreLife"].min()
            try:
                tyre_age_start = int(tyre_age_start) if not pd.isna(tyre_age_start) else 0
            except Exception:
                tyre_age_start = 0
            try:
                drv_int = int(drv)
            except Exception:
                continue
            out.append({
                "driver_number": drv_int,
                "stint_number": int(stint_num),
                "lap_start": lap_start,
                "lap_end": lap_end,
                "compound": str(compound).upper(),
                "tyre_age_at_start": tyre_age_start,
                "session_key": session_key,
            })
    return out


@app.get("/v1/position")
def position(session_key: int = Query(...)) -> list[dict]:
    year, round_number, session_index = split_session_key(session_key)
    session = load_session_cached(year, round_number, session_index)
    laps_df = session.laps
    out = []
    for _, l in laps_df.iterrows():
        try:
            dn = int(l["DriverNumber"])
            pos = int(l["Position"]) if not pd.isna(l["Position"]) else None
        except Exception:
            continue
        if pos is None:
            continue
        # OpenF1 fecha de posición ≈ fin de la vuelta
        date_end = None
        if not pd.isna(l.get("LapStartDate")) and not pd.isna(l.get("LapTime")):
            date_end = (l["LapStartDate"] + l["LapTime"]).isoformat()
        elif not pd.isna(l.get("LapStartDate")):
            date_end = l["LapStartDate"].isoformat()
        out.append({
            "date": date_end,
            "driver_number": dn,
            "position": pos,
            "session_key": session_key,
        })
    return out


def _filter_by_date(df: pd.DataFrame, date_col: str, gte: str | None, lte: str | None) -> pd.DataFrame:
    if df.empty:
        return df
    if gte:
        df = df[df[date_col] >= pd.Timestamp(gte)]
    if lte:
        df = df[df[date_col] <= pd.Timestamp(lte)]
    return df


@app.get("/v1/car_data")
def car_data(
    session_key: int = Query(...),
    driver_number: int = Query(...),
    date_gte: str | None = Query(None, alias="date>="),
    date_lte: str | None = Query(None, alias="date<="),
) -> list[dict]:
    year, round_number, session_index = split_session_key(session_key)
    session = load_session_cached(year, round_number, session_index)
    car = session.car_data.get(str(driver_number))
    if car is None or car.empty:
        return []
    df = car.copy()
    if "Date" not in df.columns:
        df["Date"] = session.t0_date + df["Time"]
    df = _filter_by_date(df, "Date", date_gte, date_lte)
    out = []
    for _, r in df.iterrows():
        out.append({
            "date": r["Date"].isoformat(),
            "driver_number": driver_number,
            "speed": _clean(r.get("Speed")),
            "throttle": _clean(r.get("Throttle")),
            "brake": int(bool(r.get("Brake"))) * 100,
            "n_gear": _clean(r.get("nGear")),
            "rpm": _clean(r.get("RPM")),
            "drs": _clean(r.get("DRS")),
        })
    return out


@app.get("/v1/location")
def location(
    session_key: int = Query(...),
    driver_number: int = Query(...),
    date_gte: str | None = Query(None, alias="date>="),
    date_lte: str | None = Query(None, alias="date<="),
) -> list[dict]:
    year, round_number, session_index = split_session_key(session_key)
    session = load_session_cached(year, round_number, session_index)
    pos = session.pos_data.get(str(driver_number))
    if pos is None or pos.empty:
        return []
    df = pos.copy()
    if "Date" not in df.columns:
        df["Date"] = session.t0_date + df["Time"]
    df = _filter_by_date(df, "Date", date_gte, date_lte)
    out = []
    for _, r in df.iterrows():
        out.append({
            "date": r["Date"].isoformat(),
            "driver_number": driver_number,
            "x": _clean(r.get("X")),
            "y": _clean(r.get("Y")),
            "z": _clean(r.get("Z")),
        })
    return out


# ---------- Standings (compatibles con Jolpica/Ergast) ----------
@lru_cache(maxsize=8)
def _ergast() -> Ergast:
    return Ergast()


def _ergast_standings(year: int, kind: str) -> dict:
    erg = _ergast()
    if kind == "drivers":
        resp = erg.get_driver_standings(season=year)
    else:
        resp = erg.get_constructor_standings(season=year)
    content = resp.content
    if not content:
        return {"MRData": {"StandingsTable": {"StandingsLists": []}}}
    df = content[0]
    items = []
    for _, r in df.iterrows():
        if kind == "drivers":
            items.append({
                "position": str(r.get("position")),
                "points": str(r.get("points")),
                "wins": str(r.get("wins")),
                "Driver": {
                    "driverId": r.get("driverId"),
                    "givenName": r.get("givenName"),
                    "familyName": r.get("familyName"),
                    "code": r.get("driverCode"),
                    "nationality": r.get("driverNationality"),
                },
                "Constructors": [{
                    "constructorId": r.get("constructorIds")[0] if r.get("constructorIds") else "",
                    "name": r.get("constructorNames")[0] if r.get("constructorNames") else "",
                }],
            })
        else:
            items.append({
                "position": str(r.get("position")),
                "points": str(r.get("points")),
                "wins": str(r.get("wins")),
                "Constructor": {
                    "constructorId": r.get("constructorId"),
                    "name": r.get("constructorName"),
                    "nationality": r.get("constructorNationality"),
                },
            })
    key = "DriverStandings" if kind == "drivers" else "ConstructorStandings"
    return {"MRData": {"StandingsTable": {"StandingsLists": [{key: items}]}}}


@app.get("/ergast/f1/{year}/driverstandings.json")
def driver_standings(year: int) -> dict:
    return _ergast_standings(year, "drivers")


@app.get("/ergast/f1/{year}/constructorstandings.json")
def constructor_standings(year: int) -> dict:
    return _ergast_standings(year, "constructors")


@app.get("/")
def root() -> dict:
    return {"service": "F1 Analytics FastF1 backend", "cache": str(CACHE_DIR)}
