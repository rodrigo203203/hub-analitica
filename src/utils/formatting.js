/**
 * utils/formatting.js — Helpers locales de presentación del Hub Analítico BNB.
 *
 * Complementa los formatters de `format.js` (money, moneyFull, percent, dateLabel, dateIso)
 * con utilidades específicas de la UI: montos sin abreviar, signos +/–, escalas de miles,
 * normalización de texto y conversiones de series temporales.
 */

// ─── Dinero sin abreviaturas ─────────────────────────────────────────────────

/**
 * $X,XXX sin decimales, sin abreviar.
 */
export function moneyFullNoDecimals(value) {
    const n = Number(value || 0);
    return `$${n.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    })}`;
}

/**
 * +$X,XXX o –$X,XXX según signo.
 */
export function signedMoneyFull(value) {
    const n = Number(value || 0);
    const sign = n > 0 ? '+' : n < 0 ? '-' : '';
    return `${sign}$${Math.abs(n).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    })}`;
}

/** Alias semántico idéntico a signedMoneyFull. */
export const signedMoneyFullNoDecimals = signedMoneyFull;

// ─── Escala de miles (para desembolsos y scatter) ────────────────────────────

/**
 * Desembolsos: muestra el valor / 1000 con separadores de miles.
 */
export function formatDesembolsoMiles(value) {
    const n = Math.round(Number(value || 0) / 1000);
    return n.toLocaleString('en-US');
}

/**
 * $X,XXX sobre un valor ya dividido / 1000 (scatter chart).
 */
export function moneyKFull(value) {
    const n = Number(value || 0);
    return `$${n.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    })}`;
}

/**
 * +$X,XXX o –$X,XXX sobre un valor ya dividido / 1000 (scatter chart).
 */
export function signedMoneyK(value) {
    const n = Number(value || 0);
    const sign = n > 0 ? '+' : n < 0 ? '-' : '';
    return `${sign}$${Math.abs(n).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    })}`;
}

// ─── Formato de prompt del agente ────────────────────────────────────────────

/** Monto USD para texto del prompt del agente. */
export function fmtMoneyPrompt(value) {
    const n = Number(value || 0);
    return `$${n.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    })}`;
}

/** Porcentaje con 2 decimales para texto del prompt del agente. */
export function fmtPctPrompt(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
    return `${Number(value).toFixed(2)}%`;
}

// ─── Conversiones de series temporales ───────────────────────────────────────

/**
 * La serie histórica viene en millones desde el backend.
 * Multiplica por 1_000_000 para mostrar monto completo.
 */
export function fullMoneyFromTimeSeries(value) {
    const n = Number(value || 0);
    return n * 1_000_000;
}

// ─── Periodos ────────────────────────────────────────────────────────────────

/**
 * Normaliza cualquier representación de fecha/periodo a YYYYMM.
 * Soporta: ISO completo, YYYYMM numérico, objetos Date.
 */
export function toPeriodYYYYMM(value) {
    if (!value) return 'Último periodo disponible';

    const text = String(value).trim();

    if (/^\d{4}-\d{2}/.test(text)) {
        return text.slice(0, 7).replace('-', '');
    }

    if (/^\d{6}$/.test(text)) {
        return text;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        return `${year}${month}`;
    }

    return text;
}

// ─── Utilidades genéricas ─────────────────────────────────────────────────────

/**
 * Convierte a número finito o devuelve 0.
 */
export function safeNumber(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Normaliza texto: minúsculas, sin tildes, sin espacios extremos.
 */
export function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

// ─── Clases CSS de tendencia ─────────────────────────────────────────────────

/**
 * Devuelve clase CSS según si el valor es positivo, negativo o neutro.
 */
export function trendClass(value) {
    if (value === null || value === undefined) return 'trend-neutral';
    return Number(value) >= 0 ? 'trend-up' : 'trend-down';
}
