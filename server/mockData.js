/**
 * mockData.js — Datos demo del Hub Analítico BNB.
 * Todos los montos están expresados en USD.
 * BNB tiene un portafolio de cartera de ~USD 2.1B (cifra representativa del sistema financiero boliviano).
 */

export const dates = {
  cartera: '2026-04-30',
  sistema: '2026-04-30',
  oficiales: '2026-04-30'
};

export const catalogs = {
  fechas: ['2026-05-31','2026-04-30', '2026-03-31', '2026-02-28', '2026-01-31', '2025-12-31'],
  sucursales: ['TODAS', 'BENI', 'COCHABAMBA', 'EL ALTO', 'LA PAZ', 'ORURO', 'PANDO', 'POTOSI', 'SANTA CRUZ', 'SUCRE', 'TARIJA'],
  productosBNB: ['TODOS', 'TARJETAS DE CREDITO', 'MICROCREDITO', 'VEHICULAR', 'GRAN EMPRESA', 'PYME MEDIANA', 'VIVIENDA', 'PYME PEQUEÑA', 'CONSUMO', 'VIVIENDA SOCIAL'],
  productosSF: ['TODOS', 'CONSUMO', 'MICROCREDITO', 'VIVIENDA', 'VIVIENDA SOCIAL', 'EMPRESA', 'PYME'],
  bancos: ['TODOS', 'BEC', 'BGA', 'BNB', 'BIE', 'BCR', 'BIS', 'BSO', 'BME'],
  agencias: [
    {cod: 'TODAS', label: 'Todas las agencias', sucursal: null},
    {cod: 'LP01', label: 'LP01 · LA PAZ', sucursal: 'LA PAZ'},
    {cod: 'SC01', label: 'SC01 · SANTA CRUZ', sucursal: 'SANTA CRUZ'},
    {cod: 'CB01', label: 'CB01 · COCHABAMBA', sucursal: 'COCHABAMBA'},
    {cod: 'TJ01', label: 'TJ01 · TARIJA', sucursal: 'TARIJA'},
    {cod: 'OR01', label: 'OR01 · ORURO', sucursal: 'ORURO'},
    {cod: 'EA01', label: 'EA01 · EL ALTO', sucursal: 'EL ALTO'}
  ]
};

export const summary = {
  fechaCorte: dates.cartera,
  stockActual:            2_114_000_000,   // USD 2.114B
  stockBase:              2_017_000_000,   // USD 2.017B (Dic-25)
  crecimientoPct:         4.81,
  crecimientoNominal:        97_000_000,   // +97M USD
  desembolsosAcum:          382_000_000,   // flujo del período
  desembolsosVariacionPct:  8.24,
  pendiente:                118_000_000,   // pipeline
  amortizacion:             285_000_000,
  presupuesto:            2_323_000_000,   // meta de stock
  cumplimientoPct:          90.92,
  brechaPresupuesto:       -209_000_000,   // negativo = bajo presupuesto
  estado: 'En vigilancia',
  score: 'A-'
};

export const kpis = [
  { key: 'stock',       label: 'Stock actual',          value: summary.stockActual,         unit: 'money',   delta: summary.crecimientoPct,          deltaLabel: '+$97M vs Dic-25',            severity: 'success', icon: 'chart-line' },
  { key: 'growth',      label: 'Crecimiento vs Dic-25', value: summary.crecimientoPct,       unit: 'percent', delta: summary.crecimientoPct,          deltaLabel: '$97M absoluto',              severity: 'success', icon: 'arrow-trend-up' },
  { key: 'disbursement',label: 'Desembolsos acum.',      value: summary.desembolsosAcum,     unit: 'money',   delta: summary.desembolsosVariacionPct, deltaLabel: 'vs mismo período 2025',      severity: 'success', icon: 'sack-dollar' },
  { key: 'amortization',label: 'Amortización total',     value: summary.amortizacion,        unit: 'money',   delta: 3.12,                            deltaLabel: 'variación vs período anterior', severity: 'warning', icon: 'rotate' },
  { key: 'budget',      label: 'Stock presupuestado',   value: summary.presupuesto,          unit: 'money',   delta: null,                            deltaLabel: 'meta de stock vigente',      severity: 'info',    icon: 'bullseye' },
  { key: 'compliance',  label: 'Cumplimiento presup.',  value: summary.cumplimientoPct,      unit: 'percent', delta: -9.08,                           deltaLabel: '-$209M vs presupuesto',      severity: 'danger',  icon: 'triangle-exclamation' }
];

