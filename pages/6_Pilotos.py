"""
pages/6_Pilotos.py

Página dedicada al análisis de pilotos:
- Clasificación del campeonato de pilotos de la temporada
- Comparativa de ritmo entre dos compañeros de equipo en una carrera dada
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

from analysis.season_overview import sort_standings_for_chart
from core.data_loader import (
    get_available_seasons,
    get_driver_color_mapping,
    get_driver_standings,
    get_drivers_in_session,
    get_event_schedule,
    get_team_color,
    load_session,
)

st.set_page_config(page_title="Pilotos | F1 Analytics", page_icon="🧑‍🚀", layout="wide")
st.title("🧑‍🚀 Pilotos")
st.caption("Clasificación del campeonato de pilotos y comparativas de ritmo dentro del mismo equipo.")

# ---------------------------------------------------------------------------
# Clasificación del campeonato de pilotos
# ---------------------------------------------------------------------------
st.subheader("Clasificación del Campeonato de Pilotos")

year = st.selectbox("Temporada", get_available_seasons(), index=0, key="drivers_year")

try:
    standings = get_driver_standings(year)
except Exception as exc:
    standings = None
    st.error(f"No se pudo cargar la clasificación de pilotos: {exc}")

if standings is not None and not standings.empty:
    st.dataframe(standings, use_container_width=True, hide_index=True)

    chart_df = sort_standings_for_chart(standings)

    # Para colorear cada barra con el color oficial de su equipo necesitamos
    # una sesión cargada (Ergast no incluye colores). Usamos la última
    # carrera disputada de esa temporada solo para resolver colores.
    try:
        ref_schedule = get_event_schedule(year)
        ref_gp = ref_schedule["EventName"].iloc[-1]
        ref_session = load_session(year, ref_gp, "R")
        bar_colors = [
            get_team_color(ref_session, team) for team in chart_df["Equipo"]
        ]
    except Exception:
        bar_colors = "#E10600"

    fig, ax = plt.subplots(figsize=(10, max(4, 0.4 * len(chart_df))))
    fig.patch.set_alpha(0.0)
    ax.barh(chart_df["Piloto"], chart_df["Puntos"], color=bar_colors)
    ax.set_xlabel("Puntos")
    ax.grid(True, axis="x", alpha=0.3)
    plt.tight_layout()
    st.pyplot(fig, use_container_width=True)
elif standings is not None:
    st.info("No hay datos de clasificación disponibles para esta temporada.")

st.divider()

# ---------------------------------------------------------------------------
# Comparativa de ritmo entre compañeros de equipo
# ---------------------------------------------------------------------------
st.subheader("Comparativa de ritmo entre compañeros de equipo")
st.caption(
    "Selecciona una carrera para comparar la distribución de tiempos de "
    "vuelta (vueltas representativas) de dos pilotos del mismo equipo."
)

col1, col2 = st.columns(2)
with col1:
    pace_year = st.selectbox("Temporada", get_available_seasons(), index=0, key="drivers_pace_year")
with col2:
    pace_schedule = get_event_schedule(pace_year)
    pace_gp = st.selectbox("Gran Premio", pace_schedule["EventName"].tolist(), key="drivers_pace_gp")

if st.button("Cargar carrera", type="primary", key="drivers_pace_load"):
    st.session_state["drivers_pace_loaded"] = (pace_year, pace_gp)

if "drivers_pace_loaded" not in st.session_state:
    st.info("Selecciona año y Gran Premio, luego pulsa **Cargar carrera**.")
    st.stop()

loaded_year, loaded_gp = st.session_state["drivers_pace_loaded"]

try:
    session = load_session(loaded_year, loaded_gp, "R")
except Exception as exc:
    st.error(f"No se pudo cargar la sesión: {exc}")
    st.stop()

drivers_df = get_drivers_in_session(session)
if drivers_df.empty:
    st.warning("No se encontraron pilotos para esta sesión.")
    st.stop()

driver_codes = drivers_df["Abbreviation"].tolist()

pcol1, pcol2 = st.columns(2)
with pcol1:
    driver_a = st.selectbox("Piloto 1", driver_codes, index=0, key="drivers_pace_a")
with pcol2:
    default_idx = 1 if len(driver_codes) > 1 else 0
    driver_b = st.selectbox("Piloto 2", driver_codes, index=default_idx, key="drivers_pace_b")

if driver_a == driver_b:
    st.warning("Selecciona dos pilotos diferentes para comparar.")
    st.stop()

color_map = get_driver_color_mapping(session)

laps_a = session.laps.pick_drivers(driver_a).pick_quicklaps()
laps_a = laps_a[laps_a["LapTime"].notna()]
laps_b = session.laps.pick_drivers(driver_b).pick_quicklaps()
laps_b = laps_b[laps_b["LapTime"].notna()]

if laps_a.empty or laps_b.empty:
    st.info("No hay suficientes vueltas representativas para uno de los pilotos seleccionados.")
else:
    times_a = laps_a["LapTime"].dt.total_seconds()
    times_b = laps_b["LapTime"].dt.total_seconds()

    fig_pace, ax_pace = plt.subplots(figsize=(8, 5))
    fig_pace.patch.set_alpha(0.0)
    parts = ax_pace.violinplot(
        [times_a, times_b], showmedians=True, showextrema=False,
    )
    for body, code in zip(parts["bodies"], [driver_a, driver_b]):
        body.set_facecolor(color_map.get(code, "#1f77b4"))
        body.set_alpha(0.7)
    ax_pace.set_xticks([1, 2])
    ax_pace.set_xticklabels([driver_a, driver_b])
    ax_pace.set_ylabel("Tiempo de vuelta (s)")
    ax_pace.grid(True, axis="y", alpha=0.3)
    plt.tight_layout()
    st.pyplot(fig_pace, use_container_width=True)

    summary = pd.DataFrame({
        "Piloto": [driver_a, driver_b],
        "Vueltas consideradas": [len(times_a), len(times_b)],
        "Media (s)": [round(times_a.mean(), 3), round(times_b.mean(), 3)],
        "Mejor vuelta (s)": [round(times_a.min(), 3), round(times_b.min(), 3)],
    })
    st.dataframe(summary, use_container_width=True, hide_index=True)