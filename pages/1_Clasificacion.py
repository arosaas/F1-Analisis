"""
pages/1_Clasificacion.py

Página de comparativa de vuelta de clasificación (o cualquier vuelta rápida)
entre dos pilotos: telemetría completa + delta de tiempo + resumen de sectores.
"""

import sys
from pathlib import Path

# Permite importar los paquetes core/ y analysis/ desde la raíz del proyecto
sys.path.append(str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import streamlit as st

from analysis.qualifying import (
    build_sector_summary,
    compute_delta_time,
    get_driver_lap_telemetry,
)
from core.data_loader import (
    SESSION_TYPES,
    get_available_seasons,
    get_driver_color,
    get_driver_style,
    get_drivers_in_session,
    get_event_schedule,
    load_session,
)

st.set_page_config(page_title="Clasificación | F1 Analytics", page_icon="🏁", layout="wide")
st.title("🏁 Comparativa de Vuelta Rápida")
st.caption("Compara la telemetría de la vuelta más rápida de dos pilotos en cualquier sesión.")

# ---------------------------------------------------------------------------
# Selección de sesión
# ---------------------------------------------------------------------------
col1, col2, col3 = st.columns(3)

with col1:
    year = st.selectbox("Temporada", get_available_seasons(), index=0, key="quali_year")

with col2:
    schedule = get_event_schedule(year)
    gp_options = schedule["EventName"].tolist()
    gp = st.selectbox("Gran Premio", gp_options, key="quali_gp")

with col3:
    session_label = st.selectbox(
        "Sesión", list(SESSION_TYPES.keys()), index=0, key="quali_session_label"
    )
    session_type = SESSION_TYPES[session_label]

if st.button("Cargar sesión", type="primary", key="quali_load"):
    st.session_state["quali_session_loaded"] = (year, gp, session_type)

if "quali_session_loaded" not in st.session_state:
    st.info("Selecciona año, Gran Premio y sesión, luego pulsa **Cargar sesión**.")
    st.stop()

loaded_year, loaded_gp, loaded_session_type = st.session_state["quali_session_loaded"]

try:
    session = load_session(loaded_year, loaded_gp, loaded_session_type)
except Exception as exc:
    st.error(f"No se pudo cargar la sesión: {exc}")
    st.stop()

drivers_df = get_drivers_in_session(session)
if drivers_df.empty:
    st.warning("No se encontraron pilotos para esta sesión.")
    st.stop()

driver_codes = drivers_df["Abbreviation"].tolist()

# ---------------------------------------------------------------------------
# Selección de pilotos a comparar
# ---------------------------------------------------------------------------
st.subheader("Selecciona los pilotos a comparar")
pcol1, pcol2 = st.columns(2)

with pcol1:
    driver_1 = st.selectbox("Piloto 1 (referencia)", driver_codes, index=0, key="quali_driver_1")

with pcol2:
    default_idx = 1 if len(driver_codes) > 1 else 0
    driver_2 = st.selectbox("Piloto 2", driver_codes, index=default_idx, key="quali_driver_2")

if driver_1 == driver_2:
    st.warning("Selecciona dos pilotos diferentes para comparar.")
    st.stop()

color_1 = get_driver_color(session, driver_1)
color_2 = get_driver_color(session, driver_2)
style_1 = get_driver_style(session, driver_1, style=["color", "linestyle"])
style_2 = get_driver_style(session, driver_2, style=["color", "linestyle"])

tel_1 = get_driver_lap_telemetry(session, driver_1, color_1)
tel_2 = get_driver_lap_telemetry(session, driver_2, color_2)

if tel_1 is None or tel_2 is None:
    st.warning("Alguno de los pilotos no tiene una vuelta válida registrada en esta sesión.")
    st.stop()

# ---------------------------------------------------------------------------
# Resumen de sectores
# ---------------------------------------------------------------------------
st.subheader("Resumen de tiempos")
summary_df = build_sector_summary(tel_1, tel_2)
st.dataframe(summary_df, use_container_width=True, hide_index=True)

# ---------------------------------------------------------------------------
# Gráfico de telemetría: velocidad, throttle, freno, marcha
# ---------------------------------------------------------------------------
st.subheader("Telemetría comparada")

fig, axes = plt.subplots(5, 1, figsize=(11, 13), sharex=True)
fig.patch.set_alpha(0.0)

channels = [
    ("Speed", "Velocidad (km/h)"),
    ("Throttle", "Acelerador (%)"),
    ("Brake", "Freno"),
    ("nGear", "Marcha"),
    ("RPM", "RPM"),
]

for ax, (channel, label) in zip(axes, channels):
    ax.plot(
        tel_1.telemetry["Distance"], tel_1.telemetry[channel],
        color=style_1.get("color", tel_1.color), linestyle=style_1.get("linestyle", "-"),
        label=driver_1, linewidth=1.6,
    )
    ax.plot(
        tel_2.telemetry["Distance"], tel_2.telemetry[channel],
        color=style_2.get("color", tel_2.color), linestyle=style_2.get("linestyle", "-"),
        label=driver_2, linewidth=1.6,
    )
    ax.set_ylabel(label)
    ax.grid(True, alpha=0.3)

axes[0].legend(loc="upper right")
axes[-1].set_xlabel("Distancia (m)")
plt.tight_layout()
st.pyplot(fig, use_container_width=True)

# ---------------------------------------------------------------------------
# Gráfico de delta de tiempo
# ---------------------------------------------------------------------------
st.subheader(f"Delta de tiempo: {driver_2} respecto a {driver_1}")
st.caption(
    f"Valores positivos = {driver_2} más lento que {driver_1} en ese punto. "
    f"Valores negativos = {driver_2} más rápido."
)

delta_df = compute_delta_time(tel_1, tel_2)

fig_delta, ax_delta = plt.subplots(figsize=(11, 3.5))
fig_delta.patch.set_alpha(0.0)
ax_delta.plot(delta_df["Distance"], delta_df["Delta"], color=style_2.get("color", tel_2.color), linewidth=1.8)
ax_delta.axhline(0, color="white", linewidth=0.8, alpha=0.5)
ax_delta.fill_between(
    delta_df["Distance"], delta_df["Delta"], 0,
    where=(delta_df["Delta"] >= 0), color="red", alpha=0.15,
)
ax_delta.fill_between(
    delta_df["Distance"], delta_df["Delta"], 0,
    where=(delta_df["Delta"] < 0), color="green", alpha=0.15,
)
ax_delta.set_xlabel("Distancia (m)")
ax_delta.set_ylabel("Delta (s)")
ax_delta.grid(True, alpha=0.3)
plt.tight_layout()
st.pyplot(fig_delta, use_container_width=True)