export const alerts = [
  { id: 1, level: 'danger',  emoji: '🚨', title: 'Brecha presupuestaria — 90.92% cumplimiento', body: '$209M por debajo del presupuesto de stock. Requiere aceleración en colocaciones en el segundo semestre.', badge: 'Alta',     icon: 'triangle-exclamation' },
  { id: 2, level: 'danger',  emoji: '📉', title: 'Contracción vehicular BNB: -3.78%', body: 'Posición #6 de 8 bancos en consumo/vehicular. Solo BSO crece (+2.58%). Sistema acumula -17.80%.', badge: 'Alta',  icon: 'chart-simple' },
  { id: 3, level: 'warning', emoji: '⚠️', title: 'Desembolsos de marzo bajo el promedio trimestral', body: '$89M en marzo vs promedio $95M (-4.82%). Vigilar tendencia abril.', badge: 'Media',    icon: 'clock' },
  { id: 4, level: 'success', emoji: '✅', title: 'Desembolsos acumulados +8.24% vs 2025', body: '$382M acumulados a abril 2026. Señal positiva pese a la contracción del mercado.', badge: 'Positivo', icon: 'circle-check' }
];

// Serie temporal: valores en millones USD (para escala de gráficas)
export const timeSeries = [
  { month: 'Ene', fecha: '2026-01-31', producto: 'CONSUMO',      sucursal: 'LA PAZ',     desembolso: 92,  amortizacion: 68, stock: 2_017, presupuesto: 2_200 },
  { month: 'Feb', fecha: '2026-02-28', producto: 'VIVIENDA',     sucursal: 'SANTA CRUZ', desembolso: 96,  amortizacion: 71, stock: 2_042, presupuesto: 2_248 },
  { month: 'Mar', fecha: '2026-03-31', producto: 'PYME MEDIANA', sucursal: 'COCHABAMBA', desembolso: 89,  amortizacion: 69, stock: 2_062, presupuesto: 2_285 },
  { month: 'Abr', fecha: '2026-04-30', producto: 'VEHICULAR',   sucursal: 'LA PAZ',     desembolso: 105, amortizacion: 77, stock: 2_114, presupuesto: 2_323 }
];

// ─── Proyección en millones USD por escenario ───
const projectionBase = {
  base: {
    desembolso:    [92, 96, 89, 105, 100, 104, 102, 106, 103, 108, 105, 111],
    amortizacion:  [68, 71, 69,  77,  72,  74,  73,  75,  74,  77,  76,  79]
  },
  optimista: {
    desembolso:    [92, 96, 89, 105, 107, 112, 110, 115, 112, 118, 114, 122],
    amortizacion:  [68, 71, 69,  77,  73,  75,  74,  76,  75,  78,  77,  80]
  },
  conservador: {
    desembolso:    [92, 96, 89, 105,  95,  98,  95,  99,  97, 100,  98, 102],
    amortizacion:  [68, 71, 69,  77,  71,  73,  72,  74,  73,  76,  75,  78]
  }
};

// ─── Proyección por producto (millones USD) ───
const projectionByProduct = {
  CONSUMO: {
    base:        { desembolso: [38, 42, 37, 44, 42, 44, 43, 45, 43, 46, 44, 47], amortizacion: [28, 30, 29, 32, 30, 31, 31, 32, 31, 33, 32, 33] },
    optimista:   { desembolso: [38, 42, 37, 44, 46, 49, 47, 50, 48, 51, 49, 53], amortizacion: [28, 30, 29, 32, 31, 32, 32, 33, 32, 34, 33, 34] },
    conservador: { desembolso: [38, 42, 37, 44, 39, 41, 40, 42, 41, 43, 41, 43], amortizacion: [28, 30, 29, 32, 30, 31, 30, 31, 30, 32, 31, 32] }
  },
  VIVIENDA: {
    base:        { desembolso: [24, 25, 23, 28, 26, 28, 27, 28, 27, 29, 28, 30], amortizacion: [18, 19, 18, 21, 19, 20, 20, 20, 20, 21, 20, 21] },
    optimista:   { desembolso: [24, 25, 23, 28, 29, 31, 30, 32, 31, 33, 32, 34], amortizacion: [18, 19, 18, 21, 20, 21, 20, 21, 21, 21, 21, 22] },
    conservador: { desembolso: [24, 25, 23, 28, 24, 25, 24, 26, 25, 26, 25, 27], amortizacion: [18, 19, 18, 21, 19, 19, 19, 20, 19, 20, 20, 21] }
  },
  VEHICULAR: {
    base:        { desembolso: [14, 15, 13, 16, 15, 16, 15, 16, 15, 16, 16, 17], amortizacion: [11, 12, 11, 13, 11, 12, 12, 12, 12, 12, 12, 13] },
    optimista:   { desembolso: [14, 15, 13, 16, 16, 17, 17, 18, 17, 18, 18, 19], amortizacion: [11, 12, 11, 13, 12, 12, 12, 12, 12, 13, 12, 13] },
    conservador: { desembolso: [14, 15, 13, 16, 13, 14, 13, 14, 14, 14, 14, 15], amortizacion: [11, 12, 11, 13, 11, 11, 11, 12, 11, 12, 12, 12] }
  },
  'PYME MEDIANA': {
    base:        { desembolso: [16, 14, 16, 17, 17, 16, 17, 17, 18, 17, 17, 17], amortizacion: [11, 10, 11, 11, 12, 11, 10, 11, 11, 11, 12, 12] },
    optimista:   { desembolso: [16, 14, 16, 17, 18, 18, 18, 19, 18, 19, 18, 19], amortizacion: [11, 10, 11, 11, 12, 12, 11, 12, 11, 12, 12, 13] },
    conservador: { desembolso: [16, 14, 16, 17, 16, 15, 16, 16, 16, 16, 16, 17], amortizacion: [11, 10, 11, 11, 11, 11, 10, 11, 11, 11, 11, 12] }
  },
  MICROCREDITO: {
    base:        { desembolso: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], amortizacion: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    optimista:   { desembolso: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], amortizacion: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    conservador: { desembolso: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], amortizacion: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
  }
};

