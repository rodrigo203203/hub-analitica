import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
    benchmark,
    catalogs,
    dates,
    getProjection,
    getProjectionByProduct,
    kpis,
    kpisByProduct,
    marketShare,
    oficiales,
    summary,
    timeSeries
} from './mockData.js';
import {
    fetchCatalogsFromSql,
    getPool,
    hasSqlConfig,
    queries,
    query,
    fetchProjectionFromSql,
    fetchProjectionByProductFromSql,
    fetchPdRiskFromSql,
    fetchPdRiskHistoryFromSql,
    fetchSharedPortfolioFromSql,
    fetchCaptacionesFromSql,
    fetchCaptacionesHistoryFromSql,
    fetchMaduracionFromSql,
    fetchLcfFromSql
} from './sql.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '127.0.0.1';

app.use(cors());
app.use(express.json({limit: '1mb'}));

const money = (value) => Number(value || 0);
const pct = (value) => (value === null || value === undefined ? null : Number(value));

async function sqlMode() {
    const pool = await getPool();
    return {mode: pool ? 'sql-server' : 'mock'};
}

function mapProjectionRows(rows = []) {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    return rows.map((row) => {
        const fecha = row.Fecha ? new Date(row.Fecha) : null;
        const monthIndex = fecha && !Number.isNaN(fecha.getTime()) ? fecha.getMonth() : null;

        return {
            fecha: row.Fecha,
            month: monthIndex !== null ? monthNames[monthIndex] : String(row.Fecha || ''),
            producto: row.Producto,
            tipoDato: row.TipoDato,
            desembolso: Number(row.DesembolsoUSD || 0) / 1_000_000,
            amortizacion: Number(row.AmortizacionUSD || 0) / 1_000_000
        };
    });
}

function normalizeMulti(value, allValue) {
    if (!value) return null;

    const values = String(value)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .filter((v) => v !== allValue);

    return values.length ? values : null;
}

function parseFilters(req) {
    const {fecha, sucursal, producto, banco, agencia} = req.query;

    return {
        fecha: fecha || null,
        sucursal: normalizeMulti(sucursal, 'TODAS'),
        producto: normalizeMulti(producto, 'TODOS'),
        banco: banco && banco !== 'TODOS' ? banco : null,
        agencia: normalizeMulti(agencia, 'TODAS')
    };
}

function emptySummaryWithAlerts() {
    const data = {
        fechaCorte: null,
        stockActual: 0,
        stockBase: 0,
        crecimientoPct: null,
        crecimientoNominal: 0,
        desembolsosAcum: 0,
        desembolsosMes: 0,
        desembolsosVariacionPct: null,
        pendiente: 0,
        amortizacion: 0,
        amortizacionMes: 0,
        presupuesto: 0,
        cumplimientoPct: null,
        brechaPresupuesto: 0,
        estado: 'Critico',
        score: 'B'
    };

    return {...data, alerts: buildDynamicAlerts(data)};
}

function normalizeSummary(row) {
    return {
        fechaCorte: row.FechaCorte,
        stockActual: money(row.StockActualUSD),
        stockBase: money(row.StockBaseUSD),
        crecimientoPct: pct(row.CrecimientoPct),
        crecimientoNominal: money(row.CrecimientoNominalUSD),
        desembolsosAcum: money(row.DesembolsoUSD),
        desembolsosMes: money(row.DesembolsoMesUSD),
        desembolsosVariacionPct: null,
        pendiente: money(row.PendienteUSD),
        amortizacion: money(row.AmortizacionUSD),
        amortizacionMes: money(row.AmortizacionMesUSD),
        presupuesto: money(row.PresupuestoStockUSD),
        cumplimientoPct: pct(row.CumplimientoStockPct),
        brechaPresupuesto: money(row.BrechaPresupuestoUSD),
        estado:
            pct(row.CumplimientoStockPct) >= 100 ? 'Sobresaliente' :
                pct(row.CumplimientoStockPct) >= 90 ? 'En vigilancia' : 'Critico',
        score:
            pct(row.CumplimientoStockPct) >= 100 ? 'A+' :
                pct(row.CumplimientoStockPct) >= 90 ? 'A-' : 'B'
    };
}

