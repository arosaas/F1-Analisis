"""
pages/7_Equipos.py

Página dedicada al análisis de equipos:
- Clasificación del campeonato de constructores de la temporada
- Comparativa de ritmo de carrera entre todos los equipos (boxplot)
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import streamlit as st

from analysis.season_overview import (
    build_team_pace_table,
    order_teams_by_median_pace,
    sort_standings_for_chart,
)
from core.data_loader import (
    get_available_seasons,
    get_constructor_standings,
    get_drivers_in_session,
    get_event_schedule,
    get_team_color,
    load_session,
)

st.set_page_config(page_title="Equipos | F1 Analytics", page_icon="🏭", layout="wide")
st.title("🏭 Equipos")
st.caption("Clasificación del campeonato de constructores y comparativa de ritmo entre equipos.")

# ---------------------------------------------------------------------------
# Clasificación del campeonato de constructores
# ---------------------------------------------------------------------------
st.subheader("Clasificación del Campeonato de Constructores")

year = st.selectbox("Temporada", get_available_seasons(), index=0, key="teams_year")

try:
    standings = get_constructor_standings(year)
except Exception as exc:
    standings = None
    st.error(f"No se pudo cargar la clasificación de constructores: {exc}")

if standings is not None and not standings.empty:
    st.dataframe(standings, use_container_width=True, hide_index=True)

    chart_df = sort_standings_for_chart(standings)

    # Para colorear cada barra con el color oficial del equipo necesitamos
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
        bar_colors = "#00D2BE"

    fig, ax = plt.subplots(figsize=(10, max(4, 0.5 * len(chart_df))))
    fig.patch.set_alpha(0.0)
    ax.barh(chart_df["Equipo"], chart_df["Puntos"], color=bar_colors)
    ax.set_xlabel("Puntos")
    ax.grid(True, axis="x", alpha=0.3)
    plt.tight_layout()
    st.pyplot(fig, use_container_width=True)
elif standings is not None:
    st.info("No hay datos de clasificación disponibles para esta temporada.")

st.divider()

# ---------------------------------------------------------------------------
# Comparativa de ritmo de carrera entre equipos
# ---------------------------------------------------------------------------
st.subheader("Comparativa de ritmo de carrera entre equipos")
st.caption(
    "Distribución del tiempo de vuelta (vueltas representativas) de todos "
    "los pilotos, agrupados por equipo, en una carrera concreta."
)

col1, col2 = st.columns(2)
with col1:
    pace_year = st.selectbox("Temporada", get_available_seasons(), index=0, key="teams_pace_year")
with col2:
    pace_schedule = get_event_schedule(pace_year)
    pace_gp = st.selectbox("Gran Premio", pace_schedule["EventName"].tolist(), key="teams_pace_gp")

if st.button("Cargar carrera", type="primary", key="teams_pace_load"):
    st.session_state["teams_pace_loaded"] = (pace_year, pace_gp)

if "teams_pace_loaded" not in st.session_state:
    st.info("Selecciona año y Gran Premio, luego pulsa **Cargar carrera**.")
    st.stop()

loaded_year, loaded_gp = st.session_state["teams_pace_loaded"]

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
pace_table = build_team_pace_table(session, driver_codes)

if pace_table.empty:
    st.info("No hay suficientes vueltas representativas para esta carrera.")
else:
    team_order = order_teams_by_median_pace(pace_table)
    data_by_team = [
        pace_table[pace_table["Team"] == team]["LapTimeSeconds"].values
        for team in team_order
    ]
    team_colors = [get_team_color(session, team) for team in team_order]

    fig, ax = plt.subplots(figsize=(11, 6))
    fig.patch.set_alpha(0.0)
    box = ax.boxplot(
        data_by_team, label=team_order, patch_artist=True,
        showfliers=False, medianprops={"color": "black"},
    )
    for patch, color in zip(box["boxes"], team_colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.8)

    ax.set_ylabel("Tiempo de vuelta (s)")
    ax.grid(True, axis="y", alpha=0.3)
    plt.xticks(rotation=35, ha="right")
    plt.tight_layout()
    st.pyplot(fig, use_container_width=True)

    st.caption(
        "Equipos ordenados de más rápido (izquierda) a más lento (derecha) "
        "según el tiempo de vuelta mediano de ambos pilotos."
    )