export function getProjection(scenario = 'base') {
  const selected = projectionBase[scenario] || projectionBase.base;
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return months.map((month, index) => ({
    month,
    desembolso: selected.desembolso[index],
    amortizacion: selected.amortizacion[index],
    projected: index > 3
  }));
}

/**
 * Retorna proyección para un producto específico.
 * @param {'base'|'optimista'|'conservador'} scenario
 * @param {string} product - nombre del producto (de catalogs.productosBNB)
 */
export function getProjectionByProduct(scenario = 'base', product = 'TODOS') {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  if (product === 'TODOS') return getProjection(scenario);
  const data = projectionByProduct[product]?.[scenario] || projectionByProduct[product]?.base;
  if (!data) return getProjection(scenario);
  return months.map((month, index) => ({
    month,
    desembolso: data.desembolso[index],
    amortizacion: data.amortizacion[index],
    projected: index > 3
  }));
}

// ─── KPI por producto (para tabla de detalle) ───
export const kpisByProduct = [
  {
    producto: 'CONSUMO',
    stock:        210_000_000,
    stockBase:    200_000_000,
    crecimientoPct: 5.00,
    desembolsos:   44_000_000,
    amortizacion:  32_000_000,
    presupuesto:  240_000_000,
    cumplimientoPct: 87.50
  },
  {
    producto: 'VIVIENDA',
    stock:        253_000_000,
    stockBase:    240_000_000,
    crecimientoPct: 5.42,
    desembolsos:   28_000_000,
    amortizacion:  21_000_000,
    presupuesto:  270_000_000,
    cumplimientoPct: 93.70
  },
  {
    producto: 'VIVIENDA SOCIAL',
    stock:        108_000_000,
    stockBase:    102_000_000,
    crecimientoPct: 5.88,
    desembolsos:   12_000_000,
    amortizacion:   9_000_000,
    presupuesto:  115_000_000,
    cumplimientoPct: 93.91
  },
  {
    producto: 'VEHICULAR',
    stock:         72_000_000,
    stockBase:     82_000_000,
    crecimientoPct: -12.20,
    desembolsos:   16_000_000,
    amortizacion:  13_000_000,
    presupuesto:   95_000_000,
    cumplimientoPct: 75.79
  },
  {
    producto: 'GRAN EMPRESA',
    stock:        315_000_000,
    stockBase:    295_000_000,
    crecimientoPct: 6.78,
    desembolsos:   48_000_000,
    amortizacion:  34_000_000,
    presupuesto:  340_000_000,
    cumplimientoPct: 92.65
  },
  {
    producto: 'PYME MEDIANA',
    stock:        198_000_000,
    stockBase:    186_000_000,
    crecimientoPct: 6.45,
    desembolsos:   17_000_000,
    amortizacion:  11_000_000,
    presupuesto:  215_000_000,
    cumplimientoPct: 92.09
  },
  {
    producto: 'PYME PEQUEÑA',
    stock:         95_000_000,
    stockBase:     90_000_000,
    crecimientoPct: 5.56,
    desembolsos:   10_000_000,
    amortizacion:   7_000_000,
    presupuesto:  105_000_000,
    cumplimientoPct: 90.48
  },
  {
    producto: 'MICROCREDITO',
    stock:        126_000_000,
    stockBase:    120_000_000,
    crecimientoPct: 5.00,
    desembolsos:   14_000_000,
    amortizacion:  10_000_000,
    presupuesto:  140_000_000,
    cumplimientoPct: 90.00
  },
  {
    producto: 'TARJETAS DE CREDITO',
    stock:         47_000_000,
    stockBase:     45_000_000,
    crecimientoPct: 4.44,
    desembolsos:    5_000_000,
    amortizacion:   4_000_000,
    presupuesto:   52_000_000,
    cumplimientoPct: 90.38
  }
];

