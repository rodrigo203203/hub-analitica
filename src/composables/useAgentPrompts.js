/**
 * composables/useAgentPrompts.js — Builders de prompts y triggers del agente IA.
 * Lee datos desde Pinia stores; usa datos completos en análisis integral.
 */

import { useChatStore } from '../stores/useChatStore.js';
import { useDataStore } from '../stores/useDataStore.js';
import { useFiltersStore } from '../stores/useFiltersStore.js';
import { useHubLogic } from './useHubLogic.js';
import { safeNumber, fmtMoneyPrompt, fmtPctPrompt, toPeriodYYYYMM } from '../utils/formatting.js';

const NO_LIMIT = Infinity;

function sliceRows(rows, limit) {
    if (!rows?.length) return [];
    if (limit === NO_LIMIT) return [...rows];
    return rows.slice(0, limit);
}

// ─── Builders de tablas ───────────────────────────────────────────────────────

export function buildAppliedFiltersText(filtersApplied) {
    const f = filtersApplied;
    const periodo = toPeriodYYYYMM(f.fecha);
    return `
Filtros aplicados:
- Periodo de corte: ${periodo}
- Formato del periodo: yyyymm
- Fecha original seleccionada: ${f.fecha || 'Última disponible'}
- Sucursales: ${(f.sucursal || []).join(', ') || 'TODAS'}
- Agencias: ${(f.agencia || []).join(', ') || 'TODAS'}
- Productos: ${(f.producto || []).join(', ') || 'TODOS'}
- Banco: ${f.banco || 'TODOS'}
`.trim();
}

export function buildExecutiveRulesText() {
    return `
Reglas comerciales obligatorias:
- El objetivo principal es alcanzar o superar el presupuesto de stock.
- Cumplimiento = stock actual / presupuesto * 100.
- Brecha negativa representa déficit contra presupuesto.
- Regla obligatoria de maduración: mayor maduración es peor y representa mayor prioridad comercial.
- Maduración crítica: >50%. Alerta: 30-50%. Normal: <30%.
- No inventes datos. Si falta un dato, indica "Dato no disponible".
`.trim();
}

export function buildSummaryText(summary) {
    if (!summary) return 'Resumen ejecutivo no disponible.';
    return `
Resumen ejecutivo de cartera:
| Métrica | Valor |
|---|---:|
| Periodo corte | ${toPeriodYYYYMM(summary.fechaCorte)} |
| Stock actual | ${fmtMoneyPrompt(summary.stockActual)} |
| Stock base Dic | ${fmtMoneyPrompt(summary.stockBase)} |
| Crecimiento nominal | ${fmtMoneyPrompt(summary.crecimientoNominal)} |
| Crecimiento % | ${fmtPctPrompt(summary.crecimientoPct)} |
| Desembolsos acumulados | ${fmtMoneyPrompt(summary.desembolsosAcum)} |
| Amortización acumulada | ${fmtMoneyPrompt(summary.amortizacion)} |
| Presupuesto stock | ${fmtMoneyPrompt(summary.presupuesto)} |
| Cumplimiento presupuesto | ${fmtPctPrompt(summary.cumplimientoPct)} |
| Brecha presupuesto | ${fmtMoneyPrompt(summary.brechaPresupuesto)} |
`.trim();
}

export function buildProductsTable(kpisProductData, limit = 20) {
    if (!kpisProductData?.length) return 'No hay detalle por producto disponible.';
    const rows = [...kpisProductData]
        .sort((a, b) => safeNumber(b.stock) - safeNumber(a.stock))
        .slice(0, limit === NO_LIMIT ? undefined : limit)
        .map((p) => {
            const brecha = safeNumber(p.stock) - safeNumber(p.presupuesto);
            return `| ${p.producto} | ${fmtMoneyPrompt(p.stock)} | ${fmtMoneyPrompt(p.presupuesto)} | ${fmtMoneyPrompt(brecha)} | ${fmtPctPrompt(p.cumplimientoPct)} | ${fmtPctPrompt(p.crecimientoPct)} |`;
        }).join('\n');
    return `
Detalle por producto:
| Producto | Stock | Presupuesto | Brecha | Cumplimiento | Crecimiento |
|---|---:|---:|---:|---:|---:|
${rows}
`.trim();
}