function buildDynamicAlerts(data) {
    const alerts = [];

    const cumplimiento = Number(data.cumplimientoPct || 0);
    const brecha = Number(data.brechaPresupuesto || 0);
    const crecimiento = Number(data.crecimientoPct || 0);
    const desembolsos = Number(data.desembolsosAcum || 0);
    const amortizacion = Number(data.amortizacion || 0);

    alerts.push({
        id: 'brecha-presupuestaria',
        emoji: cumplimiento >= 100 ? '✅' : '🚨',
        level: cumplimiento >= 100 ? 'success' : 'danger',
        title: `Cumplimiento presupuestario — ${cumplimiento.toFixed(2)}%`,
        body: cumplimiento >= 100
            ? `${formatShort(Math.abs(brecha))} por encima del presupuesto de stock.`
            : `${formatShort(Math.abs(brecha))} por debajo del presupuesto de stock.`,
        badge: cumplimiento >= 100 ? 'Positivo' : 'Alta'
    });

    alerts.push({
        id: 'crecimiento-cartera',
        emoji: crecimiento >= 0 ? '📈' : '📉',
        level: crecimiento >= 0 ? 'success' : 'danger',
        title: `Crecimiento de cartera — ${crecimiento.toFixed(2)}%`,
        body: crecimiento >= 0
            ? 'Crecimiento positivo frente a la base de diciembre.'
            : 'Contracción frente a la base de diciembre.',
        badge: crecimiento >= 0 ? 'Positivo' : 'Alta'
    });

    alerts.push({
        id: 'desembolsos-acumulados',
        emoji: desembolsos > 0 ? '✅' : '⚠️',
        level: desembolsos > 0 ? 'success' : 'warning',
        title: 'Desembolsos acumulados del año',
        body: `${formatShort(desembolsos)} acumulados al corte seleccionado.`,
        badge: desembolsos > 0 ? 'Positivo' : 'Media'
    });

    alerts.push({
        id: 'amortizacion',
        emoji: amortizacion > desembolsos ? '🚨' : '🔁',
        level: amortizacion > desembolsos ? 'danger' : 'info',
        title: 'Amortización acumulada del año',
        body: `${formatShort(amortizacion)} registrados en amortización al corte seleccionado.`,
        badge: amortizacion > desembolsos ? 'Alta' : 'Info'
    });

    return alerts;
}

function parseMulti(value) {
    if (value === undefined || value === null || value === '') return null;

    if (Array.isArray(value)) {
        const clean = value
            .map((v) => String(v || '').trim())
            .filter(Boolean)
            .filter((v) => v !== 'TODOS' && v !== 'TODAS');

        return clean.length ? clean : null;
    }

    const text = String(value || '').trim();

    if (!text || text === 'TODOS' || text === 'TODAS') return null;

    const values = text
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .filter((v) => v !== 'TODOS' && v !== 'TODAS');

    return values.length ? values : null;
}

function buildKpisFromSummary(data) {
    return [
        {
            key: 'stock',
            label: 'Stock actual',
            value: data.stockActual,
            unit: 'money',
            delta: data.crecimientoPct,
            deltaLabel: 'vs Dic-25',
            severity: data.crecimientoPct >= 0 ? 'success' : 'danger',
            icon: 'chart-line'
        },
        {
            key: 'growth',
            label: 'Crecimiento vs Dic 25',
            value: data.crecimientoPct,
            unit: 'percent',
            delta: data.crecimientoPct,
            deltaLabel: `${formatShort(data.crecimientoNominal)} absoluto`,
            severity: data.crecimientoPct >= 0 ? 'success' : 'danger',
            icon: 'arrow-trend-up'
        },
        {
            key: 'disbursement',
            label: 'Desembolsos acumulados',
            value: data.desembolsosAcum,
            unit: 'money',
            delta: null,
            deltaLabel: 'acumulado anual al corte',
            severity: 'success',
            icon: 'sack-dollar'
        },
        {
            key: 'amortization',
            label: 'Amortización acumulada',
            value: data.amortizacion,
            unit: 'money',
            delta: null,
            deltaLabel: 'acumulado anual al corte',
            severity: 'warning',
            icon: 'rotate'
        },
        {
            key: 'budget',
            label: 'Stock presupuestado',
            value: data.presupuesto,
            unit: 'money',
            delta: null,
            deltaLabel: 'meta de stock vigente',
            severity: 'info',
            icon: 'bullseye'
        },
        {
            key: 'compliance',
            label: 'Cumplimiento presup.',
            value: data.cumplimientoPct,
            unit: 'percent',
            delta: data.cumplimientoPct ? data.cumplimientoPct - 100 : null,
            deltaLabel: `${formatShort(data.brechaPresupuesto)} vs presupuesto`,
            severity: data.cumplimientoPct >= 100 ? 'success' : 'danger',
            icon: 'triangle-exclamation'
        }
    ];
}

