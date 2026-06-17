"""
analysis/race_pace.py

Lógica de análisis de ritmo de carrera:
- Evolución del tiempo de vuelta a lo largo de la carrera para uno o varios pilotos
- Comparativa de ritmo medio entre pilotos (vueltas "limpias", sin tráfico/pits)
"""

from __future__ import annotations

import pandas as pd
from fastf1.core import Session


def get_driver_race_laps(session: Session, driver_code: str) -> pd.DataFrame:
    """
    Devuelve las vueltas de carrera de un piloto con el tiempo de vuelta
    en segundos (más fácil de graficar que un Timedelta), excluyendo
    vueltas sin tiempo registrado (entradas/salidas de boxes, abandonos).
    """
    laps = session.laps.pick_drivers(driver_code).copy()
    laps = laps[laps["LapTime"].notna()]
    laps["LapTimeSeconds"] = laps["LapTime"].dt.total_seconds()
    return laps[[
        "LapNumber", "LapTimeSeconds", "Compound", "TyreLife",
        "Stint", "PitInTime", "PitOutTime", "IsPersonalBest",
    ]].reset_index(drop=True)


def get_quicklaps_only(session: Session, driver_code: str, threshold: float = 1.07) -> pd.DataFrame:
    """
    Devuelve solo las vueltas "representativas" del ritmo real (excluye
    vueltas de entrada/salida de boxes y vueltas anormalmente lentas,
    p. ej. por tráfico, banderas amarillas o un Safety Car).

    `threshold` sigue la convención de FastF1: una vuelta se considera
    "rápida" si su tiempo está por debajo de threshold * vuelta más rápida
    del piloto en esa sesión.
    """
    laps = session.laps.pick_drivers(driver_code)
    quick = laps.pick_quicklaps(threshold)
    quick = quick[quick["LapTime"].notna()].copy()
    quick["LapTimeSeconds"] = quick["LapTime"].dt.total_seconds()
    return quick.reset_index(drop=True)


def build_race_pace_comparison(session: Session, driver_codes: list[str]) -> pd.DataFrame:
    """
    Construye un DataFrame "largo" (long-format) con LapNumber,
    LapTimeSeconds y Driver para varios pilotos, listo para graficar
    líneas comparativas de ritmo de carrera.
    """
    frames = []
    for code in driver_codes:
        df = get_driver_race_laps(session, code)
        if df.empty:
            continue
        df = df.copy()
        df["Driver"] = code
        frames.append(df)

    if not frames:
        return pd.DataFrame(columns=["LapNumber", "LapTimeSeconds", "Driver"])

    return pd.concat(frames, ignore_index=True)


def summarize_average_pace(session: Session, driver_codes: list[str]) -> pd.DataFrame:
    """
    Devuelve un resumen de ritmo medio (solo vueltas rápidas/representativas)
    por piloto: media, mediana, mejor vuelta y desviación estándar.
    """
    rows = []
    for code in driver_codes:
        quick = get_quicklaps_only(session, code)
        if quick.empty:
            continue
        rows.append({
            "Piloto": code,
            "Vueltas consideradas": len(quick),
            "Media (s)": round(quick["LapTimeSeconds"].mean(), 3),
            "Mediana (s)": round(quick["LapTimeSeconds"].median(), 3),
            "Mejor vuelta (s)": round(quick["LapTimeSeconds"].min(), 3),
            "Desv. estándar (s)": round(quick["LapTimeSeconds"].std(), 3),
        })

    return pd.DataFrame(rows).sort_values("Media (s)").reset_index(drop=True)