export function buildOfficialsTable(oficiales, limit = 15) {
    if (!oficiales?.length) return 'No hay ranking de oficiales disponible.';
    const rows = [...oficiales]
        .sort((a, b) => safeNumber(b.desembolso) - safeNumber(a.desembolso))
        .slice(0, limit === NO_LIMIT ? undefined : limit)
        .map((o, idx) => `| ${idx + 1} | ${o.oficial} | ${o.sucursal} | ${o.nombreAgencia} | ${fmtMoneyPrompt(o.desembolso)} | ${fmtPctPrompt(o.participacionAportePct)} |`)
        .join('\n');
    return `
Ranking de oficiales:
| Rank | Oficial | Sucursal | Agencia | Desembolso | % aporte |
|---:|---|---|---|---:|---:|
${rows}
`.trim();
}

export function buildTimeSeriesTable(filteredTimeSeries, limit = 12) {
    if (!filteredTimeSeries?.length) return 'No hay serie histórica disponible.';
    const src = limit === NO_LIMIT ? filteredTimeSeries : filteredTimeSeries.slice(-limit);
    const rows = src
        .map((t) => {
            const periodo = toPeriodYYYYMM(t.fecha || t.month);
            return `| ${periodo} | ${fmtMoneyPrompt(safeNumber(t.stock) * 1_000_000)} | ${fmtMoneyPrompt(safeNumber(t.presupuesto) * 1_000_000)} | ${fmtMoneyPrompt(safeNumber(t.desembolso) * 1_000_000)} | ${fmtMoneyPrompt(safeNumber(t.amortizacion) * 1_000_000)} | ${fmtPctPrompt(t.cumplimientoPct)} |`;
        }).join('\n');
    return `
Serie histórica:
| Periodo yyyymm | Stock | Presupuesto | Desembolso | Amortización | Cumplimiento |
|---|---:|---:|---:|---:|---:|
${rows}
`.trim();
}

export function buildMarketTable(marketShare, limit = 20) {
    if (!marketShare?.length) return 'No hay datos de participación de mercado disponibles.';
    const rows = [...marketShare]
        .sort((a, b) => safeNumber(b.crecimientoTotal) - safeNumber(a.crecimientoTotal))
        .slice(0, limit === NO_LIMIT ? undefined : limit)
        .map((m) => `| ${m.segmentacioncredito} | ${fmtMoneyPrompt(m.montoBNB)} | ${fmtMoneyPrompt(m.montoSistema)} | ${fmtPctPrompt(m.participacionPct)} | ${fmtMoneyPrompt(m.crecimientoTotal)} |`)
        .join('\n');
    return `
Participación BNB vs sistema financiero:
| Segmento | Monto BNB | Monto sistema | Participación BNB | Crecimiento |
|---|---:|---:|---:|---:|
${rows}
`.trim();
}

export function buildCompetitorBenchmarkTable(benchmark, limit = 100) {
    if (!benchmark?.length) return 'No hay datos de benchmark disponibles.';
    const rows = [...benchmark]
        .sort((a, b) => String(a.producto || '').localeCompare(String(b.producto || '')))
        .slice(0, limit === NO_LIMIT ? undefined : limit)
        .map((row) => `| ${row.banco || 'N/A'} | ${row.producto || 'N/A'} | ${fmtMoneyPrompt(row.stock ?? row.total ?? row.montoActual)} | ${fmtPctPrompt(row.crecimientoPct)} |`)
        .join('\n');
    return `
Benchmark por banco y producto:
| Banco | Producto | Stock | Crecimiento % |
|---|---|---:|---:|
${rows}
`.trim();
}

export function buildPdRiskTable(pdRisk, pdRiskTotals, limit = 20) {
    if (!pdRisk?.length) return 'No hay información de riesgo predictivo disponible.';
    const totals = pdRiskTotals || {};
    const rows = [...pdRisk]
        .sort((a, b) => safeNumber(b.alto) - safeNumber(a.alto))
        .slice(0, limit === NO_LIMIT ? undefined : limit)
        .map((r) => `| ${r.sucursal || 'N/D'} | ${r.nombreAgencia || r.codAgencia || 'N/D'} | ${r.producto || 'N/D'} | ${Number(r.alto || 0).toLocaleString('en-US')} | ${Number(r.media || 0).toLocaleString('en-US')} | ${fmtPctPrompt(r.altoPct)} |`)
        .join('\n');
    return `
Riesgo predictivo — Alta ${Number(totals.alto || 0).toLocaleString('en-US')} | Media ${Number(totals.media || 0).toLocaleString('en-US')}
| Sucursal | Agencia | Producto | Alta | Media | % Alta |
|---|---|---|---:|---:|---:|
${rows}
`.trim();
}

