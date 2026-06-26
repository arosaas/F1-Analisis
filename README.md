# F1 Analytics

<img width="1814" height="910" alt="imagen" src="https://github.com/user-attachments/assets/1d15b258-286f-4d1c-898f-fc969db27c0c" />


Panel de análisis de Fórmula 1 con datos de **FastF1** servidos por un backend
**FastAPI** y un frontend **React 19 + TanStack Start + Tailwind v4**.

Arquitectura:

```text
   Navegador (Vite, :8080)
            │
            ▼
   Backend FastAPI (:8000)  ──►  FastF1 (caché ./cache)
                                 └─ Ergast (standings)
```

El frontend habla con el backend local en `http://localhost:8000`. El backend
expone endpoints compatibles con la API de OpenF1 y de Ergast, pero los datos
vienen de FastF1, igual que en el proyecto original Python/Streamlit.

## Características

- **Clasificación**: comparativa de telemetría entre dos pilotos en su vuelta más rápida (velocidad, acelerador, freno, marcha, RPM), delta acumulado y sectores.
- **Ritmo de Carrera**: evolución del tiempo de vuelta y resumen de ritmo medio sobre quicklaps.
- **Estrategia de Neumáticos**: Gantt de stints, uso de compuestos y degradación por vida del neumático.
- **Posiciones en Carrera**: posición de cada piloto al final de cada vuelta.
- **Mapa de Velocidad**: trazado del circuito coloreado por velocidad en la vuelta más rápida.
- **Pilotos**: standings del campeonato y comparativa de distribución de tiempos entre compañeros de equipo.
- **Equipos**: standings de constructores y comparativa de ritmo entre todos los equipos.

## Requisitos

- **Python 3.10+** (para el backend FastF1)
- **Node.js 20+** o **Bun** (para el frontend)

## Arranque rápido

### macOS / Linux

```bash
./start.sh
```

### Windows

```bat
start.bat
```

El script:
1. Crea `backend/.venv` e instala `backend/requirements.txt` (solo la primera vez).
2. Lanza el backend FastAPI en `http://localhost:8000`.
3. Instala dependencias del frontend (solo la primera vez) y lanza Vite en `http://localhost:8080`.

Abre `http://localhost:8080` en el navegador.

> La primera vez que pidas una sesión, FastF1 descargará los datos y los
> dejará en `./cache`. Llamadas posteriores son instantáneas.

## Arranque manual (paso a paso)

### 1. Backend (FastAPI + FastF1)

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate         # Windows: backend\.venv\Scripts\activate
pip install -r backend/requirements.txt
python -m uvicorn backend.app:app --port 8000 --reload
```

Endpoints expuestos (compatibles con OpenF1 / Ergast):

```text
GET /v1/meetings?year=2024
GET /v1/sessions?meeting_key=...
GET /v1/drivers?session_key=...
GET /v1/laps?session_key=...[&driver_number=...]
GET /v1/stints?session_key=...
GET /v1/position?session_key=...
GET /v1/car_data?session_key=...&driver_number=...&date>=...&date<=...
GET /v1/location?session_key=...&driver_number=...&date>=...&date<=...
GET /ergast/f1/{year}/driverstandings.json
GET /ergast/f1/{year}/constructorstandings.json
```

### 2. Frontend (Vite)

En otra terminal:

```bash
bun install        # o: npm install
bun run dev        # o: npm run dev
```

Disponible en `http://localhost:8080`.

### Cambiar el backend al que apunta el frontend

Por defecto el frontend usa `http://localhost:8000`. Para apuntar a otro
servidor (por ejemplo a la API pública de OpenF1) crea un `.env.local`:

```text
VITE_API_BASE=https://api.openf1.org/v1
VITE_ERGAST_BASE=https://api.jolpi.ca/ergast/f1
```

## Estructura del proyecto

