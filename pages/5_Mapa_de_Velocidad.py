"""
pages/5_Mapa_de_Velocidad.py

Mapa del trazado del circuito coloreado según la velocidad alcanzada en
cada punto, inspirado en el ejemplo "Speed visualization on track map"
de la galería de FastF1.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import matplotlib as mpl
import matplotlib.pyplot as plt
import streamlit as st
from matplotlib.collections import LineCollection

from analysis.track_map import get_circuit_corners, get_track_speed_data
from core.data_loader import (
    SESSION_TYPES,
    get_available_seasons,
    get_drivers_in_session,
    get_event_schedule,
    load_session,
)

st.set_page_config(page_title="Mapa de Velocidad | F1 Analytics", page_icon="🗺️", layout="wide")
st.title("🗺️ Mapa de Velocidad sobre el Trazado")
st.caption(
    "Traza la vuelta más rápida de un piloto sobre el circuito, coloreada "
    "según la velocidad alcanzada en cada punto."
)

col1, col2, col3 = st.columns(3)
with col1:
    year = st.selectbox("Temporada", get_available_seasons(), index=0, key="map_year")
with col2:
    schedule = get_event_schedule(year)
    gp = st.selectbox("Gran Premio", schedule["EventName"].tolist(), key="map_gp")
with col3:
    session_label = st.selectbox(
        "Sesión", list(SESSION_TYPES.keys()), index=0, key="map_session_label"
    )
    session_type = SESSION_TYPES[session_label]

if st.button("Cargar sesión", type="primary", key="map_load"):
    st.session_state["map_session_loaded"] = (year, gp, session_type)

if "map_session_loaded" not in st.session_state:
    st.info("Selecciona año, Gran Premio y sesión, luego pulsa **Cargar sesión**.")
    st.stop()

loaded_year, loaded_gp, loaded_session_type = st.session_state["map_session_loaded"]

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

st.subheader("Selecciona el piloto")
selected_driver = st.selectbox("Piloto", driver_codes, key="map_driver")

show_corners = st.checkbox("Mostrar números de curva", value=True, key="map_show_corners")

speed_data = get_track_speed_data(session, selected_driver)

if speed_data is None:
    st.warning("No hay telemetría de posición disponible para este piloto en esta sesión.")
    st.stop()

# ---------------------------------------------------------------------------
# Mapa de velocidad
# ---------------------------------------------------------------------------
st.subheader(f"Vuelta más rápida de {selected_driver}")

colormap = mpl.cm.plasma

fig, ax = plt.subplots(figsize=(9, 9))
fig.patch.set_alpha(0.0)
ax.set_facecolor("none")
ax.axis("off")
ax.set_aspect("equal")

# Línea de fondo (asfalto) en negro, gruesa, para dar contexto al trazado
ax.plot(speed_data.x, speed_data.y, color="black", linestyle="-", linewidth=14, zorder=0)

norm = plt.Normalize(speed_data.speed.min(), speed_data.speed.max())
lc = LineCollection(speed_data.segments, cmap=colormap, norm=norm, linestyle="-", linewidth=5)
lc.set_array(speed_data.speed)
line = ax.add_collection(lc)

if show_corners:
    corners = get_circuit_corners(session)
    if corners is not None and not corners.empty:
        for _, corner in corners.iterrows():
            ax.scatter(corner["X"], corner["Y"], color="white", s=60, zorder=3, edgecolor="black")
            ax.annotate(
                str(int(corner["Number"])),
                xy=(corner["X"], corner["Y"]),
                xytext=(0, 0), textcoords="offset points",
                color="black", fontsize=7, fontweight="bold",
                ha="center", va="center", zorder=4,
            )

cbar = fig.colorbar(line, ax=ax, orientation="horizontal", fraction=0.04, pad=0.02)
cbar.set_label("Velocidad (km/h)")

plt.tight_layout()
st.pyplot(fig, use_container_width=True)

st.caption(
    "Los tonos más claros/amarillos indican mayor velocidad; los tonos "
    "más oscuros/morados indican frenadas o curvas lentas."
)
