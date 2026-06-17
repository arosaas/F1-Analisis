"""
app.py

Punto de entrada de la aplicación F1 Analytics.
Streamlit detecta automáticamente la carpeta `pages/` y construye la
navegación lateral a partir de los archivos que contiene. Este archivo
actúa como portada / página de inicio.

Para ejecutar:
    streamlit run app.py
"""

import streamlit as st

st.set_page_config(
    page_title="F1 Analytics",
    page_icon="🏎️",
    layout="wide",
)

st.title("🏎️ F1 Analytics")
st.markdown(
    """
    Bienvenido a **F1 Analytics**, un panel de análisis de datos de Fórmula 1
    construido sobre [FastF1](https://docs.fastf1.dev/).

    Usa el menú de la izquierda para navegar entre los módulos disponibles:

    - **🏁 Clasificación**: compara la vuelta rápida de dos pilotos
      (telemetría de velocidad, throttle, freno, marchas y delta de tiempo).
    - **🏎️ Ritmo de Carrera**: evolución del tiempo de vuelta y ritmo
      medio de varios pilotos a lo largo de la carrera.
    - **🛞 Estrategia de Neumáticos**: stints, compuestos utilizados y
      degradación del neumático a lo largo de la vida del compuesto.
    - **📊 Posiciones en Carrera**: evolución de la posición de cada
      piloto vuelta a vuelta, para ver adelantamientos, abandonos y
      paradas en boxes de un vistazo.
    - **🗺️ Mapa de Velocidad**: el trazado del circuito coloreado según
      la velocidad alcanzada en cada punto de la vuelta más rápida.
    - **🧑‍🚀 Pilotos**: clasificación del campeonato de pilotos y
      comparativa de ritmo entre compañeros de equipo.
    - **🏭 Equipos**: clasificación del campeonato de constructores y
      comparativa de ritmo de carrera entre todos los equipos.

    ---
    🎨 **Sobre los colores**: todos los gráficos usan los colores
    oficiales de equipo de FastF1, así que cada piloto y cada equipo se
    distingue de un vistazo. Cuando dos compañeros de equipo comparten
    color, el trazo (línea continua/discontinua) o el estilo de punto los
    diferencia.

    💡 **Nota sobre rendimiento**: la primera vez que cargues una sesión,
    FastF1 descargará los datos desde la API oficial de F1, lo cual puede
    tardar unos segundos. Las sesiones recientes ya disputadas suelen
    cargar más rápido que sesiones muy antiguas o con mucho volumen de
    telemetría.
    """
)

with st.sidebar:
    st.info("Selecciona un módulo de análisis arriba ⬆️")
