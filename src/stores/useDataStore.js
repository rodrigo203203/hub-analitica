/**
 * stores/useDataStore.js — Estado central de datos (Pinia).
 *
 * Todos los refs de datos + loadAll() como action.
 * Usa la misma lógica de useData.js pero en store Pinia.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api.js';

export const useDataStore = defineStore('data', () => {
    // ─── Estado ───────────────────────────────────────────────────────────────
    const loading = ref(true);
    const dataMode = ref('mock');

    const summary = ref(null);
    const kpisProductData = ref([]);
    const filteredTimeSeries = ref([]);
    const projection = ref([]);
    const projectionProductData = ref({});
    const benchmark = ref([]);
    const marketShare = ref([]);
    const sharedPortfolio = ref([]);
    const oficiales = ref([]);
    const fuentes = ref([]);
    const pdRisk = ref([]);
    const pdRiskHistory = ref([]);
    const captaciones = ref([]);
    const captacionesHistorico = ref([]);
    const maduracion = ref([]);
    const lcf = ref([]);

    // ─── Escenarios de proyección ─────────────────────────────────────────────
    const desembolsoScenario = ref('base');
    const amortizacionScenario = ref('base');
    const draftDesembolsoScenario = ref('base');
    const draftAmortizacionScenario = ref('base');

    const selectedProjProducts = ref([
        'CONSUMO', 'VIVIENDA', 'VIVIENDA SOCIAL',
        'TARJETAS DE CREDITO', 'VEHICULAR', 'MICROCREDITO'
    ]);

    const scenarios = [
        { label: 'Base', value: 'base' },
        { label: 'Optimista', value: 'optimista' },
        { label: 'Conservador', value: 'conservador' }
    ];

    // ─── Helpers de proyección ────────────────────────────────────────────────
    function normalizeTipoDato(value) {
        return String(value || '').trim().toUpperCase();
    }

    function projectionDateKey(row) {
        if (row?.fecha) {
            const d = new Date(row.fecha);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
            return String(row.fecha);
        }
        return String(row?.month || '');
    }

    function projectionMergeKey(row) {
        return [
            projectionDateKey(row),
            normalizeTipoDato(row.tipoDato),
            row.producto || row.PRODUCTO || '',
            row.agencia || row.AGENCIA || ''
        ].join('|');
    }

    function mergeProjectionScenarios(desembolsoRows = [], amortizacionRows = []) {
        const amortMap = new Map();
        amortizacionRows.forEach((row) => {
            amortMap.set(projectionMergeKey(row), Number(row.amortizacion || 0));
        });
        return desembolsoRows.map((row) => ({
            ...row,
            amortizacion: amortMap.has(projectionMergeKey(row))
                ? amortMap.get(projectionMergeKey(row))
                : Number(row.amortizacion || 0)
        }));
    }

    async function fetchMergedProjection(params = {}) {
        const [desRes, amortRes] = await Promise.all([
            api.projection(desembolsoScenario.value, params),
            api.projection(amortizacionScenario.value, params)
        ]);
        return mergeProjectionScenarios(desRes.data, amortRes.data);
    }

    async function fetchMergedProjectionByProduct(product) {
        const [desRes, amortRes] = await Promise.all([
            api.projectionByProduct(desembolsoScenario.value, product),
            api.projectionByProduct(amortizacionScenario.value, product)
        ]);
        return mergeProjectionScenarios(desRes.data, amortRes.data);
    }

    async function loadProjectionByProduct() {
        for (const prod of selectedProjProducts.value) {
            if (!projectionProductData.value[prod]) {
                try {
                    projectionProductData.value[prod] = await fetchMergedProjectionByProduct(prod);
                } catch (err) {
                    console.error('projectionByProduct error:', prod, err);
                    projectionProductData.value[prod] = [];
                }
            }
        }
    }

    // ─── Carga principal ──────────────────────────────────────────────────────
    async function loadAll(params, hooks = {}) {
        loading.value = true;
        try {
            const [
                health, catalogRes, summaryRes, kpisProdRes, timeseriesRes,
                projectionRes, benchmarkRes, marketRes, sharedPortfolioRes,
                oficialesRes, fuentesRes, pdRiskRes, pdRiskHistoryRes,
                captacionesRes, captacionesHistoricoRes, maduracionRes, lcfRes
            ] = await Promise.all([
                api.health().catch(() => ({ mode: 'offline' })),
                api.catalogs().catch(() => ({ data: { fechas: [], sucursales: ['TODAS'], productosBNB: ['TODOS'], productosSF: ['TODOS'], bancos: ['TODOS'], agencias: [] } })),
                api.summary(params).catch(() => ({ data: null, mode: 'mock' })),
                api.kpisByProduct(params).catch(() => ({ data: [] })),
                api.timeseries(params).catch(() => ({ data: [] })),
                fetchMergedProjection(params).catch(() => []),
                api.benchmark(params).catch(() => ({ data: [] })),
                api.marketShare(params).catch(() => ({ data: [] })),
                api.sharedPortfolio(params).catch(() => ({ data: [] })),
                api.oficiales(params).catch(() => ({ data: [] })),
                api.fuentes().catch(() => ({ data: [] })),
                api.pdRisk(params).catch(() => ({ data: [] })),
                api.pdRiskHistory(params).catch(() => ({ data: [] })),
                api.captaciones(params).catch(() => ({ data: [] })),
                api.captacionesHistorico({
                    sucursal: params.sucursal,
                    agencia: params.agencia
                }).catch(() => ({ data: [] })),
                api.maduracion(params).catch(() => ({ data: [] })),
                api.lcf(params).catch(() => ({ data: [] }))
            ]);

            dataMode.value = health.mode || summaryRes.mode || 'mock';
            hooks.onCatalogsLoaded?.(catalogRes.data);

            summary.value = summaryRes.data;
            kpisProductData.value = kpisProdRes.data;
            filteredTimeSeries.value = timeseriesRes.data;
            projection.value = projectionRes;
            benchmark.value = benchmarkRes.data;
            marketShare.value = marketRes.data;
            sharedPortfolio.value = sharedPortfolioRes.data;
            oficiales.value = oficialesRes.data;
            fuentes.value = fuentesRes.data;
            pdRisk.value = pdRiskRes.data;
            pdRiskHistory.value = pdRiskHistoryRes.data;
            captaciones.value = captacionesRes.data;
            captacionesHistorico.value = captacionesHistoricoRes.data;
            maduracion.value = maduracionRes.data;
            lcf.value = lcfRes.data;

            await loadProjectionByProduct();
        } finally {
            loading.value = false;
        }
    }

    return {
        loading, dataMode,
        summary, kpisProductData, filteredTimeSeries, projection,
        projectionProductData, benchmark, marketShare, sharedPortfolio,
        oficiales, fuentes, pdRisk, pdRiskHistory,
        captaciones, captacionesHistorico, maduracion, lcf,
        desembolsoScenario, amortizacionScenario,
        draftDesembolsoScenario, draftAmortizacionScenario,
        selectedProjProducts, scenarios,
        loadAll, loadProjectionByProduct,
        fetchMergedProjection, fetchMergedProjectionByProduct
    };
});
