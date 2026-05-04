# Hub Analitico BNB

Dashboard Vue 3 + PrimeVue para gestion comercial de cartera. La app esta preparada para conectarse a SQL Server mediante un backend Express tipo BFF; si no hay credenciales en `.env`, corre con datos demo para validar la experiencia.

## Ejecutar

```bash
npm install
npm run server
npm run dev
```

URLs por defecto:

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:4000`

## Configuracion `.env`

El proyecto ya incluye un `.env` local con modo mock. Para otro entorno, puedes recrearlo a partir de `.env.example`:

```bash
cp .env.example .env
```

Variables principales:

```env
PORT=4000
HOST=127.0.0.1
VITE_API_BASE_URL=http://localhost:4000

SQL_SERVER=servidor-sql
SQL_PORT=1433
SQL_DATABASE=base_datos
SQL_USER=usuario
SQL_PASSWORD=password
SQL_ENCRYPT=false
SQL_TRUST_SERVER_CERTIFICATE=true
```

Cuando `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER` y `SQL_PASSWORD` existen, el backend usa SQL Server. Si falta alguna, responde con datos demo y marca el modo como `mock`.

Los filtros de frontend viajan como query params hacia el backend:

- `fecha`
- `sucursal`
- `producto`
- `banco`

Ejemplo:

```text
/api/sistema-financiero/benchmark?fecha=2026-04-30&sucursal=LA%20PAZ&producto=CONSUMO&banco=BNB
```

## Tablas esperadas

- `Hub_CarteraBNB`
- `DimAgencia`
- `Hub_CarteraSF`
- `Hub_OONN`

Las consultas estan en `server/sql.js` y respetan el manual: aliases `s`, `d`, `sf`, `o`, solo `SELECT/WITH`, columnas oficiales y proteccion contra division por cero.

## Endpoints

- `GET /api/cartera/summary`
- `GET /api/cartera/kpis`
- `GET /api/cartera/timeseries`
- `GET /api/cartera/projection?scenario=base|optimista|conservador`
- `GET /api/sistema-financiero/benchmark`
- `GET /api/sistema-financiero/market-share`
- `GET /api/oficiales/ranking`
- `GET /api/fuentes/status`
- `POST /api/agent/query`

## Notas

- Captaciones queda como placeholder porque no hay fuente declarada en el manual.
- El agente IA no expone llaves en el frontend; responde desde el backend.
- Para produccion, configura el servidor API detras de HTTPS y restringe CORS al dominio del hub.