export function buildCaptacionesTable(captacionesByAgencia, captacionesTotals, limit = 20) {
    if (!captacionesByAgencia?.length) return 'No hay información de captaciones disponible.';
    const totals = captacionesTotals || {};
    const rows = [...captacionesByAgencia]
        .sort((a, b) => safeNumber(b.ejecutadaCaptaciones) - safeNumber(a.ejecutadaCaptaciones))
        .slice(0, limit === NO_LIMIT ? undefined : limit)
        .map((r) => `| ${r.sucursal || 'N/D'} | ${r.nombreAgencia || r.codAgencia || 'N/D'} | ${fmtMoneyPrompt(r.ejecutadaCaptaciones)} | ${fmtMoneyPrompt(r.presupuestadaCaptaciones)} | ${r.categoriaTendencia || 'N/D'} |`)
        .join('\n');
    return `
Captaciones — Ejecutada: ${fmtMoneyPrompt(totals.ejecutadaCaptaciones)} | Presupuesto: ${fmtMoneyPrompt(totals.presupuestadaCaptaciones)}
| Sucursal | Agencia | Ejecutado | Presupuesto | Categoría |
|---|---|---:|---:|---|
${rows}
`.trim();
}

export function buildMaduracionTable(maduracion, limit = 20) {
    if (!maduracion?.length) return 'No hay información de maduración disponible.';
    const rows = [...maduracion]
        .sort((a, b) => Number(b.maduracionPct ?? -999) - Number(a.maduracionPct ?? -999))
        .slice(0, limit === NO_LIMIT ? undefined : limit)
        .map((r) => `| ${r.sucursal || 'N/D'} | ${r.nombreAgencia || r.codAgencia || 'N/D'} | ${fmtMoneyPrompt(r.stock)} | ${fmtPctPrompt(r.maduracionPct)} |`)
        .join('\n');
    return `
Maduración de créditos (mayor % = mayor prioridad):
| Sucursal | Agencia | Stock | Maduración |
|---|---|---:|---:|
${rows}
`.trim();
}

export function buildLcfTable(lcf, lcfTotals, limit = 20) {
    if (!lcf?.length) return 'No hay información de LCF disponible.';
    const totals = lcfTotals || {};
    const rows = [...lcf]
        .sort((a, b) => safeNumber(b.cupoNoUtilizado) - safeNumber(a.cupoNoUtilizado))
        .slice(0, limit === NO_LIMIT ? undefined : limit)
        .map((r) => `| ${r.sucursal || 'N/D'} | ${r.nombreAgencia || r.codAgencia || 'N/D'} | ${fmtMoneyPrompt(r.montoAutorizado)} | ${fmtMoneyPrompt(r.cupoNoUtilizado)} |`)
        .join('\n');
    return `
LCF — Cupo no utilizado: ${fmtMoneyPrompt(totals.cupoNoUtilizado)}
| Sucursal | Agencia | Monto autorizado | Cupo no utilizado |
|---|---|---:|---:|
${rows}
`.trim();
}

export function buildSharedPortfolioTable(sharedPortfolioAgencyRows, sharedPortfolioTotals, limit = 20) {
    if (!sharedPortfolioAgencyRows?.length) return 'No hay información de cartera compartida disponible.';
    const totals = sharedPortfolioTotals || {};
    const rows = [...sharedPortfolioAgencyRows]
        .sort((a, b) => safeNumber(b.otrosBancos) - safeNumber(a.otrosBancos))
        .slice(0, limit === NO_LIMIT ? undefined : limit)
        .map((r) => `| ${r.sucursal || 'N/D'} | ${r.nombreAgencia || 'N/D'} | ${fmtMoneyPrompt(r.bnb)} | ${fmtMoneyPrompt(r.otrosBancos)} | ${r.prioridad || 'N/D'} |`)
        .join('\n');
    return `
Cartera compartida — Otros bancos: ${fmtMoneyPrompt(totals.otrosBancos)}
| Sucursal | Agencia | BNB | Otros bancos | Prioridad |
|---|---|---:|---:|---|
${rows}
`.trim();
}

