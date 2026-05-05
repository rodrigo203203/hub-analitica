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
import {fetchCatalogsFromSql, getPool, hasSqlConfig, queries, query} from './sql.js';

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
                month: new Intl.DateTimeFormat('es-BO', {month: 'short'}).format(new Date(row.fechadata)),
                fecha: row.fechadata,
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

app.get('/api/cartera/projection', async (req, res) => {
    const scenario = ['base', 'optimista', 'conservador'].includes(req.query.scenario)
        ? req.query.scenario
        : 'base';

    res.json({
        data: getProjection(scenario),
        scenario,
        ...await sqlMode()
    });
});

app.get('/api/cartera/projection-by-product', async (req, res) => {
    const scenario = req.query.scenario || 'base';
    const product = req.query.product || 'TODOS';

    res.json({
        data: getProjectionByProduct(scenario, product),
        ...await sqlMode()
    });
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
            data = result.recordset.map((row) => ({
                producto: row.Producto,
                stock: money(row.StockActualUSD),
                crecimientoPct: pct(row.CrecimientoPct),
                desembolsos: money(row.DesembolsoAcumuladoAnioUSD),
                amortizacion: money(row.AmortizacionAcumuladaAnioUSD),
                presupuesto: money(row.PresupuestoStockUSD),
                cumplimientoPct: pct(row.CumplimientoStockPct)
            }));
        }

        res.json({ data, ...await sqlMode() });
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
            banco: row.banco,
            sucursal: row.Sucursal,
            producto: row.segmentacioncredito,
            crecimientoPct: pct(row.CrecimientoPct),
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
                segmentacioncredito: row.segmentacioncredito,
                montoBNB: money(row.MontoBNBUSD),
                montoSistema: money(row.MontoSistemaFinancieroUSD),
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
                participacionSucursalPct:
                    row.ParticipacionSucursalPct === null || row.ParticipacionSucursalPct === undefined
                        ? null
                        : Number(row.ParticipacionSucursalPct)
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
                    tipo: 'Pendiente',
                    tabla: 'Sin fuente declarada',
                    fechaCorte: null,
                    estado: 'Pendiente'
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
        const prompt = String(req.body?.message || '').trim();

        if (!prompt) {
            return res.status(400).json({error: 'message is required'});
        }

        const url = process.env.ANYTHING_LLM_URL;
        const workspace = process.env.ANYTHING_LLM_WORKSPACE;
        const apiKey = process.env.ANYTHING_LLM_API_KEY;

        if (url && workspace && apiKey) {
            const finalMessage = `${prompt}\n\nPor favor usa el mcp 'Mcp Comerial' ejecutando el comando consultar_datos_comerciales.`;

            const response = await fetch(`${url}/api/v1/workspace/${workspace}/chat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: finalMessage,
                    mode: 'chat'
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`AnythingLLM error: ${response.status} ${text}`);
            }

            const data = await response.json();
            const answer = data.textResponse || data.text || data.response || "Sin respuesta del modelo.";

            return res.json({
                data: {
                    answer,
                    citations: []
                },
                ...await sqlMode()
            });
        }

        res.json({
            data: {
                answer: buildAgentAnswer(prompt),
                citations: ['Hub_CarteraBNB', 'Hub_CarteraSF', 'Hub_OONN', 'DimAgencia']
            },
            ...await sqlMode()
        });
    } catch (error) {
        next(error);
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