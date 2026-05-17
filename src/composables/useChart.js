/**
 * composables/useChart.js — Constantes y helpers visuales compartidos de Chart.js.
 *
 * Exporta la paleta de colores, la configuración base de tooltips y funciones
 * de construcción de datasets reutilizadas por múltiples vistas.
 */

// ─── Paleta corporativa ───────────────────────────────────────────────────────

export const PALETTE = [
    '#26b460',
    '#8b5cf6',
    '#f59e0b',
    '#3b82f6',
    '#1a8a49',
    '#e05252',
    '#d946ef',
    '#0ea5e9',
    '#64748b'
];

// ─── Tooltip base ─────────────────────────────────────────────────────────────

export const tooltipBase = {
    backgroundColor: 'rgba(15,31,22,0.92)',
    titleColor: '#b7e7c9',
    bodyColor: '#e8f7ee',
    borderColor: 'rgba(38,180,96,0.3)',
    borderWidth: 1,
    padding: 14,
    cornerRadius: 10,
    titleFont: { weight: '700', size: 13 },
    bodyFont: { size: 12 }
};

// ─── Escalas compartidas ──────────────────────────────────────────────────────

/** Escala X estándar para gráficos de línea/barra. */
export const xScaleBase = {
    grid: { color: 'rgba(15,31,22,.04)', drawBorder: false },
    ticks: { color: '#6f8177', font: { size: 12 } }
};

/** Escala Y estándar para gráficos de línea/barra. */
export const yScaleBase = {
    grid: { color: 'rgba(15,31,22,.05)', drawBorder: false },
    ticks: { color: '#6f8177', font: { size: 12 } }
};

/** Leyenda estándar. */
export const legendBase = {
    display: true,
    labels: {
        color: '#4a6355',
        boxWidth: 12,
        padding: 16,
        usePointStyle: true
    }
};

// ─── Opciones base reutilizables ──────────────────────────────────────────────

/** Opciones de animación y responsividad comunes. */
export const chartBaseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false }
};

// ─── Colores de estado ────────────────────────────────────────────────────────

export const COLOR_GREEN = '#26b460';
export const COLOR_GREEN_BG = 'rgba(38,180,96,.14)';
export const COLOR_PURPLE = '#8b5cf6';
export const COLOR_AMBER = '#f59e0b';
export const COLOR_RED = '#e05252';

// ─── Composable ──────────────────────────────────────────────────────────────

/**
 * useChart() — proporciona acceso reactivo a las constantes visuales.
 * Se puede usar directamente desde los imports de named exports,
 * pero este composable facilita el uso con provide/inject si se requiere.
 */
export function useChart() {
    return {
        PALETTE,
        tooltipBase,
        legendBase,
        xScaleBase,
        yScaleBase,
        chartBaseOptions,
        COLOR_GREEN,
        COLOR_GREEN_BG,
        COLOR_PURPLE,
        COLOR_AMBER,
        COLOR_RED
    };
}
