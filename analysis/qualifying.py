"""
analysis/qualifying.py

Lógica de análisis para comparar la vuelta rápida de dos pilotos:
- Telemetría completa (velocidad, throttle, brake, marcha, RPM, DRS)
- Delta de tiempo acumulado entre ambos a lo largo de la vuelta
- Resumen de sectores

Este módulo NO dibuja nada ni usa Streamlit: solo transforma datos.
La responsabilidad de renderizar vive en pages/1_Clasificacion.py.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from fastf1.core import Lap, Session


@dataclass
class DriverLapTelemetry:
    """Contenedor con la telemetría procesada de un piloto para una vuelta."""

    driver_code: str
    lap: Lap
    telemetry: pd.DataFrame
    color: str


def get_driver_lap_telemetry(session: Session, driver_code: str, color: str) -> DriverLapTelemetry | None:
    """
    Obtiene la vuelta más rápida de un piloto junto con su telemetría
    interpolada por distancia (necesaria para comparar contra otro piloto).
    """
    laps = session.laps.pick_drivers(driver_code)
    if laps.empty:
        return None

    fastest_lap = laps.pick_fastest()
    if fastest_lap is None or pd.isna(fastest_lap["LapTime"]):
        return None

    telemetry = fastest_lap.get_telemetry().add_distance()
    return DriverLapTelemetry(
        driver_code=driver_code,
        lap=fastest_lap,
        telemetry=telemetry,
        color=color,
    )


def compute_delta_time(reference: DriverLapTelemetry, comparison: DriverLapTelemetry) -> pd.DataFrame:
    """
    Calcula el delta de tiempo acumulado entre dos pilotos a lo largo de la
    distancia del circuito: delta positivo significa que `comparison` va
    más lento que `reference` en ese punto de la vuelta.

    Se interpola la telemetría de ambos en una rejilla común de distancia
    para poder restarlas punto a punto.
    """
    ref_tel = reference.telemetry
    comp_tel = comparison.telemetry

    # Rejilla común de distancia (la más corta de las dos, para no extrapolar)
    max_distance = min(ref_tel["Distance"].max(), comp_tel["Distance"].max())
    distance_grid = np.linspace(0, max_distance, 1000)

    ref_time = np.interp(
        distance_grid,
        ref_tel["Distance"],
        ref_tel["Time"].dt.total_seconds(),
    )
    comp_time = np.interp(
        distance_grid,
        comp_tel["Distance"],
        comp_tel["Time"].dt.total_seconds(),
    )

    delta = comp_time - ref_time

    return pd.DataFrame({
        "Distance": distance_grid,
        "Delta": delta,
    })


def build_sector_summary(reference: DriverLapTelemetry, comparison: DriverLapTelemetry) -> pd.DataFrame:
    """
    Construye una tabla comparativa de tiempos de vuelta y de sector
    entre los dos pilotos.
    """
    def _fmt(td) -> str:
        if pd.isna(td):
            return "—"
        total_seconds = td.total_seconds()
        minutes = int(total_seconds // 60)
        seconds = total_seconds - minutes * 60
        if minutes > 0:
            return f"{minutes}:{seconds:06.3f}"
        return f"{seconds:.3f}s"

    rows = []
    for label, key in [
        ("Vuelta completa", "LapTime"),
        ("Sector 1", "Sector1Time"),
        ("Sector 2", "Sector2Time"),
        ("Sector 3", "Sector3Time"),
    ]:
        ref_val = reference.lap[key]
        comp_val = comparison.lap[key]
        diff = None
        if pd.notna(ref_val) and pd.notna(comp_val):
            diff = comp_val.total_seconds() - ref_val.total_seconds()

        rows.append({
            "Segmento": label,
            reference.driver_code: _fmt(ref_val),
            comparison.driver_code: _fmt(comp_val),
            "Diferencia": f"{diff:+.3f}s" if diff is not None else "—",
        })

    return pd.DataFrame(rows)
