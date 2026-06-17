"""
pages/4_Posiciones_en_Carrera.py

Página de evolución de posiciones durante la carrera para todos los
pilotos, inspirada en el ejemplo "Position changes during a race" de la
galería de FastF1.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

from core.data_loader import (
    get_available_seasons,
    get_driver_style,
    get_drivers_in_session,
    get_event_schedule,
    load_session,
)

st.set_page_config(page_title="Posiciones en Carrera | F1 Analytics", page_icon="📊", layout="wide")
st.title("📊 Evolución de Posiciones en Carrera")
st.caption("Posición de cada piloto al final de cada vuelta, de principio a fin de la carrera.")

col1, col2 = st.columns(2)
with col1:
    year = st.selectbox("Temporada", get_available_seasons(), index=0, key="pos_year")
with col2:
    schedule = get_event_schedule(year)
    gp = st.selectbox("Gran Premio", schedule["EventName"].tolist(), key="pos_gp")

if st.button("Cargar carrera", type="primary", key="pos_load"):
    st.session_state["pos_session_loaded"] = (year, gp)

if "pos_session_loaded" not in st.session_state:
    st.info("Selecciona año y Gran Premio, luego pulsa **Cargar carrera**.")
    st.stop()

loaded_year, loaded_gp = st.session_state["pos_session_loaded"]

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

st.subheader("Selecciona los pilotos a mostrar")
selected_drivers = st.multiselect(
    "Pilotos (vacío = todos)", driver_codes, default=[], key="pos_drivers"
)
drivers_to_plot = selected_drivers if selected_drivers else driver_codes

# ---------------------------------------------------------------------------
# Gráfico de evolución de posiciones
# ---------------------------------------------------------------------------
st.subheader("Posición por vuelta")

fig, ax = plt.subplots(figsize=(11, 7))
fig.patch.set_alpha(0.0)

max_position = 20
for code in drivers_to_plot:
    drv_laps = session.laps.pick_drivers(code)
    if drv_laps.empty or drv_laps["Position"].isna().all():
        continue
    style = get_driver_style(session, code, style=["color", "linestyle"])
    ax.plot(
        drv_laps["LapNumber"], drv_laps["Position"],
        label=code, linewidth=1.8,
        color=style.get("color", "#1f77b4"), linestyle=style.get("linestyle", "-"),
    )
    driver_max = drv_laps["Position"].max()
    if pd.notna(driver_max):
        max_position = max(max_position, int(driver_max))

ax.set_ylim([max_position + 0.5, 0.5])
ax.set_yticks(range(1, max_position + 1, max(1, max_position // 10)))
ax.set_xlabel("Vuelta")
ax.set_ylabel("Posición")
ax.grid(True, alpha=0.3)
ax.legend(bbox_to_anchor=(1.0, 1.02), loc="upper left", fontsize=8)
plt.tight_layout()
st.pyplot(fig, use_container_width=True)

st.caption(
    "Las líneas verticales abruptas suelen indicar abandonos, paradas en "
    "boxes o sanciones; las cruces de líneas marcan adelantamientos reales en pista."
)
