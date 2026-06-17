"""
core/data_loader.py

Capa de acceso a datos sobre FastF1. Centraliza:
- Configuración de caché
- Carga de sesiones (Q, R, Sprint, Practice)
- Funciones de utilidad para listar pilotos, eventos y temporadas

Todas las páginas de Streamlit deben pasar por aquí en lugar de
llamar a fastf1 directamente, para mantener una única fuente de verdad
y poder cambiar de implementación sin tocar la UI.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import fastf1
import pandas as pd
import streamlit as st

# ---------------------------------------------------------------------------
# Configuración de caché de FastF1
# ---------------------------------------------------------------------------
# FastF1 descarga datos pesados (telemetría, vueltas, clima...) desde la API
# de F1. Activar la caché evita re-descargar lo mismo en cada rerun de
# Streamlit. Aun si el usuario no quiere preocuparse por la gestión manual
# de la caché, mantenerla activada por defecto evita una app inutilizable
# (Streamlit relanza el script en cada interacción).
CACHE_DIR = Path(__file__).resolve().parent.parent / ".fastf1_cache"
CACHE_DIR.mkdir(exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))


# Mapeo de tipos de sesión "amigables" -> identificador que espera FastF1
SESSION_TYPES = {
    "Clasificación": "Q",
    "Carrera": "R",
    "Sprint": "S",
    "Clasificación Sprint": "SQ",
    "Libres 1": "FP1",
    "Libres 2": "FP2",
    "Libres 3": "FP3",
}


@st.cache_data(show_spinner=False)
def get_available_seasons() -> list[int]:
    """Devuelve un rango razonable de temporadas soportadas por FastF1."""
    # FastF1 tiene datos de telemetría fiables desde 2018 en adelante.
    current_year = pd.Timestamp.now().year
    return list(range(current_year, 2017, -1))


@st.cache_data(show_spinner="Cargando calendario de la temporada...")
def get_event_schedule(year: int) -> pd.DataFrame:
    """Devuelve el calendario de Grandes Premios de una temporada."""
    schedule = fastf1.get_event_schedule(year, include_testing=False)
    return schedule[["RoundNumber", "EventName", "Location", "Country", "EventDate"]]


@st.cache_data(show_spinner="Cargando datos de la sesión... (puede tardar un poco)")
def load_session(year: int, gp: str, session_type: str) -> fastf1.core.Session:
    """
    Carga una sesión completa (vueltas, telemetría, resultados, clima).

    Parameters
    ----------
    year : int
        Temporada, p.ej. 2024
    gp : str
        Nombre o identificador del Gran Premio (acepta nombre, país o número de ronda)
    session_type : str
        Código de sesión: "Q", "R", "S", "SQ", "FP1", "FP2", "FP3"
    """
    session = fastf1.get_session(year, gp, session_type)
    session.load()
    return session


def get_drivers_in_session(session: fastf1.core.Session) -> pd.DataFrame:
    """
    Devuelve un DataFrame con los pilotos que participaron en la sesión,
    incluyendo código de 3 letras, nombre completo y equipo.
    """
    results = session.results[["Abbreviation", "FullName", "TeamName"]].copy()
    results = results.dropna(subset=["Abbreviation"]).reset_index(drop=True)
    return results


# Paleta de respaldo (solo se usa si fastf1.plotting no puede resolver un
# color, p. ej. equipos de test o datos muy antiguos). Evita que toda la
# app caiga en el mismo azul cuando algo falla: cada índice de fallback
# tiene un color distinto.
_FALLBACK_PALETTE = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
]


def get_driver_color(session: fastf1.core.Session, driver_code: str) -> str:
    """
    Devuelve el color oficial de equipo de un piloto para usar en gráficos.

    Usa la API moderna de fastf1.plotting (>=3.4): `session` se pasa como
    argumento posicional, no como keyword `session=`. Pasarlo como keyword
    en versiones recientes provoca un TypeError que quedaba silenciado por
    el `except Exception`, haciendo que TODOS los pilotos cayeran en el
    mismo color de fallback (de ahí que todo apareciera en azul oscuro).
    """
    try:
        return fastf1.plotting.get_driver_color(driver_code, session)
    except Exception:
        # Fallback determinista pero variado: distinto color por piloto
        # según su posición en la sesión, en vez de un único azul fijo.
        try:
            driver_codes = get_drivers_in_session(session)["Abbreviation"].tolist()
            idx = driver_codes.index(driver_code) if driver_code in driver_codes else 0
        except Exception:
            idx = 0
        return _FALLBACK_PALETTE[idx % len(_FALLBACK_PALETTE)]


def get_driver_style(session: fastf1.core.Session, driver_code: str, style: list[str] | None = None) -> dict:
    """
    Devuelve un dict de estilo de Matplotlib (color + linestyle/marker) único
    para un piloto, usando `fastf1.plotting.get_driver_style`. Esto permite
    distinguir a dos compañeros de equipo (mismo color) por trazo o marcador.
    """
    if style is None:
        style = ["color", "linestyle"]
    try:
        return fastf1.plotting.get_driver_style(identifier=driver_code, style=style, session=session)
    except Exception:
        return {"color": get_driver_color(session, driver_code)}


def get_team_color(session: fastf1.core.Session, team_name: str) -> str:
    """Devuelve el color oficial de un equipo."""
    try:
        return fastf1.plotting.get_team_color(team_name, session)
    except Exception:
        return "#1f77b4"


def get_driver_color_mapping(session: fastf1.core.Session) -> dict[str, str]:
    """Devuelve {abreviatura_piloto: color_hex} para todos los pilotos de la sesión."""
    try:
        return fastf1.plotting.get_driver_color_mapping(session)
    except Exception:
        drivers_df = get_drivers_in_session(session)
        return {
            code: get_driver_color(session, code)
            for code in drivers_df["Abbreviation"].tolist()
        }


def get_fastest_lap(session: fastf1.core.Session, driver_code: str):
    """Devuelve la vuelta más rápida de un piloto en la sesión dada."""
    driver_laps = session.laps.pick_drivers(driver_code)
    if driver_laps.empty:
        return None
    return driver_laps.pick_fastest()


# ---------------------------------------------------------------------------
# Datos de temporada (clasificaciones de pilotos y constructores) vía Ergast
# ---------------------------------------------------------------------------
@st.cache_data(show_spinner="Cargando clasificación de pilotos...")
def get_driver_standings(year: int) -> pd.DataFrame:
    """Clasificación de pilotos al final (o estado actual) de una temporada."""
    result = fastf1.ergast.Ergast().get_driver_standings(season=year)
    if not result.content:
        return pd.DataFrame()
    standings = result.content[0]
    standings = standings.copy()
    standings["FullName"] = standings["givenName"] + " " + standings["familyName"]
    return standings[[
        "position", "FullName", "constructorNames", "points", "wins", "driverCode",
    ]].rename(columns={
        "position": "Posición",
        "FullName": "Piloto",
        "constructorNames": "Equipo",
        "points": "Puntos",
        "wins": "Victorias",
        "driverCode": "Abbreviation",
    })


@st.cache_data(show_spinner="Cargando clasificación de constructores...")
def get_constructor_standings(year: int) -> pd.DataFrame:
    """Clasificación de constructores al final (o estado actual) de una temporada."""
    result = fastf1.ergast.Ergast().get_constructor_standings(season=year)
    if not result.content:
        return pd.DataFrame()
    standings = result.content[0]
    return standings[[
        "position", "constructorName", "points", "wins",
    ]].rename(columns={
        "position": "Posición",
        "constructorName": "Equipo",
        "points": "Puntos",
        "wins": "Victorias",
    })


@st.cache_data(show_spinner=False)
def get_season_results_summary(year: int) -> pd.DataFrame:
    """
    Devuelve, para cada ronda disputada de la temporada, el ganador y el
    equipo ganador. Útil para timelines y resúmenes rápidos de temporada.
    """
    result = fastf1.ergast.Ergast().get_race_results(season=year)
    if not result.content:
        return pd.DataFrame()

    rows = []
    description = result.description.reset_index(drop=True)
    for idx, race_table in enumerate(result.content):
        if race_table.empty:
            continue
        winner = race_table.iloc[0]
        race_info = description.iloc[idx]
        rows.append({
            "Ronda": race_info["round"],
            "GP": race_info["raceName"],
            "Ganador": f"{winner['givenName']} {winner['familyName']}",
            "Equipo": winner["constructorName"],
        })
    return pd.DataFrame(rows)
