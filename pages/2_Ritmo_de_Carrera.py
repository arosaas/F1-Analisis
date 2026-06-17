"""
pages/2_Ritmo_de_Carrera.py

Página de análisis de ritmo de carrera: evolución del tiempo de vuelta
y comparativa de ritmo medio entre varios pilotos.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import streamlit as st

from analysis.race_pace import build_race_pace_comparison, summarize_average_pace
from core.data_loader import (
    get_available_seasons,
    get_driver_color,
    get_driver_style,
    get_drivers_in_session,
    get_event_schedule,
    load_session,
)

st.set_page_config(page_title="Ritmo de Carrera | F1 Analytics", page_icon="🏎️", layout="wide")
st.title("🏎️ Ritmo de Carrera")
st.caption("Evolución del tiempo de vuelta a lo largo de la carrera para varios pilotos.")

col1, col2 = st.columns(2)
with col1:
    year = st.selectbox("Temporada", get_available_seasons(), index=0, key="race_year")
with col2:
    schedule = get_event_schedule(year)
    gp = st.selectbox("Gran Premio", schedule["EventName"].tolist(), key="race_gp")

if st.button("Cargar carrera", type="primary", key="race_load"):
    st.session_state["race_session_loaded"] = (year, gp)

if "race_session_loaded" not in st.session_state:
    st.info("Selecciona año y Gran Premio, luego pulsa **Cargar carrera**.")
    st.stop()

loaded_year, loaded_gp = st.session_state["race_session_loaded"]

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

st.subheader("Selecciona los pilotos a comparar")
default_selection = driver_codes[: min(3, len(driver_codes))]
selected_drivers = st.multiselect(
    "Pilotos", driver_codes, default=default_selection, key="race_drivers"
)

if not selected_drivers:
    st.warning("Selecciona al menos un piloto.")
    st.stop()

# ---------------------------------------------------------------------------
# Gráfico de evolución de ritmo
# ---------------------------------------------------------------------------
st.subheader("Evolución del tiempo de vuelta")

pace_df = build_race_pace_comparison(session, selected_drivers)

if pace_df.empty:
    st.warning("No hay datos de vueltas disponibles para los pilotos seleccionados.")
    st.stop()

fig, ax = plt.subplots(figsize=(11, 5))
fig.patch.set_alpha(0.0)

for code in selected_drivers:
    driver_data = pace_df[pace_df["Driver"] == code]
    if driver_data.empty:
        continue
    style = get_driver_style(session, code, style=["color", "linestyle"])
    ax.plot(
        driver_data["LapNumber"], driver_data["LapTimeSeconds"],
        marker="o", markersize=3, linewidth=1.4,
        color=style.get("color", "#1f77b4"), linestyle=style.get("linestyle", "-"),
        label=code,
    )

ax.set_xlabel("Número de vuelta")
ax.set_ylabel("Tiempo de vuelta (s)")
ax.grid(True, alpha=0.3)
ax.legend(loc="upper right")
plt.tight_layout()
st.pyplot(fig, use_container_width=True)

st.caption(
    "Nota: se incluyen todas las vueltas con tiempo registrado, incluyendo "
    "vueltas afectadas por tráfico, Safety Car o banderas amarillas. Para "
    "una comparativa de ritmo \"puro\", consulta el resumen de abajo, que "
    "filtra solo vueltas representativas."
)

# ---------------------------------------------------------------------------
# Resumen de ritmo medio (vueltas representativas)
# ---------------------------------------------------------------------------
st.subheader("Resumen de ritmo (vueltas representativas)")
summary_df = summarize_average_pace(session, selected_drivers)

if summary_df.empty:
    st.info("No hay suficientes vueltas representativas para calcular un resumen.")
else:
    st.dataframe(summary_df, use_container_width=True, hide_index=True)
