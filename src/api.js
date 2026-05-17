const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

async function get(path) {
    const response = await fetch(`${baseUrl}${path}`);
    if (!response.ok) throw new Error(`GET ${path} failed`);
    return response.json();
}

function queryString(params = {}) {
    const search = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            const cleanValues = value
                .map((v) => String(v || '').trim())
                .filter(Boolean)
                .filter((v) => v !== 'TODOS' && v !== 'TODAS');

            if (cleanValues.length > 0) {
                search.set(key, cleanValues.join(','));
            }

            return;
        }

        if (
            value !== null &&
            value !== undefined &&
            value !== '' &&
            value !== 'TODOS' &&
            value !== 'TODAS'
        ) {
            search.set(key, value);
        }
    });

    const text = search.toString();
    return text ? `?${text}` : '';
}

async function post(path, body) {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`POST ${path} failed`);
    return response.json();
}

export const api = {
    health: () => get('/api/health'),
    catalogs: () => get('/api/catalogs'),

    summary: (params) =>
        get(`/api/cartera/summary${queryString(params)}`),

    kpis: (params) =>
        get(`/api/cartera/kpis${queryString(params)}`),

    kpisByProduct: (params) =>
        get(`/api/cartera/kpis-by-product${queryString(params)}`),

    timeseries: (params) =>
        get(`/api/cartera/timeseries${queryString(params)}`),

    projection: (scenario, params) =>
        get(`/api/cartera/projection${queryString({...params, scenario})}`),

    projectionByProduct: (scenario, product) =>
        get(`/api/cartera/projection-by-product${queryString({scenario, product})}`),

    benchmark: (params) =>
        get(`/api/sistema-financiero/benchmark${queryString(params)}`),

    marketShare: (params) =>
        get(`/api/sistema-financiero/market-share${queryString(params)}`),

    oficiales: (params) =>
        get(`/api/oficiales/ranking${queryString(params)}`),

    fuentes: () =>
        get('/api/fuentes/status'),

    agentQuery: (message, useMcp = false) =>
        post('/api/agent/query', {message, useMcp}),
    pdRisk: (params) =>
        get(`/api/cartera/pd-risk${queryString(params)}`),
    pdRiskHistory: (params) =>
        get(`/api/cartera/pd-risk-history${queryString(params)}`), sharedPortfolio: (params) =>
        get(`/api/sistema-financiero/cartera-compartida${queryString(params)}`),

    captaciones: (params) =>
        get(`/api/captaciones/desempeno${queryString(params)}`),

    captacionesHistorico: (params) =>
        get(`/api/captaciones/historico${queryString(params)}`),
    maduracion: (params) =>
        get(`/api/oportunidades/maduracion${queryString(params)}`),

    lcf: (params) =>
        get(`/api/oportunidades/lcf${queryString(params)}`),
};