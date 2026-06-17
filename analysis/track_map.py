"""
analysis/track_map.py

Lógica de análisis para el mapa del circuito coloreado por velocidad
("Speed visualization on track map" de la galería de FastF1):
- Reconstrucción de los segmentos (X, Y) de la vuelta
- Velocidad asociada a cada segmento, lista para un LineCollection

Este módulo NO dibuja nada ni usa Streamlit: solo transforma datos.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from fastf1.core import Lap, Session


@dataclass
class TrackSpeedData:
    """Contenedor con los datos necesarios para pintar el mapa de velocidad."""

    driver_code: str
    lap: Lap
    x: np.ndarray
    y: np.ndarray
    speed: np.ndarray
    segments: np.ndarray


def get_track_speed_data(session: Session, driver_code: str) -> TrackSpeedData | None:
    """
    Obtiene la posición (X, Y) y la velocidad de la vuelta más rápida de un
    piloto, junto con los segmentos de línea ya construidos para un
    matplotlib.collections.LineCollection.
    """
    laps = session.laps.pick_drivers(driver_code)
    if laps.empty:
        return None

    fastest_lap = laps.pick_fastest()
    if fastest_lap is None or pd.isna(fastest_lap["LapTime"]):
        return None

    telemetry = fastest_lap.get_telemetry()
    if telemetry.empty or "X" not in telemetry or "Y" not in telemetry:
        return None

    x = telemetry["X"].to_numpy()
    y = telemetry["Y"].to_numpy()
    speed = telemetry["Speed"].to_numpy().astype(float)

    points = np.array([x, y]).T.reshape(-1, 1, 2)
    segments = np.concatenate([points[:-1], points[1:]], axis=1)

    return TrackSpeedData(
        driver_code=driver_code,
        lap=fastest_lap,
        x=x,
        y=y,
        speed=speed,
        segments=segments,
    )


def get_circuit_corners(session: Session) -> pd.DataFrame | None:
    """
    Devuelve la información de curvas del circuito (número y posición),
    útil para anotar el mapa de velocidad con los números de curva.
    """
    try:
        circuit_info = session.get_circuit_info()
    except Exception:
        return None
    if circuit_info is None or circuit_info.corners.empty:
        return None
    return circuit_info.corners
