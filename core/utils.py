"""
core/utils.py

Funciones de utilidad compartidas entre páginas: formateo de tiempos,
construcción de etiquetas de piloto, etc.
"""

from __future__ import annotations

import pandas as pd


def format_timedelta(td: pd.Timedelta | None) -> str:
    """Formatea un Timedelta de pandas como 'm:ss.mmm' o 'ss.mmm'."""
    if td is None or pd.isna(td):
        return "—"
    total_seconds = td.total_seconds()
    minutes = int(total_seconds // 60)
    seconds = total_seconds - minutes * 60
    if minutes > 0:
        return f"{minutes}:{seconds:06.3f}"
    return f"{seconds:.3f}s"


def driver_label(abbreviation: str, full_name: str | None = None, team: str | None = None) -> str:
    """Construye una etiqueta legible para un piloto en selectores de UI."""
    parts = [abbreviation]
    if full_name:
        parts.append(f"({full_name})")
    if team:
        parts.append(f"- {team}")
    return " ".join(parts)
