# 🏎️ F1 Analytics

Panel de análisis de datos de Fórmula 1 construido con **Streamlit** y **FastF1**.

## Características

- **🏁 Clasificación**: comparativa de telemetría entre dos pilotos en su vuelta
  más rápida (velocidad, acelerador, freno, marcha, RPM) junto con el delta de
  tiempo acumulado a lo largo de la vuelta y un resumen de sectores.
- **🏎️ Ritmo de Carrera**: evolución del tiempo de vuelta a lo largo de la
  carrera para varios pilotos, más un resumen de ritmo medio sobre vueltas
  representativas (sin tráfico, pits ni Safety Car).
- **🛞 Estrategia de Neumáticos**: gráfico de Gantt con los stints de cada
  piloto, resumen de uso de compuestos en la sesión y curva de degradación
  (tiempo de vuelta medio según la vida del neumático).
- **📊 Posiciones en Carrera**: evolución de la posición de cada piloto al
  final de cada vuelta, para detectar adelantamientos, abandonos y paradas.
- **🗺️ Mapa de Velocidad**: trazado del circuito coloreado según la
  velocidad alcanzada en cada punto de la vuelta más rápida de un piloto,
  con los números de curva superpuestos.
- **🧑‍🚀 Pilotos**: clasificación del campeonato de pilotos de la temporada
  y comparativa de la distribución de tiempos de vuelta entre dos
  compañeros de equipo en una carrera.
- **🏭 Equipos**: clasificación del campeonato de constructores de la
  temporada y comparativa de ritmo de carrera entre todos los equipos.

## Colores de piloto y equipo

Todos los gráficos usan los colores oficiales de FastF1
(`fastf1.plotting.get_driver_color` / `get_team_color`), por lo que cada
piloto y cada equipo se distingue visualmente. Cuando dos compañeros de
equipo comparten color, se usa `get_driver_style` para añadir un estilo de
línea distinto (continua/discontinua) y así diferenciarlos sin perder la
asociación con el color del equipo.

## Instalación

```bash
# 1. Clona o copia esta carpeta
cd f1_analytics

# 2. Crea un entorno virtual (recomendado)
python3 -m venv venv
source venv/bin/activate   # En Windows: venv\Scripts\activate

# 3. Instala las dependencias
pip install -r requirements.txt
```

## Ejecución

```bash
streamlit run app.py
```

Esto abrirá la app en tu navegador, normalmente en `http://localhost:8501`.

## Estructura del proyecto

```
f1_analytics/
├── app.py                          # Página de inicio / navegación
├── requirements.txt
├── core/
│   ├── data_loader.py              # Acceso a datos vía FastF1/Ergast + caché + colores
│   └── utils.py                    # Helpers de formateo
├── analysis/
│   ├── qualifying.py                # Lógica de comparativa de vuelta rápida
│   ├── race_pace.py                 # Lógica de ritmo de carrera
│   ├── tyre_strategy.py             # Lógica de estrategia de neumáticos
│   ├── track_map.py                 # Lógica del mapa de velocidad sobre el trazado
│   └── season_overview.py           # Lógica de clasificaciones y ritmo por equipo
└── pages/
    ├── 1_Clasificacion.py
    ├── 2_Ritmo_de_Carrera.py
    ├── 3_Estrategia_de_Neumaticos.py
    ├── 4_Posiciones_en_Carrera.py
    ├── 5_Mapa_de_Velocidad.py
    ├── 6_Pilotos.py
    └── 7_Equipos.py
```

La separación entre `core/`, `analysis/` y `pages/` no es solo organizativa:

- **`core/`** sabe hablar con FastF1 y gestiona la caché. Si cambias de
  fuente de datos en el futuro, solo tocas aquí.
- **`analysis/`** contiene pandas puro: transforma datos en tablas y series
  listas para graficar. No importa Streamlit, así que es reutilizable en
  notebooks, scripts o tests.
- **`pages/`** solo se encarga de la interacción y el renderizado.

## Notas sobre la caché de datos

FastF1 descarga datos pesados (telemetría, posiciones, clima) desde la API
oficial de F1. La primera vez que cargues una sesión puede tardar varios
segundos; las siguientes veces que pidas la misma sesión, Streamlit reutiliza
el resultado gracias a `@st.cache_data`, así que la experiencia mejora
notablemente dentro de la misma ejecución de la app.

Además, FastF1 guarda una caché propia en disco en la carpeta
`.fastf1_cache/` (se crea automáticamente la primera vez que ejecutas la
app). Si quieres forzar una descarga limpia, puedes borrar esa carpeta.

## Próximos pasos sugeridos

- Evolución de puntos carrera a carrera en la página de Pilotos/Equipos
  (requiere una llamada a Ergast por ronda; se puede cachear de forma
  agresiva para no penalizar el rendimiento).
- Exportar gráficos como imagen o PDF.
- Añadir análisis de clima (lluvia, temperatura de pista) cruzado con ritmo.
- Migrar los gráficos de Matplotlib a Plotly para zoom/pan interactivo,
  si se necesita ese nivel de interacción.
