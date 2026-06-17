"""
analysis/season_overview.py

Lógica de análisis a nivel de temporada para las páginas de "Pilotos" y
"Equipos": clasificaciones y comparativas de ritmo entre compañeros de
equipo a lo largo de una carrera.

Este módulo combina datos de Ergast (clasificaciones, ligeras de
descargar) con datos de sesión de FastF1 (telemetría/vueltas, más
pesados) solo cuando es necesario.
"""

from __future__ import annotations

import pandas as pd
from fastf1.core import Session


def sort_standings_for_chart(standings: pd.DataFrame) -> pd.DataFrame:
    """
    Ordena la clasificación (pilotos o constructores) de menor a mayor
    número de puntos, listo para un gráfico de barras horizontal donde el
    primero del campeonato queda arriba.
    """
    if standings.empty:
        return standings
    return standings.sort_values("Puntos", ascending=True)


def get_teammate_pairs(drivers_df: pd.DataFrame) -> dict[str, list[str]]:
    """Agrupa los pilotos de una sesión por equipo, útil para comparar compañeros."""
    pairs: dict[str, list[str]] = {}
    for _, row in drivers_df.iterrows():
        team = row["TeamName"]
        pairs.setdefault(team, []).append(row["Abbreviation"])
    return pairs


def build_team_pace_table(session: Session, driver_codes: list[str]) -> pd.DataFrame:
    """
    Para cada piloto, recopila el tiempo de vuelta (en segundos) de todas
    sus vueltas representativas (sin tráfico/pits) junto con su equipo.
    Pensado para comparar el ritmo de todos los equipos en una misma
    carrera mediante un boxplot o violin plot.
    """
    laps = session.laps.pick_drivers(driver_codes).pick_quicklaps()
    laps = laps[laps["LapTime"].notna()].copy()
    if laps.empty:
        return pd.DataFrame(columns=["Driver", "Team", "LapTimeSeconds"])

    laps["LapTimeSeconds"] = laps["LapTime"].dt.total_seconds()
    return laps[["Driver", "Team", "LapTimeSeconds"]].reset_index(drop=True)


def order_teams_by_median_pace(pace_table: pd.DataFrame) -> list[str]:
    """Devuelve la lista de equipos ordenada por ritmo medio (más rápido primero)."""
    if pace_table.empty:
        return []
    medians = pace_table.groupby("Team")["LapTimeSeconds"].median().sort_values()
    return medians.index.tolist()