function formatShort(value) {
    if (value === null || value === undefined) return 'N/A';

    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '+';

    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${sign}$${Math.round(abs / 1_000_000).toLocaleString('en-US')}M`;

    return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

app.get('/api/health', async (_req, res) => {
    res.json({ok: true, ...await sqlMode()});
});

app.get('/api/catalogs', async (_req, res, next) => {
    try {
        const fromSql = await fetchCatalogsFromSql();
        if (fromSql) {
            return res.json({data: fromSql, ...await sqlMode()});
        }

        res.json({data: catalogs, ...await sqlMode()});
    } catch (error) {
        next(error);
    }
});

app.get('/api/cartera/summary', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await query(queries.summary, {
            fecha: f.fecha,
            sucursal: f.sucursal,
            producto: f.producto,
            agencia: f.agencia
        });

        let data;
        if (result === null) {
            data = {...summary, alerts: buildDynamicAlerts(summary)};
        } else if (!result.recordset?.[0]) {
            data = emptySummaryWithAlerts();
        } else {
            const normalized = normalizeSummary(result.recordset[0]);
            data = {...normalized, alerts: buildDynamicAlerts(normalized)};
        }

        res.json({
            data,
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/cartera/kpis', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await query(queries.summary, {
            fecha: f.fecha,
            sucursal: f.sucursal,
            producto: f.producto,
            agencia: f.agencia
        });

        let data;
        if (result === null) {
            data = kpis;
        } else if (!result.recordset?.[0]) {
            data = buildKpisFromSummary(emptySummaryWithAlerts());
        } else {
            data = buildKpisFromSummary(normalizeSummary(result.recordset[0]));
        }

        res.json({data, ...await sqlMode()});
    } catch (error) {
        next(error);
    }
});

app.get('/api/cartera/timeseries', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await query(queries.timeseries, {
            sucursal: f.sucursal,
            producto: f.producto,
            agencia: f.agencia
        });

        let data;
        if (result === null) {
            data = timeSeries;
        } else if (!result.recordset?.length) {
            data = [];
        } else {
            data = result.recordset.map((row) => ({
                month: new Intl.DateTimeFormat('es-BO', {month: 'short'}).format(new Date(row.fecha)),
                fecha: row.fecha,
                desembolso: money(row.DesembolsoUSD) / 1_000_000,
                amortizacion: money(row.AmortizacionUSD) / 1_000_000,
                stock: money(row.StockActualUSD) / 1_000_000,
                presupuesto: money(row.PresupuestoStockUSD) / 1_000_000,
                cumplimientoPct: pct(row.CumplimientoStockPct)
            }));
        }

        res.json({data, ...await sqlMode()});
    } catch (error) {
        next(error);
    }
});

app.get('/api/cartera/projection', async (req, res, next) => {
    try {
        const scenario = ['base', 'optimista', 'conservador'].includes(req.query.scenario)
            ? req.query.scenario
            : 'base';

        const f = parseFilters(req);

        const result = await fetchProjectionFromSql(scenario, {
            fecha: f.fecha,
            sucursal: f.sucursal,
            producto: f.producto,
            agencia: f.agencia
        });

        if (result === null) {
            return res.json({
                data: getProjection(scenario),
                scenario,
                ...await sqlMode()
            });
        }

        const rows = mapProjectionRows(result.recordset || []);

        const groupedByMonth = new Map();

        rows.forEach((row) => {
            const key = `${row.fecha}-${row.month}-${row.tipoDato}`;

            if (!groupedByMonth.has(key)) {
                groupedByMonth.set(key, {
                    fecha: row.fecha,
                    month: row.month,
                    tipoDato: row.tipoDato,
                    desembolso: 0,
                    amortizacion: 0
                });
            }

            const current = groupedByMonth.get(key);
            current.desembolso += Number(row.desembolso || 0);
            current.amortizacion += Number(row.amortizacion || 0);
        });

        res.json({
            data: Array.from(groupedByMonth.values()),
            scenario,
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/cartera/projection-by-product', async (req, res, next) => {
    try {
        const scenario = ['base', 'optimista', 'conservador'].includes(req.query.scenario)
            ? req.query.scenario
            : 'base';

        const product = req.query.product || 'TODOS';
        const f = parseFilters(req);

        const result = await fetchProjectionByProductFromSql(scenario, product, {
            fecha: f.fecha,
            sucursal: f.sucursal,
            agencia: f.agencia
        });

        if (result === null) {
            return res.json({
                data: getProjectionByProduct(scenario, product),
                ...await sqlMode()
            });
        }

        res.json({
            data: mapProjectionRows(result.recordset || []),
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/cartera/kpis-by-product', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await query(queries.kpisByProduct, {
            fecha: f.fecha,
            sucursal: f.sucursal,
            producto: f.producto,
            agencia: f.agencia
        });

        let data;
        if (result === null) {
            data = kpisByProduct;
        } else if (!result.recordset?.length) {
            data = [];
        } else {
            data = result.recordset.map((row) => {
                const stockActual = money(row.StockActualUSD);
                const stockBase = money(row.StockBaseUSD);

                return {
                    producto: row.Producto,
                    stock: stockActual,
                    stockBase,
                    crecimientoMonto: row.CrecimientoNominalUSD !== null && row.CrecimientoNominalUSD !== undefined
                        ? money(row.CrecimientoNominalUSD)
                        : stockActual - stockBase,
                    crecimientoPct: pct(row.CrecimientoPct),
                    desembolsos: money(row.DesembolsoAcumuladoAnioUSD),
                    amortizacion: money(row.AmortizacionAcumuladaAnioUSD),
                    presupuesto: money(row.PresupuestoStockUSD),
                    cumplimientoPct: pct(row.CumplimientoStockPct)
                };
            });
        }

        res.json({data, ...await sqlMode()});
    } catch (error) {
        next(error);
    }
});

app.get('/api/sistema-financiero/benchmark', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await query(queries.benchmark, {
            fecha: f.fecha,
            sucursal: f.sucursal,
            banco: f.banco,
            producto: f.producto
        });

        if (result === null) {
            return res.json({data: benchmark, ...await sqlMode()});
        }

        if (!result.recordset?.length) {
            return res.json({data: [], ...await sqlMode()});
        }

        const data = result.recordset.map((row) => ({
            fechaCorteSF: row.FechaCorteSF,
            banco: row.banco,
            producto: row.segmentacioncredito,
            crecimientoPct: pct(row.CrecimientoPct),
            crecimientoTotal: money(row.CrecimientoTotalUSD),
            stock: money(row.MontoActualUSD),
            stockBase: money(row.MontoBaseUSD),
            total: money(row.MontoActualUSD)
        }));

        res.json({
            data,
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/sistema-financiero/market-share', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await query(queries.marketShare, {
            fecha: f.fecha,
            sucursal: f.sucursal,
            producto: f.producto
        });

        let data;
        if (result === null) {
            data = marketShare;
        } else if (!result.recordset?.length) {
            data = [];
        } else {
            data = result.recordset.map((row) => ({
                fechaCorteSF: row.FechaCorteSF,
                segmentacioncredito: row.segmentacioncredito,
                montoBNB: money(row.MontoBNBUSD),
                montoSistema: money(row.MontoSistemaFinancieroUSD),
                montoSistemaBase: money(row.MontoSistemaBaseUSD),
                crecimientoTotal: money(row.CrecimientoTotalUSD),
                participacionPct: pct(row.ParticipacionBNBPct),
                crecimientoPct: pct(row.CrecimientoPct)
            }));
        }

        res.json({
            data,
            note: 'El denominador incluye todo el sistema financiero, incluido BNB.',
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/oficiales/ranking', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await query(queries.oficiales, {
            fecha: f.fecha,
            sucursal: f.sucursal,
            agencia: f.agencia
        });

        let data;
        if (result === null) {
            data = oficiales;
        } else if (!result.recordset?.length) {
            data = [];
        } else {
            data = result.recordset.map((row) => ({
                oficial: row.Oficial,
                sucursal: row.Sucursal,
                codAgencia: row.Cod_Agencia,
                nombreAgencia: row.NombreAgencia,
                desembolso: money(row.DesembolsoOficialUSD),
                participacionAportePct:
                    row.ParticipacionAportePct === null || row.ParticipacionAportePct === undefined
                        ? null
                        : Number(row.ParticipacionAportePct)
            }));
        }

        res.json({data, ...await sqlMode()});
    } catch (error) {
        next(error);
    }
});

app.get('/api/fuentes/status', async (_req, res, next) => {
    try {
        const result = await query(queries.status);

        const sqlDates = Object.fromEntries(
            (result?.recordset || []).map((row) => [row.Fuente, row.FechaCorte])
        );

        res.json({
            data: [
                {
                    fuente: 'Hub_CarteraBNB',
                    tipo: 'SQL Server',
                    tabla: 'Hub_CarteraBNB',
                    fechaCorte: sqlDates.Hub_CarteraBNB || dates.cartera,
                    estado: 'Vigente'
                },
                {
                    fuente: 'Hub_CarteraSF',
                    tipo: 'SQL Server',
                    tabla: 'Hub_CarteraSF',
                    fechaCorte: sqlDates.Hub_CarteraSF || dates.sistema,
                    estado: 'Vigente'
                },
                {
                    fuente: 'Hub_OONN',
                    tipo: 'SQL Server',
                    tabla: 'Hub_OONN',
                    fechaCorte: sqlDates.Hub_OONN || dates.oficiales,
                    estado: 'Vigente'
                },
                {
                    fuente: 'DimAgencia',
                    tipo: 'Dimension',
                    tabla: 'DimAgencia',
                    fechaCorte: sqlDates.Hub_CarteraBNB || dates.cartera,
                    estado: 'Activa'
                },
                {
                    fuente: 'Captaciones',
                    tipo: 'SQL Server',
                    tabla: 'Hub_Captaciones',
                    fechaCorte: sqlDates.Hub_Captaciones || null,
                    estado: 'Activa'
                },
                {
                    fuente: 'Hub_CarteraSF_COMPARTIDA',
                    tipo: 'SQL Server',
                    tabla: 'Hub_CarteraSF_COMPARTIDA',
                    fechaCorte: sqlDates.Hub_CarteraSF_COMPARTIDA || null,
                    estado: 'Vigente'
                },
                {
                    fuente: 'Hub_Maduracion',
                    tipo: 'SQL Server',
                    tabla: 'Hub_Maduracion',
                    fechaCorte: sqlDates.Hub_Maduracion || null,
                    estado: 'Activa'
                },
                {
                    fuente: 'Hub_LCF',
                    tipo: 'SQL Server',
                    tabla: 'Hub_LCF',
                    fechaCorte: sqlDates.Hub_LCF || null,
                    estado: 'Activa'
                }
            ],
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/agent/query', async (req, res, next) => {
    try {
        const rawPrompt = String(req.body?.message || '').trim();
        const useMcp = req.body?.useMcp === true;

        if (!rawPrompt) {
            return res.status(400).json({error: 'message is required'});
        }

        const url = process.env.ANYTHING_LLM_URL;
        const workspace = process.env.ANYTHING_LLM_WORKSPACE;
        const apiKey = process.env.ANYTHING_LLM_API_KEY;

        if (url && workspace && apiKey) {
            let cleanPrompt = rawPrompt;

            if (!useMcp) {
                cleanPrompt = cleanPrompt
                    .replace(/@agent/gi, '')
                    .replace(/consultar_datos_comerciales/gi, '')
                    .replace(/mcp-comercial/gi, '')
                    .replace(/mcp comercial/gi, '')
                    .replace(/\bMCP\b/gi, '')
                    .trim();
            }

            const finalMessage = useMcp
                ? `
MODO MCP ACTIVADO.

Usa el MCP comercial solamente si la consulta requiere datos reales de cartera.
Herramienta permitida: consultar_datos_comerciales.

Consulta:
${cleanPrompt}
`.trim()
                : `
MODO CHAT NORMAL.

Reglas obligatorias:
- No uses MCP.
- No uses @agent.
- No invoques herramientas.
- No ejecutes consultar_datos_comerciales.
- No intentes consultar bases de datos.
- Responde como chat normal.
- Si el usuario pide datos exactos no disponibles en el contexto, indica que debe activar MCP.

Consulta:
${cleanPrompt}
`.trim();

            const response = await fetch(`${url}/api/v1/workspace/${workspace}/chat`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: finalMessage,
                    mode: 'chat'
                })
            });

            if (!response.ok) {
                const text = await response.text();

                console.error('AnythingLLM API error:', {
                    status: response.status,
                    body: text
                });

                let parsed = null;

                try {
                    parsed = JSON.parse(text);
                } catch {
                    parsed = null;
                }

                const anythingError = parsed?.error || text || '';

                if (
                    anythingError.includes('Ollama instance could not be reached') ||
                    anythingError.toLowerCase().includes('ollama')
                ) {
                    return res.status(502).json({
                        error: 'AnythingLLM no pudo conectarse a Ollama.',
                        detail: 'Verifica que Ollama esté levantado y que AnythingLLM tenga configurada correctamente la URL del proveedor LLM.'
                    });
                }

                return res.status(502).json({
                    error: 'AnythingLLM devolvió un error.',
                    detail: anythingError
                });
            }

            const data = await response.json();
            const answer = data.textResponse || data.text || data.response || 'Sin respuesta del modelo.';

            return res.json({
                data: {
                    answer,
                    citations: []
                },
                ...await sqlMode()
            });
        }

        return res.json({
            data: {
                answer: buildAgentAnswer(rawPrompt),
                citations: ['Hub_CarteraBNB', 'Hub_CarteraSF', 'Hub_OONN', 'DimAgencia']
            },
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/cartera/pd-risk', async (req, res) => {
    try {
        const params = {
            fecha: req.query.fecha || null,
            sucursal: parseMulti(req.query.sucursal),
            producto: parseMulti(req.query.producto),
            agencia: parseMulti(req.query.agencia)
        };

        const result = await fetchPdRiskFromSql(params);

        if (result) {
            return res.json({
                data: result.recordset.map((row) => ({
                    fecha: row.Fecha,
                    producto: row.Producto,
                    codAgencia: row.Cod_Agencia,
                    nombreAgencia: row.NombreAgencia,
                    sucursal: row.Sucursal,
                    alto: Number(row.Alto || 0),
                    media: Number(row.Media || 0),
                    baja: Number(row.Baja || 0),
                    totalOperaciones: Number(row.TotalOperaciones || 0),
                    altoPct: row.AltoPct === null || row.AltoPct === undefined ? null : Number(row.AltoPct),
                    mediaPct: row.MediaPct === null || row.MediaPct === undefined ? null : Number(row.MediaPct),
                    bajaPct: row.BajaPct === null || row.BajaPct === undefined ? null : Number(row.BajaPct)
                })),
                ...await sqlMode()
            });
        }

        return res.json({
            data: [],
            ...await sqlMode()
        });
    } catch (error) {
        console.error('GET /api/cartera/pd-risk:', error);

        return res.status(500).json({
            error: 'No se pudo obtener la información de riesgo predictivo.',
            detail: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

app.get('/api/cartera/pd-risk-history', async (req, res) => {
    try {
        const params = {
            sucursal: parseMulti(req.query.sucursal),
            producto: parseMulti(req.query.producto),
            agencia: parseMulti(req.query.agencia)
        };

        const result = await fetchPdRiskHistoryFromSql(params);

        if (result) {
            return res.json({
                data: result.recordset.map((row) => {
                    const alto = Number(row.Alto || 0);
                    const media = Number(row.Media || 0);
                    const baja = Number(row.Baja || 0);
                    const total = alto + media + baja;

                    return {
                        fecha: row.Fecha,
                        producto: row.Producto,
                        codAgencia: row.Cod_Agencia,
                        nombreAgencia: row.NombreAgencia,
                        sucursal: row.Sucursal,
                        alto,
                        media,
                        baja,
                        totalOperaciones: total,
                        altoPct: total > 0 ? (alto * 100) / total : null,
                        mediaPct: total > 0 ? (media * 100) / total : null,
                        bajaPct: total > 0 ? (baja * 100) / total : null
                    };
                }),
                ...await sqlMode()
            });
        }

        return res.json({
            data: [],
            ...await sqlMode()
        });
    } catch (error) {
        console.error('GET /api/cartera/pd-risk-history:', error);

        return res.status(500).json({
            error: 'No se pudo obtener el histórico de riesgo predictivo.',
            detail: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

function buildAgentAnswer(prompt) {
    const n = prompt.toLowerCase();

    if (n.includes('presupuesto') || n.includes('brecha') || n.includes('cumplimiento')) {
        return `La métrica de cumplimiento se calcula como SUM(stock) / SUM(presupuesto) * 100 sobre Hub_CarteraBNB al corte seleccionado.`;
    }

    if (n.includes('competencia') || n.includes('sistema') || n.includes('banco')) {
        return 'Para sistema financiero se usa Hub_CarteraSF. BNB se filtra con banco = BNB y la participación se calcula contra el total del sistema, incluyendo BNB en el denominador.';
    }

    if (n.includes('oficial') || n.includes('ejecutivo') || n.includes('asesor')) {
        return 'Para oficiales se usa Hub_OONN y la métrica oficial es SUM(MontoDesembolsoDolares). Si se requiere sucursal o agencia, se une DimAgencia por Cod_Agencia = ID_AGENCIA.';
    }

    return 'Puedo analizar stock, desembolsos, amortización, pendiente, presupuesto, cumplimiento, participación de mercado y rankings. Las consultas se restringen a SELECT/WITH y a las tablas declaradas del dominio comercial.';
}

app.use((error, _req, res, _next) => {
    console.error(error);

    res.status(500).json({
        error: 'Hub API error',
        detail: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
});

app.listen(port, host, () => {
    console.log(`Hub Analitico BNB API listening on http://${host}:${port}`);
    sqlMode().then(m => console.log(`Data mode: ${m.mode}`));
});