// ─── Benchmark: participación/crecimiento en el sistema financiero ───
// stockBNB = stock actual de BNB en ese segmento (USD)
// stockSistema = stock total del sistema financiero en ese segmento (USD)
export const benchmark = [
  { banco: 'BEC', sucursal: 'LA PAZ',     producto: 'CONSUMO',        vehicular: -2.32, vivienda:  1.40, viviendaSocial:  0.82, stockBNB: 210_000_000, stockSistema: 1_362_000_000, total: 385_000_000 },
  { banco: 'BGA', sucursal: 'SANTA CRUZ', producto: 'PYME',            vehicular: -1.10, vivienda:  2.14, viviendaSocial:  1.31, stockBNB: 225_000_000, stockSistema: 1_659_000_000, total: 460_000_000 },
  { banco: 'BNB', sucursal: 'LA PAZ',     producto: 'CONSUMO',         vehicular: -3.78, vivienda:  1.82, viviendaSocial:  1.09, stockBNB: 210_000_000, stockSistema: 1_362_000_000, total: 426_000_000 },
  { banco: 'BIE', sucursal: 'COCHABAMBA', producto: 'MICROCREDITO',    vehicular: -4.08, vivienda:  0.91, viviendaSocial:  1.88, stockBNB: 126_000_000, stockSistema: 1_115_000_000, total: 364_000_000 },
  { banco: 'BIS', sucursal: 'SANTA CRUZ', producto: 'VIVIENDA',        vehicular: -2.63, vivienda:  1.12, viviendaSocial:  0.41, stockBNB: 253_000_000, stockSistema: 1_516_000_000, total: 302_000_000 },
  { banco: 'BME', sucursal: 'TARIJA',     producto: 'EMPRESA',         vehicular: -2.52, vivienda:  0.62, viviendaSocial:  0.21, stockBNB: 315_000_000, stockSistema: 2_184_000_000, total: 234_000_000 },
  { banco: 'BCR', sucursal: 'ORURO',      producto: 'VIVIENDA SOCIAL', vehicular: -3.96, vivienda:  1.22, viviendaSocial:  0.71, stockBNB: 108_000_000, stockSistema:  777_000_000, total: 259_000_000 },
  { banco: 'BSO', sucursal: 'SANTA CRUZ', producto: 'CONSUMO',         vehicular:  2.58, vivienda:  1.73, viviendaSocial:  1.52, stockBNB: 210_000_000, stockSistema: 1_362_000_000, total: 527_000_000 }
];

// ─── Market share en USD ───
export const marketShare = [
  { segmentacioncredito: 'CONSUMO',         montoBNB: 210_000_000, montoSistema: 1_362_000_000, participacionPct: 15.42, crecimientoPct:  5.00 },
  { segmentacioncredito: 'MICROCREDITO',    montoBNB: 126_000_000, montoSistema: 1_115_000_000, participacionPct: 11.30, crecimientoPct:  5.00 },
  { segmentacioncredito: 'VIVIENDA',        montoBNB: 253_000_000, montoSistema: 1_516_000_000, participacionPct: 16.69, crecimientoPct:  5.42 },
  { segmentacioncredito: 'VIVIENDA SOCIAL', montoBNB: 108_000_000, montoSistema:  777_000_000, participacionPct: 13.90, crecimientoPct:  5.88 },
  { segmentacioncredito: 'EMPRESA',         montoBNB: 315_000_000, montoSistema: 2_184_000_000, participacionPct: 14.42, crecimientoPct:  6.78 },
  { segmentacioncredito: 'PYME',            montoBNB: 225_000_000, montoSistema: 1_659_000_000, participacionPct: 13.56, crecimientoPct:  6.45 }
];

// ─── Oficiales: montos en USD — Hub_OONN.MontoDesembolsoDolares ───
export const oficiales = [
  { oficial: 'Ana Suárez',       sucursal: 'LA PAZ',     desembolso: 13_120_000 },
  { oficial: 'Carlos Pinto',     sucursal: 'SANTA CRUZ', desembolso: 12_240_000 },
  { oficial: 'María Gutiérrez',  sucursal: 'COCHABAMBA', desembolso: 10_610_000 },
  { oficial: 'Rodrigo Méndez',   sucursal: 'TARIJA',     desembolso:  8_970_000 },
  { oficial: 'Lucía Mercado',    sucursal: 'EL ALTO',    desembolso:  8_110_000 }
];