```text
backend/
├── app.py                          # FastAPI + FastF1 (todos los endpoints)
└── requirements.txt
src/
├── routes/
│   ├── __root.tsx
│   ├── index.tsx
│   ├── panel.tsx                   # Layout del panel
│   ├── panel.index.tsx
│   ├── panel.clasificacion.tsx
│   ├── panel.ritmo.tsx
│   ├── panel.neumaticos.tsx
│   ├── panel.posiciones.tsx
│   ├── panel.mapa.tsx
│   ├── panel.pilotos.tsx
│   └── panel.equipos.tsx
├── components/
│   ├── panel-ui.tsx
│   └── session-picker.tsx
├── lib/
│   ├── openf1.ts                   # Cliente HTTP -> backend FastF1
│   ├── ergast.ts                   # Standings -> backend FastF1
│   ├── analysis.ts                 # Puerto TS de analysis/*.py
│   └── format.ts
└── styles.css
cache/                              # Caché local de FastF1 (auto-generada)
start.sh / start.bat                # Lanza backend + frontend
```

Equivalencia con el repositorio Python original
([https://github.com/arosaas/F1-Analisis](https://github.com/arosaas/F1-Analisis)):

| Original (Python/Streamlit) | Aquí                       |
|-----------------------------|----------------------------|
| `core/data_loader.py`       | `backend/app.py` (FastF1)  |
| `analysis/*.py`             | `src/lib/analysis.ts`      |
| `pages/*.py`                | `src/routes/panel.*.tsx`   |
| `streamlit run app.py`      | `./start.sh`               |

## Notas

- FastF1 cubre desde 2018 en telemetría. Para temporadas anteriores muchos
  endpoints devolverán datos vacíos.
- La primera carga de una sesión completa (telemetría + posiciones) puede
  tardar 30–60 s. Las siguientes son instantáneas gracias al caché.
- El backend permite CORS desde cualquier origen para facilitar el desarrollo
  local; si lo despliegas en otro entorno, restríngelo.

## Guía de Resolución de Problemas (Troubleshooting)

Esta sección documenta los problemas comunes de configuración y permisos al desplegar el panel, así como ajustes específicos del sistema operativo (especialmente en Fedora / GNOME) necesarios para un entorno de desarrollo óptimo.

### 1. Problemas de Arranque del Proyecto (F1 Analytics)

#### Permisos denegados al ejecutar `start.sh`
**Error:** `bash: ./start.sh: Permission denied` o `Permiso denegado`

Los sistemas Linux no permiten ejecutar scripts recién descargados por seguridad.
**Solución:** Otorga permisos de ejecución al archivo antes de lanzarlo:
```bash
chmod +x start.sh
./start.sh
```

#### Error de permisos al crear el entorno virtual
**Error:** `[Errno 13] Permission denied: '/home/usuario/F1-Analisis/backend/.venv/.gitignore'`

Si en algún momento ejecutaste el script con `sudo`, las carpetas del proyecto ahora pertenecen al superusuario (`root`).
**Solución:** Recupera la propiedad de toda la carpeta del proyecto para tu usuario:
```bash
sudo chown -R $USER:$USER ~/F1-Analisis
```

#### El script no encuentra `uvicorn` (Cruce de entornos virtuales)
**Error:** `/home/.../backend/.venv/bin/python: No module named uvicorn` a pesar de haber hecho `pip install uvicorn`.

El script `start.sh` espera estrictamente que el entorno virtual exista en `backend/.venv`. Si creaste o activaste un entorno virtual en la raíz del proyecto, las dependencias se instalaron en el lugar equivocado.
**Solución:**
```bash
# 1. Sal del entorno virtual incorrecto si lo tienes activado
deactivate

# 2. Crea el entorno virtual en la ruta que exige el script
python3 -m venv backend/.venv

# 3. Instala las dependencias apuntando a ese entorno específico
backend/.venv/bin/pip install -r backend/requirements.txt uvicorn
```

#### Bun no se reconoce o no instala módulos
**Error:** `Command 'bun' not found` o fallo silencioso al intentar compilar Vite.

Si acabas de instalar Bun, la terminal actual no ha recargado las variables de entorno (`$PATH`). Si ejecutas `bun install` junto con un `source` en la misma línea, la instalación se ignorará.
**Solución:**
```bash
source ~/.bashrc
bun install
bun run dev
```
*(Nota: Si el script demanda `npm` y no lo tienes instalado, instálalo vía `sudo dnf install nodejs`).*

