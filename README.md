# Hub Analítico BNB

Aplicación de inteligencia comercial para cartera del Banco Nacional de Bolivia: KPIs, series temporales, sistema financiero y rankings operativos. El frontend usa **Vue 3**, **PrimeVue** e iconografía **Font Awesome**. El backend es un **BFF en Express** que consulta **Microsoft SQL Server** cuando hay credenciales válidas; si no puede conectar, sirve **datos de demostración** para que el flujo de la interfaz sea verificable sin base de datos.

## Cómo ejecutar el proyecto

En una terminal, instala dependencias y levanta el API y el frontend (recomendado en dos terminales o con `dev:full`).

```bash
npm install
```

**Terminal 1 — API**

```bash
npm run server
```

**Terminal 2 — Vite (Vue)**

```bash
npm run dev
```

**Ambos a la vez** (requiere `concurrently` ya incluido en el proyecto):

```bash
npm run dev:full
```

Por defecto:

- Interfaz: `http://localhost:5173`
- API: `http://127.0.0.1:4000` (ajustable con `PORT` y `HOST` en `.env`)

Generar build de producción del frontend:

```bash
npm run build
```

## Configuración del entorno (`.env`)

Puedes partir de `cp .env.example .env` y completar variables. El backend considera **configuración SQL completa** cuando existen: `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER` y `SQL_PASSWORD`. En ese caso, el modo se expone como `sql-server` y las consultas de cartera, mercado y oficiales leen de la base. Si falta alguna de esas variables, el modo es `mock` y se usan catálogos y series definidos en `server/mockData.js`.

Variables habituales:

| Variable | Descripción |
|----------|-------------|
| `PORT`, `HOST` | Puerto e interfaz de escucha del BFF |
| `VITE_API_BASE_URL` | Origen del API visto por el frontend (Vite) |
| `SQL_SERVER`, `SQL_PORT`, `SQL_DATABASE` | Conexión al motor |
| `SQL_USER`, `SQL_PASSWORD` | Credenciales |
| `SQL_ENCRYPT`, `SQL_TRUST_SERVER_CERTIFICATE` | Opciones TLS / certificado del servidor |

## Comportamiento de los datos: en vivo frente a demostración

- **Con SQL configurado y conexión correcta:** los endpoints agregan resultados reales. Los **catálogos** (fechas de corte, sucursales, productos, bancos, agencias) se obtienen con `GET /api/catalogs` a partir de las tablas de negocio (fechas y productos desde hubs; sucursales y agencias desde `DimAgencia`; bancos desde `Hub_CarteraSF`). Si una consulta **no devuelve filas** (por filtros muy restrictivos), el API responde con **valores vacíos o ceros** según el endpoint, **sin** mezclar números de demostración.

- **Sin SQL o sin pool:** el mismo contrato de API se cumple con datos demo; el tag en la cabecera muestra **Demo** en lugar de **En vivo**.

## Filtros en la interfaz

La barra de filtros trabaja en **dos pasos**: eliges valores y pulsas **Aplicar** para que KPIs, tablas y gráficos se actualicen. **Limpiar** restablece valores por defecto y vuelve a cargar.

Valores por defecto al iniciar:

- **Producto:** CONSUMO, VIVIENDA, VIVIENDA SOCIAL, TARJETAS DE CREDITO, VEHICULAR, MICROCREDITO (según existan en el catálogo activo).
- **Sucursal y agencia:** opción global **Todas** (`TODAS`), con posibilidad de **seleccionar todo** en los listados (PrimeVue).

El filtro **Agencia** usa la dimensión `DimAgencia` (`Cod_Agencia` y sucursal asociada). En consultas solo sobre `Hub_CarteraSF` (benchmark y participación de mercado), la restricción por agencia se traduce a sucursales presentes en `DimAgencia`, porque el hub financiero no expone identificador de agencia por fila.

## Parámetros de consulta (API)

Los filtros viajan como query string y pueden repetirse en listas separadas por comas. Los sentinela **TODOS** (producto) y **TODAS** (sucursal y agencia) significan “sin restricción” en ese eje.

| Parámetro | Uso |
|-----------|-----|
| `fecha` | Fecha de corte (cartera / reportes alineados al hub) |
| `sucursal` | Una o varias sucursales |
| `producto` | Uno o varios valores de `segmentacioncredito` |
| `agencia` | Uno o varios `Cod_Agencia` en `DimAgencia` |
| `banco` | Filtro de banco en vistas de sistema financiero |

Ejemplo:

```text
GET /api/cartera/summary?fecha=2026-04-30&sucursal=LA%20PAZ,COCHABAMBA&producto=CONSUMO,VIVIENDA&agencia=101,102
```

Definición de consultas SQL parametrizadas y expansión de listas `IN`: [`server/sql.js`](server/sql.js).

## Tablas y modelo de datos esperado

- `Hub_CarteraBNB` — cartera BNB (stock, desembolsos, presupuesto, segmentación).
- `DimAgencia` — agencias y sucursales (`Cod_Agencia`, `Sucursal`; la etiqueta en catálogo concatena código y sucursal si no hay columna descriptiva adicional).
- `Hub_CarteraSF` — sistema financiero (banco, segmento, sucursal, montos).
- `Hub_OONN` — oficiales y desembolsos (unión con `DimAgencia` por agencia).

Las sentencias usan únicamente `SELECT` / `WITH` y aliases coherentes con el manual interno del proyecto.

## Endpoints principales

| Método y ruta | Descripción breve |
|----------------|-------------------|
| `GET /api/health` | Estado y modo `mock` / `sql-server` |
| `GET /api/catalogs` | Catálogos para filtros (SQL o demo) |
| `GET /api/cartera/summary` | Resumen ejecutivo al corte |
| `GET /api/cartera/kpis` | KPIs derivados del resumen |
| `GET /api/cartera/kpis-by-product` | Detalle por producto |
| `GET /api/cartera/timeseries` | Serie temporal agregada |
| `GET /api/cartera/projection` | Proyección agregada (demo; escenarios base / optimista / conservador) |
| `GET /api/cartera/projection-by-product` | Proyección por producto (demo) |
| `GET /api/sistema-financiero/benchmark` | Benchmark multibanco |
| `GET /api/sistema-financiero/market-share` | Participación BNB vs sistema |
| `GET /api/oficiales/ranking` | Ranking de oficiales |
| `GET /api/fuentes/status` | Metadatos de cortes por fuente |
| `POST /api/agent/query` | Respuestas del asistente (sin exponer secretos al cliente) |

## Notas operativas

- La sección de **captaciones** consume los endpoints de captaciones del BFF cuando hay datos disponibles.
- El **agente** responde desde el servidor; no se incrustan credenciales ni claves en el bundle del cliente.
- En despliegue productivo, sirve el BFF detrás de HTTPS y restringe CORS al dominio del hub.

## Arquitectura del frontend

El frontend está organizado en capas modulares (Vue 3 + Vue Router + Pinia):

```
src/
├── App.vue                 # Shell: entrada, sidebar, topbar, filtros, <RouterView>
├── main.js                 # Bootstrap: Pinia, Router, PrimeVue, Font Awesome
├── router/index.js         # Rutas hash por sección del menú
├── stores/                 # Estado global (Pinia)
│   ├── useAppStore.js      # UI: menú, sidebar, hasEntered
│   ├── useDataStore.js     # Datos del API + loadAll()
│   ├── useFiltersStore.js  # Catálogos y filtros aplicados
│   └── useChatStore.js     # Chat IA y memoria de sesión
├── composables/
│   ├── useHubLogic.js      # Computeds y helpers de negocio (gráficos, KPIs)
│   ├── useAgentPrompts.js  # Builders de prompts y triggers del agente
│   └── useChart.js         # Constantes Chart.js compartidas
├── views/                  # Una vista por ruta (páginas)
├── components/             # UI reutilizable (KpiCard, FilterBar, …)
├── utils/formatting.js     # Formateo local complementario a format.js
└── styles.css              # Variables globales y layout base
```

### Responsabilidad de cada capa

| Capa | Rol |
|------|-----|
| **stores** | Fuente de verdad para datos, filtros, chat y estado de shell |
| **useHubLogic** | Derivados de negocio (totales, charts, tablas) consumidos por las vistas |
| **views** | Template de cada sección; importan `useHubLogic()` como `hub` |
| **components** | Piezas de UI sin lógica de dominio |

### Convenciones

- **views/** = páginas enlazadas al router (`PortadaView`, `cartera/DesempenoView`, …).
- **components/** = bloques reutilizables (`KpiCard`, `SectionHeader`, `ChatContextSummary`, …).

### Agregar una nueva sección al menú

1. Crear la vista en `src/views/…`.
2. Registrar la ruta en `src/router/index.js` (lazy import).
3. Añadir el ítem en `sections` de `src/stores/useAppStore.js` con `id`, `label`, `icon` y `path`.
4. Si la sección usa filtros, no incluir su `route.name` en `showFiltersFor` → exclusiones de `useFiltersStore.js`.