export function buildAgentPrompt({
    title,
    objective,
    filtersApplied,
    summary,
    kpisProductData,
    filteredTimeSeries,
    marketShare,
    benchmark,
    oficiales,
    pdRisk,
    pdRiskTotals,
    captacionesByAgencia,
    captacionesTotals,
    maduracion,
    lcf,
    lcfTotals,
    sharedPortfolioAgencyRows,
    sharedPortfolioTotals,
    fullData = false,
    includeMarket = false,
    includeCompetitors = false,
    includeOfficials = false,
    includeTimeSeries = false,
    includePdRisk = false,
    includeCaptaciones = false,
    includeMaduracion = false,
    includeLcf = false,
    includeSharedPortfolio = false
}) {
    const limit = fullData ? NO_LIMIT : undefined;
    const blocks = [
        'Actúa como Gerente Comercial Senior de un banco y Analista Ejecutivo de Cartera.',
        buildAppliedFiltersText(filtersApplied),
        buildExecutiveRulesText(),
        `Objetivo del análisis:\n${objective}`,
        buildSummaryText(summary),
        buildProductsTable(kpisProductData, fullData ? NO_LIMIT : 20)
    ];

    if (includeMarket) blocks.push(buildMarketTable(marketShare, fullData ? NO_LIMIT : 20));
    if (includeCompetitors) blocks.push(buildCompetitorBenchmarkTable(benchmark, fullData ? NO_LIMIT : 100));
    if (includeOfficials) blocks.push(buildOfficialsTable(oficiales, fullData ? NO_LIMIT : 15));
    if (includeTimeSeries) blocks.push(buildTimeSeriesTable(filteredTimeSeries, fullData ? NO_LIMIT : 12));
    if (includePdRisk) blocks.push(buildPdRiskTable(pdRisk, pdRiskTotals, fullData ? NO_LIMIT : 20));
    if (includeCaptaciones) blocks.push(buildCaptacionesTable(captacionesByAgencia, captacionesTotals, fullData ? NO_LIMIT : 20));
    if (includeMaduracion) blocks.push(buildMaduracionTable(maduracion, fullData ? NO_LIMIT : 20));
    if (includeLcf) blocks.push(buildLcfTable(lcf, lcfTotals, fullData ? NO_LIMIT : 20));
    if (includeSharedPortfolio) blocks.push(buildSharedPortfolioTable(sharedPortfolioAgencyRows, sharedPortfolioTotals, fullData ? NO_LIMIT : 20));

    blocks.push(`
Formato de respuesta:
1. Resumen ejecutivo en máximo 5 bullets.
2. Diagnóstico comercial.
3. Tabla de hallazgos con impacto, causa probable y acción sugerida.
4. Análisis de productos críticos y líderes.
5. Riesgos comerciales y alertas tempranas.
6. Recomendaciones accionables.
- Cuando menciones periodos, usa formato yyyymm.
- No inventes datos.
`.trim());

    return `# ${title}\n\n${blocks.join('\n\n')}`.trim();
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

function unwrap(v) {
    return v && typeof v === 'object' && 'value' in v ? v.value : v;
}

function getPromptContext() {
    const dataStore = useDataStore();
    const filtersStore = useFiltersStore();
    const hub = useHubLogic();

    return {
        filtersApplied: unwrap(filtersStore.filtersApplied),
        summary: unwrap(dataStore.summary),
        kpisProductData: unwrap(dataStore.kpisProductData),
        filteredTimeSeries: unwrap(dataStore.filteredTimeSeries),
        marketShare: unwrap(dataStore.marketShare),
        benchmark: unwrap(dataStore.benchmark),
        oficiales: unwrap(dataStore.oficiales),
        pdRisk: unwrap(dataStore.pdRisk),
        pdRiskTotals: unwrap(hub.pdRiskTotals),
        captacionesByAgencia: unwrap(hub.captacionesByAgencia),
        captacionesTotals: unwrap(hub.captacionesTotals),
        maduracion: unwrap(dataStore.maduracion),
        lcf: unwrap(dataStore.lcf),
        lcfTotals: unwrap(hub.lcfTotals),
        sharedPortfolioAgencyRows: unwrap(hub.sharedPortfolioAgencyRows),
        sharedPortfolioTotals: unwrap(hub.sharedPortfolioTotals)
    };
}

function sendPromptWithContext(title, sections, promptText) {
    useChatStore().sendChat(promptText, { title, sections, promptText });
}

export function triggerAnalysis(opts = {}) {
    const ctx = getPromptContext();
    const fullData = opts.fullData !== false;
    const promptText = buildAgentPrompt({
        title: 'Análisis integral de cartera',
        objective: 'Realiza un análisis completo del estado de la cartera, brecha presupuestaria, competencia, fuerza comercial, captaciones y oportunidades.',
        fullData,
        includeMarket: true,
        includeCompetitors: true,
        includeOfficials: true,
        includeTimeSeries: true,
        includePdRisk: true,
        includeCaptaciones: true,
        includeMaduracion: true,
        includeLcf: true,
        includeSharedPortfolio: true,
        ...ctx,
        ...opts
    });
    sendPromptWithContext(
        'Análisis integral de cartera',
        ['summary', 'products', 'market', 'competitors', 'officials', 'timeSeries', 'pdRisk', 'captaciones', 'maduracion', 'lcf', 'sharedPortfolio'],
        promptText
    );
}

export function triggerBrechaAnalysis(opts = {}) {
    const ctx = getPromptContext();
    const promptText = buildAgentPrompt({
        title: 'Análisis de brecha presupuestaria',
        objective: 'Explica la brecha presupuestaria actual por producto.',
        includeTimeSeries: true,
        ...ctx,
        ...opts
    });
    sendPromptWithContext('Análisis de brecha presupuestaria', ['summary', 'products', 'timeSeries'], promptText);
}

export function triggerOficialesAnalysis(opts = {}) {
    const ctx = getPromptContext();
    const promptText = buildAgentPrompt({
        title: 'Análisis de desempeño por oficiales',
        objective: 'Evalúa el desempeño de la fuerza comercial.',
        includeOfficials: true,
        ...ctx,
        ...opts
    });
    sendPromptWithContext('Análisis de oficiales', ['officials', 'products'], promptText);
}

export function triggerRiesgoAnalysis(opts = {}) {
    const ctx = getPromptContext();
    const promptText = buildAgentPrompt({
        title: 'Análisis de riesgos comerciales',
        objective: 'Identifica riesgos comerciales y señales de desaceleración.',
        includeTimeSeries: true,
        includePdRisk: true,
        ...ctx,
        ...opts
    });
    sendPromptWithContext('Análisis de riesgos', ['summary', 'products', 'timeSeries', 'pdRisk'], promptText);
}

export function triggerCompetenciaAnalysis(opts = {}) {
    const ctx = getPromptContext();
    const promptText = buildAgentPrompt({
        title: 'Análisis competitivo BNB vs sistema financiero',
        objective: 'Compara BNB contra bancos competidores por producto.',
        includeMarket: true,
        includeCompetitors: true,
        ...ctx,
        ...opts
    });
    sendPromptWithContext('Análisis competitivo', ['market', 'competitors'], promptText);
}

export function triggerCaptacionesAnalysis(opts = {}) {
    const ctx = getPromptContext();
    const promptText = buildAgentPrompt({
        title: 'Análisis de captaciones',
        objective: 'Analiza desempeño de captaciones y tendencias por agencia.',
        includeCaptaciones: true,
        ...ctx,
        ...opts
    });
    sendPromptWithContext('Análisis de captaciones', ['captaciones'], promptText);
}

export function triggerOportunidadesAnalysis(opts = {}) {
    const ctx = getPromptContext();
    const promptText = buildAgentPrompt({
        title: 'Análisis de oportunidades comerciales',
        objective: 'Evalúa maduración de créditos y cupo LCF no utilizado.',
        includeMaduracion: true,
        includeLcf: true,
        ...ctx,
        ...opts
    });
    sendPromptWithContext('Análisis de oportunidades', ['maduracion', 'lcf'], promptText);
}

export function useAgentPrompts() {
    return {
        buildAgentPrompt,
        triggerAnalysis,
        triggerBrechaAnalysis,
        triggerOficialesAnalysis,
        triggerRiesgoAnalysis,
        triggerCompetenciaAnalysis,
        triggerCaptacionesAnalysis,
        triggerOportunidadesAnalysis
    };
}