app.get('/api/sistema-financiero/cartera-compartida', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await fetchSharedPortfolioFromSql({
            fecha: f.fecha,
            sucursal: f.sucursal,
            producto: f.producto,
            agencia: f.agencia
        });

        if (!result) {
            return res.json({
                data: [],
                ...await sqlMode()
            });
        }

        const data = (result.recordset || []).map((row) => {
            const bancos = {
                BNB: money(row.BNB),
                BIS: money(row.BIS),
                BCR: money(row.BCR),
                BEC: money(row.BEC),
                BIE: money(row.BIE),
                BGA: money(row.BGA),
                BME: money(row.BME),
                BSO: money(row.BSO),
                OTRO: money(row.OTRO)
            };

            return {
                fecha: row.Fecha,
                segmento: row.Segmento,
                codAgencia: row.Cod_Agencia,
                nombreAgencia: row.NombreAgencia,
                sucursal: row.Sucursal,

                clientesCompartidos: Number(row.ClientesCompartidos || 0),

                bnb: bancos.BNB,
                bis: bancos.BIS,
                bcr: bancos.BCR,
                bec: bancos.BEC,
                bie: bancos.BIE,
                bga: bancos.BGA,
                bme: bancos.BME,
                bso: bancos.BSO,
                otro: bancos.OTRO,

                otrosBancos: money(row.OtrosBancos),
                totalCompartido: money(row.TotalCompartido),
                participacionBNBPct: pct(row.ParticipacionBNBPct),
                participacionOtrosPct: pct(row.ParticipacionOtrosPct),

                bancos
            };
        });

        return res.json({
            data,
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/captaciones/desempeno', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await fetchCaptacionesFromSql({
            fecha: f.fecha,
            sucursal: f.sucursal,
            agencia: f.agencia
        });

        if (!result) {
            return res.json({
                data: [],
                ...await sqlMode()
            });
        }

        const data = (result.recordset || []).map((row) => ({
            fecha: row.Fecha,
            codAgencia: row.Cod_Agencia,
            nombreAgencia: row.NombreAgencia,
            sucursal: row.Sucursal,

            ejecutadaCaptaciones: Number(row.EjecutadaCaptaciones || 0),
            presupuestadaCaptaciones: Number(row.PresupuestadaCaptaciones || 0),
            brechaCaptaciones: Number(row.BrechaCaptaciones || 0),
            cumplimientoCaptacionesPct:
                row.CumplimientoCaptacionesPct === null || row.CumplimientoCaptacionesPct === undefined
                    ? null
                    : Number(row.CumplimientoCaptacionesPct),

            ejecutadaVista: Number(row.EjecutadaVista || 0),
            presupuestadaVista: Number(row.PresupuestadaVista || 0),
            brechaVista: Number(row.BrechaVista || 0),
            cumplimientoVistaPct:
                row.CumplimientoVistaPct === null || row.CumplimientoVistaPct === undefined
                    ? null
                    : Number(row.CumplimientoVistaPct),

            ejecutadaAhorros: Number(row.EjecutadaAhorros || 0),
            presupuestadaAhorros: Number(row.PresupuestadaAhorros || 0),
            brechaAhorros: Number(row.BrechaAhorros || 0),
            cumplimientoAhorrosPct:
                row.CumplimientoAhorrosPct === null || row.CumplimientoAhorrosPct === undefined
                    ? null
                    : Number(row.CumplimientoAhorrosPct),

            ejecutadaPlazo: Number(row.EjecutadaPlazo || 0),
            presupuestadaPlazo: Number(row.PresupuestadaPlazo || 0),
            brechaPlazo: Number(row.BrechaPlazo || 0),
            cumplimientoPlazoPct:
                row.CumplimientoPlazoPct === null || row.CumplimientoPlazoPct === undefined
                    ? null
                    : Number(row.CumplimientoPlazoPct),

            tendenciaCaptaciones: Number(row.TendenciaCaptaciones || 0),
            categoriaTendencia: row.CategoriaTendencia || 'N/D'
        }));

        return res.json({
            data,
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/captaciones/historico', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await fetchCaptacionesHistoryFromSql({
            sucursal: f.sucursal,
            agencia: f.agencia
        });

        if (!result) {
            return res.json({
                data: [],
                ...await sqlMode()
            });
        }

        const data = (result.recordset || []).map((row) => ({
            fecha: row.Fecha,

            ejecutadaCaptaciones: Number(row.EjecutadaCaptaciones || 0),
            presupuestadaCaptaciones: Number(row.PresupuestadaCaptaciones || 0),
            brechaCaptaciones: Number(row.BrechaCaptaciones || 0),
            cumplimientoCaptacionesPct:
                row.CumplimientoCaptacionesPct === null || row.CumplimientoCaptacionesPct === undefined
                    ? null
                    : Number(row.CumplimientoCaptacionesPct),

            ejecutadaVista: Number(row.EjecutadaVista || 0),
            presupuestadaVista: Number(row.PresupuestadaVista || 0),
            brechaVista: Number(row.BrechaVista || 0),
            cumplimientoVistaPct:
                row.CumplimientoVistaPct === null || row.CumplimientoVistaPct === undefined
                    ? null
                    : Number(row.CumplimientoVistaPct),

            ejecutadaAhorros: Number(row.EjecutadaAhorros || 0),
            presupuestadaAhorros: Number(row.PresupuestadaAhorros || 0),
            brechaAhorros: Number(row.BrechaAhorros || 0),
            cumplimientoAhorrosPct:
                row.CumplimientoAhorrosPct === null || row.CumplimientoAhorrosPct === undefined
                    ? null
                    : Number(row.CumplimientoAhorrosPct),

            ejecutadaPlazo: Number(row.EjecutadaPlazo || 0),
            presupuestadaPlazo: Number(row.PresupuestadaPlazo || 0),
            brechaPlazo: Number(row.BrechaPlazo || 0),
            cumplimientoPlazoPct:
                row.CumplimientoPlazoPct === null || row.CumplimientoPlazoPct === undefined
                    ? null
                    : Number(row.CumplimientoPlazoPct),

            tendenciaCaptaciones: Number(row.TendenciaCaptaciones || 0)
        }));

        return res.json({
            data,
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/oportunidades/maduracion', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await fetchMaduracionFromSql({
            fecha: f.fecha,
            sucursal: f.sucursal,
            producto: f.producto,
            agencia: f.agencia
        });

        if (!result) {
            return res.json({
                data: [],
                ...await sqlMode()
            });
        }

        const data = (result.recordset || []).map((row) => ({
            fecha: row.Fecha,
            producto: row.Producto,
            codAgencia: row.Cod_Agencia,
            nombreAgencia: row.NombreAgencia,
            sucursal: row.Sucursal,

            stock: money(row.StockUSD),
            montoDesembolso: money(row.MontoDesembolsoUSD),
            maduracionPct: pct(row.MaduracionPct),
            amortizadoEstimado: money(row.AmortizadoEstimadoUSD),
            saldoSobreDesembolsoPct: pct(row.SaldoSobreDesembolsoPct)
        }));

        return res.json({
            data,
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/oportunidades/lcf', async (req, res, next) => {
    try {
        const f = parseFilters(req);

        const result = await fetchLcfFromSql({
            fecha: f.fecha,
            sucursal: f.sucursal,
            producto: f.producto,
            agencia: f.agencia
        });

        if (!result) {
            return res.json({
                data: [],
                ...await sqlMode()
            });
        }

        const data = (result.recordset || []).map((row) => ({
            fecha: row.Fecha,
            producto: row.Producto,
            codAgencia: row.Cod_Agencia,
            nombreAgencia: row.NombreAgencia,
            sucursal: row.Sucursal,

            montoAutorizado: money(row.MontoAutorizadoUSD),
            saldoActivado: money(row.SaldoActivadoUSD),
            cupoNoUtilizado: money(row.CupoNoUtilizadoUSD),
            activacionPct: pct(row.ActivacionPct),
            cupoNoUtilizadoPct: pct(row.CupoNoUtilizadoPct)
        }));

        return res.json({
            data,
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
    }
});