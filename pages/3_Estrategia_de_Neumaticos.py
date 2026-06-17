"""
pages/3_Estrategia_de_Neumaticos.py

Página de análisis de estrategia de neumáticos:
- Gráfico de Gantt con los stints de cada piloto
- Degradación del neumático (tiempo de vuelta vs. vida del compuesto)
- Resumen global de uso de compuestos en la sesión
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import streamlit as st

from analysis.tyre_strategy import (
    build_degradation_table,
    build_stints_table,
    get_compound_usage_summary,
)
from core.data_loader import (
    get_available_seasons,
    get_drivers_in_session,
    get_event_schedule,
    load_session,
)

st.set_page_config(page_title="Estrategia de Neumáticos | F1 Analytics", page_icon="🛞", layout="wide")
st.title("🛞 Estrategia de Neumáticos")
st.caption("Stints, compuestos utilizados y degradación a lo largo de la carrera.")

# Colores oficiales aproximados de compuestos Pirelli (fallback si FastF1 no
# devuelve un color para alguno, p. ej. compuestos de test)
COMPOUND_COLORS = {
    "SOFT": "#DA291C",
    "MEDIUM": "#FFD12E",
    "HARD": "#F0F0F0",
    "INTERMEDIATE": "#43B02A",
    "WET": "#0067AD",
    "TEST_UNKNOWN": "#999999",
    "UNKNOWN": "#999999",
}

col1, col2 = st.columns(2)
with col1:
    year = st.selectbox("Temporada", get_available_seasons(), index=0, key="tyre_year")
with col2:
    schedule = get_event_schedule(year)
    gp = st.selectbox("Gran Premio", schedule["EventName"].tolist(), key="tyre_gp")

if st.button("Cargar carrera", type="primary", key="tyre_load"):
    st.session_state["tyre_session_loaded"] = (year, gp)

if "tyre_session_loaded" not in st.session_state:
    st.info("Selecciona año y Gran Premio, luego pulsa **Cargar carrera**.")
    st.stop()

loaded_year, loaded_gp = st.session_state["tyre_session_loaded"]

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

# ---------------------------------------------------------------------------
# Gráfico de Gantt de estrategia (todos los pilotos por defecto)
# ---------------------------------------------------------------------------
st.subheader("Estrategia de paradas (todos los pilotos)")

stints_df = build_stints_table(session, driver_codes)

if stints_df.empty:
    st.warning("No hay datos de stints disponibles para esta sesión.")
else:
    # Orden de pilotos de arriba a abajo según posición final, si está disponible
    order = drivers_df["Abbreviation"].tolist()
    fig_height = max(4, 0.35 * len(order))
    fig, ax = plt.subplots(figsize=(11, fig_height))
    fig.patch.set_alpha(0.0)

    for driver in order:
        driver_stints = stints_df[stints_df["Driver"] == driver]
        previous_end = 0
        for _, row in driver_stints.iterrows():
            color = COMPOUND_COLORS.get(row["Compound"], "#999999")
            ax.barh(
                y=driver, width=row["StintLength"], left=previous_end,
                color=color, edgecolor="black", linewidth=0.6,
            )
            previous_end += row["StintLength"]

    ax.set_xlabel("Número de vuelta")
    ax.invert_yaxis()
    ax.grid(True, axis="x", alpha=0.3)

    # Leyenda manual de compuestos
    handles = [
        plt.Rectangle((0, 0), 1, 1, color=color, label=compound)
        for compound, color in COMPOUND_COLORS.items()
        if compound in stints_df["Compound"].unique()
    ]
    ax.legend(handles=handles, loc="upper center", bbox_to_anchor=(0.5, -0.12), ncol=len(handles))

    plt.tight_layout()
    st.pyplot(fig, use_container_width=True)

# ---------------------------------------------------------------------------
# Resumen global de compuestos
# ---------------------------------------------------------------------------
st.subheader("Uso global de compuestos en la sesión")
usage_df = get_compound_usage_summary(session)
st.dataframe(usage_df, use_container_width=True, hide_index=True)

# ---------------------------------------------------------------------------
# Degradación por piloto
# ---------------------------------------------------------------------------
st.subheader("Degradación del neumático por piloto")
st.caption(
    "Tiempo de vuelta medio según la vida del neumático (vueltas desde que "
    "se montó), usando solo vueltas representativas (sin entradas/salidas de pits)."
)

selected_driver = st.selectbox("Piloto", driver_codes, key="tyre_driver")
degradation_df = build_degradation_table(session, selected_driver)

if degradation_df.empty:
    st.info("No hay suficientes vueltas representativas para este piloto.")
else:
    fig_deg, ax_deg = plt.subplots(figsize=(11, 5))
    fig_deg.patch.set_alpha(0.0)

    for compound in degradation_df["Compound"].unique():
        compound_data = degradation_df[degradation_df["Compound"] == compound]
        color = COMPOUND_COLORS.get(compound, "#999999")
        ax_deg.plot(
            compound_data["TyreLife"], compound_data["LapTimeSeconds"],
            marker="o", markersize=4, linewidth=1.6, color=color, label=compound,
        )

    ax_deg.set_xlabel("Vida del neumático (vueltas)")
    ax_deg.set_ylabel("Tiempo de vuelta medio (s)")
    ax_deg.grid(True, alpha=0.3)
    ax_deg.legend()
    plt.tight_layout()
    st.pyplot(fig_deg, use_container_width=True)
