/**
 * format.js — utilidades de formateo del Hub Analítico BNB.
 * Moneda: USD ($)  |  Separadores de miles  |  Porcentajes con 2 decimales.
 */

/**
 * Formatea un valor numérico como monto en USD.
 * - Valores >= 1 000 000 000 → "$X.XXB"
 * - Valores >= 1 000 000      → "$XXXM"
 * - Resto                    → "$X,XXX" (sin decimales, con separadores)
 */
export function money(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  const abs = Math.abs(Number(value));
  const sign = Number(value) < 0 ? '-' : '';
  if (abs >= 1_000_000_000)
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000)
    return `${sign}$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(abs / 1_000_000))}M`;
  return `${sign}$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(abs)}`;
}

/**
 * Monto USD completo: sin abreviaturas M/B, sin decimales, separador de miles.
 */
export function moneyFull(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '$0';
  }
  const n = Number(value);
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US', {
    maximumFractionDigits: 0
  })}`;
}

/**
 * Formatea un valor numérico como porcentaje con 2 decimales.
 */
export function percent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return `${Number(value).toFixed(2)}%`;
}

/**
 * Formatea una fecha ISO para mostrar en la UI (locale boliviano, UTC).
 */
export function dateLabel(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(value));
}

/**
 * Fecha en formato calendario ISO yyyy-mm-dd (corte, filtros, reportes).
 */
export function dateIso(value) {
  if (value === null || value === undefined || value === '') return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value).slice(0, 10) || '-';
  }
  return d.toISOString().slice(0, 10);
}
