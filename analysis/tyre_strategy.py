"""
analysis/tyre_strategy.py

Lógica de análisis de estrategia de neumáticos:
- Reconstrucción de stints (qué compuesto, cuántas vueltas) por piloto
- Datos listos para un gráfico de Gantt de estrategia
- Degradación: tiempo de vuelta medio según el "TyreLife" (vueltas en el neumático)
"""

from __future__ import annotations

import pandas as pd
from fastf1.core import Session


def build_stints_table(session: Session, driver_codes: list[str]) -> pd.DataFrame:
    """
    Devuelve una tabla con un registro por (piloto, stint, compuesto):
    número de vueltas, vuelta de inicio y de fin. Ideal para un Gantt
    horizontal de estrategia de paradas.
    """
    laps = session.laps.pick_drivers(driver_codes)
    if laps.empty:
        return pd.DataFrame(columns=[
            "Driver", "Stint", "Compound", "StintLength", "StartLap", "EndLap",
        ])

    stints = laps[["Driver", "Stint", "Compound", "LapNumber"]].copy()

    grouped = (
        stints.groupby(["Driver", "Stint", "Compound"])
        .agg(StintLength=("LapNumber", "count"),
             StartLap=("LapNumber", "min"),
             EndLap=("LapNumber", "max"))
        .reset_index()
        .sort_values(["Driver", "Stint"])
        .reset_index(drop=True)
    )
    return grouped


def build_degradation_table(session: Session, driver_code: str) -> pd.DataFrame:
    """
    Para un piloto, agrupa las vueltas "limpias" (sin entradas/salidas de
    boxes) por compuesto y vida del neumático (TyreLife), calculando el
    tiempo de vuelta medio. Esto permite visualizar la degradación: cómo
    aumenta el tiempo de vuelta a medida que el neumático envejece.
    """
    laps = session.laps.pick_drivers(driver_code)
    quick = laps.pick_quicklaps()
    quick = quick[quick["LapTime"].notna()].copy()

    if quick.empty:
        return pd.DataFrame(columns=["Compound", "TyreLife", "LapTimeSeconds"])

    quick["LapTimeSeconds"] = quick["LapTime"].dt.total_seconds()

    degradation = (
        quick.groupby(["Compound", "TyreLife"])["LapTimeSeconds"]
        .mean()
        .reset_index()
        .sort_values(["Compound", "TyreLife"])
        .reset_index(drop=True)
    )
    return degradation


def get_compound_usage_summary(session: Session) -> pd.DataFrame:
    """
    Resumen global de la sesión: cuántas vueltas se corrieron en total
    con cada compuesto, considerando a todos los pilotos. Útil para dar
    contexto sobre qué neumático dominó la carrera.
    """
    laps = session.laps
    laps = laps[laps["Compound"].notna()]
    summary = (
        laps.groupby("Compound")["LapNumber"]
        .count()
        .reset_index()
        .rename(columns={"LapNumber": "TotalLaps"})
        .sort_values("TotalLaps", ascending=False)
        .reset_index(drop=True)
    )
    return summary
