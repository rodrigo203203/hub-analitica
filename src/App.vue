<script setup>
import {computed, onMounted, ref} from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Chart from 'primevue/chart';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import {api} from './api';
import {dateIso, money, percent} from './format';

const sections = [
  {id: 'portada', label: 'Portada', icon: 'house'},
  {id: 'gobernanza', label: 'Gobernanza', icon: 'shield-halved'},
  {
    id: 'cartera',
    label: 'Cartera',
    icon: 'chart-line',
    children: [
      {id: 'kpis', label: 'KPIs ejecutivos', icon: 'gauge-high'},
      {id: 'proyeccion', label: 'Proyeccion', icon: 'arrow-trend-up'},
      {id: 'sistema', label: 'Sistema financiero', icon: 'table-cells'},
      {id: 'agente', label: 'Agente IA', icon: 'brain'}
    ]
  },
  {
    id: 'captaciones',
    label: 'Captaciones',
    icon: 'building-columns',
    children: [
      {id: 'capt-kpis', label: 'KPIs', icon: 'chart-pie'},
      {id: 'capt-natural', label: 'Persona natural', icon: 'user-tie'},
      {id: 'capt-juridica', label: 'Persona juridica', icon: 'building-columns'}
    ]
  },
  {id: 'actualizaciones', label: 'Actualizaciones', icon: 'database'}
];

// ─── Estado UI ────────────────────────────────────────────────────────────────

const active = ref('portada');
const hasEntered = ref(false);
const menuOpen = ref(false);
const dataMode = ref('mock');
const selectedPeriod = ref('Ultimo corte');
const periods = ['Ultimo corte', '2026 Q2', '2026 Q1', '2025 cierre'];

/** Productos seleccionados por defecto (segmentación cartera BNB / consumo masivo) */
const DEFAULT_PRODUCTOS = [
  'CONSUMO',
  'VIVIENDA',
  'VIVIENDA SOCIAL',
  'TARJETAS DE CREDITO',
  'VEHICULAR',
  'MICROCREDITO'
];

function cloneFilters(src) {
  return JSON.parse(JSON.stringify(src));
}

function initialFilterState() {
  return {
    fecha: null,
    sucursal: ['TODAS'],
    producto: [...DEFAULT_PRODUCTOS],
    agencia: ['TODAS'],
    banco: 'TODOS'
  };
}

// ─── Catálogos y filtros ──────────────────────────────────────────────────────

const catalogs = ref({
  fechas: [],
  sucursales: ['TODAS'],
  productosBNB: ['TODOS'],
  productosSF: ['TODOS'],
  bancos: ['TODOS'],
  agencias: []
});

/** Borrador en la barra de filtros */
const filtersDraft = ref(initialFilterState());
/** Valores que alimentan KPIs y gráficos tras pulsar Aplicar */
const filtersApplied = ref(cloneFilters(initialFilterState()));

const chartFilters = ref({
  projectionMetric: 'AMBOS',
  projectionProduct: 'TODOS',
  marketProduct: 'TODOS',
  marketBank: 'TODOS'
});

const projectionMetrics = ['AMBOS', 'DESEMBOLSOS', 'AMORTIZACION'];
const scenario = ref('base');
const scenarios = [
  {label: 'Base', value: 'base'},
  {label: 'Optimista', value: 'optimista'},
  {label: 'Conservador', value: 'conservador'}
];

// ─── Datos ────────────────────────────────────────────────────────────────────

const loading = ref(true);
const summary = ref(null);
const kpis = ref([]);
const kpisProductData = ref([]);
const projection = ref([]);
const projectionProductData = ref({});     // { [productName]: [...projectionData] }
const selectedProjProducts = ref(['CONSUMO', 'VIVIENDA']);
const benchmark = ref([]);
const marketShare = ref([]);
const oficiales = ref([]);
const oficialesFirst = ref(0);
const fuentes = ref([]);
const filteredTimeSeries = ref([]);
const heatSortKey = ref('banco');

// ─── Chat ─────────────────────────────────────────────────────────────────────

const chatInput = ref('');
const chatLoading = ref(false);
const chat = ref([
  {
    role: 'bot',
    text: 'Hola. Soy el Analista IA de cartera. Puedo ayudarte a explorar KPIs, interpretar la brecha presupuestaria, comparar BNB con el sistema financiero y proyectar escenarios. ¿Qué quieres saber?'
  }
]);

// ─── Computed helpers ─────────────────────────────────────────────────────────

const activeTitle = computed(() => {
  const flat = sections.flatMap((s) => [s, ...(s.children || [])]);
  return flat.find((item) => item.id === active.value)?.label || 'Hub Analitico';
});

const productOptions = computed(() =>
    ['sistema', 'captaciones'].includes(active.value)
        ? catalogs.value.productosSF
        : catalogs.value.productosBNB
);

const showBankFilter = computed(() => active.value === 'sistema');

const dateOptions = computed(() => active.value === 'sistema' ? catalogs.value.fechasSF || catalogs.value.fechas : catalogs.value.fechas);

const showFilters = computed(() =>
    !['gobernanza', 'agente', 'actualizaciones'].includes(active.value)
);

// ─── Constantes de estilos ────────────────────────────────────────────────────

const kpiSeverityClass = {
  success: 'kpi-success',
  danger: 'kpi-danger',
  warning: 'kpi-warning',
  info: 'kpi-info'
};

const tooltipBase = {
  backgroundColor: 'rgba(15,31,22,0.92)',
  titleColor: '#b7e7c9',
  bodyColor: '#e8f7ee',
  borderColor: 'rgba(38,180,96,0.3)',
  borderWidth: 1,
  padding: 14,
  cornerRadius: 10,
  titleFont: {weight: '700', size: 13},
  bodyFont: {size: 12}
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {duration: 600, easing: 'easeOutQuart'},
  interaction: {mode: 'index', intersect: false},
  plugins: {
    legend: {display: true, labels: {color: '#4a6355', boxWidth: 12, padding: 16, usePointStyle: true}},
    tooltip: {
      ...tooltipBase,
      callbacks: {
        label: (ctx) => {
          const val = ctx.parsed.y;
          if (val === null || val === undefined) return '';
          return ` ${ctx.dataset.label}: $${Number(val).toLocaleString('en-US')}M`;
        }
      }
    }
  },
  scales: {
    x: {
      grid: {color: 'rgba(15,31,22,.04)', drawBorder: false},
      ticks: {color: '#6f8177', font: {size: 12}}
    },
    y: {
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      ticks: {
        color: '#6f8177', font: {size: 12},
        callback: (value) => `$${Number(value).toLocaleString('en-US')}M`
      }
    }
  }
};

const pctChartOptions = {
  ...chartOptions,
  plugins: {
    ...chartOptions.plugins,
    tooltip: {
      ...tooltipBase,
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)}%`
      }
    }
  },
  scales: {
    x: chartOptions.scales.x,
    y: {
      ...chartOptions.scales.y,
      ticks: {
        color: '#6f8177', font: {size: 12},
        callback: (value) => `${Number(value).toFixed(1)}%`
      }
    }
  }
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {duration: 700, easing: 'easeOutQuart'},
  plugins: {
    legend: {position: 'bottom', labels: {color: '#4a6355', boxWidth: 12, padding: 16, usePointStyle: true}},
    tooltip: {
      ...tooltipBase,
      callbacks: {
        label: (ctx) => ` ${ctx.label}: $${Number(ctx.parsed).toLocaleString('en-US')}M`
      }
    }
  }
};

const scatterOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {display: false},
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const d = ctx.raw;
          return `${d.product}: Stock $${d.x.toLocaleString()}M | Crec. ${d.y}% | Share ${(d.r / 1.5).toFixed(1)}%`;
        }
      }
    }
  },
  scales: {
    x: {title: {display: true, text: 'Stock Sistema (Millones USD)', color: '#4a6355'}, grid: {color: '#e8ecef'}},
    y: {title: {display: true, text: 'Crecimiento (%)', color: '#4a6355'}, grid: {color: '#e8ecef'}}
  }
};

const PALETTE = ['#26b460', '#8b5cf6', '#f59e0b', '#3b82f6', '#1a8a49', '#e05252', '#d946ef', '#0ea5e9', '#64748b'];

// ─── Charts computed ──────────────────────────────────────────────────────────

const projectionChart = computed(() => {
  const cutoff = 3;
  const allDatasets = [];

  if (selectedProjProducts.value.length === 0) {
    const realD = projection.value.map((d, i) => i <= cutoff ? d.desembolso : null);
    const projD = projection.value.map((d, i) => i >= cutoff ? d.desembolso : null);
    const realA = projection.value.map((d, i) => i <= cutoff ? d.amortizacion : null);
    const projA = projection.value.map((d, i) => i >= cutoff ? d.amortizacion : null);

    allDatasets.push(
        {
          label: 'Desembolsos Real',
          data: realD,
          borderColor: '#26b460',
          backgroundColor: 'rgba(38,180,96,.10)',
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#26b460',
          spanGaps: false,
          fill: true
        },
        {
          label: 'Desembolsos Proyectado',
          data: projD,
          borderColor: '#26b460',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#26b460',
          spanGaps: false,
          fill: false
        },
        {
          label: 'Amortización Real',
          data: realA,
          borderColor: '#e05252',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#e05252',
          spanGaps: false,
          fill: false
        },
        {
          label: 'Amortización Proyectada',
          data: projA,
          borderColor: '#e05252',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#e05252',
          spanGaps: false,
          fill: false
        }
    );
  } else {
    selectedProjProducts.value.forEach((prod, i) => {
      const data = projectionProductData.value[prod] || [];
      if (!data.length) return;

      const realD = data.map((d, idx) => idx <= cutoff ? d.desembolso : null);
      const projD = data.map((d, idx) => idx >= cutoff ? d.desembolso : null);
      const realA = data.map((d, idx) => idx <= cutoff ? d.amortizacion : null);
      const projA = data.map((d, idx) => idx >= cutoff ? d.amortizacion : null);
      const colorD = PALETTE[(i * 2) % PALETTE.length];
      const colorA = PALETTE[(i * 2 + 1) % PALETTE.length];

      allDatasets.push(
          {
            label: `${prod} - Desemb. Real`,
            data: realD,
            borderColor: colorD,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: colorD,
            spanGaps: false,
            fill: false
          },
          {
            label: `${prod} - Desemb. Proy.`,
            data: projD,
            borderColor: colorD,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [6, 4],
            tension: 0.4,
            pointRadius: 2,
            pointBackgroundColor: colorD,
            spanGaps: false,
            fill: false
          },
          {
            label: `${prod} - Amort. Real`,
            data: realA,
            borderColor: colorA,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: colorA,
            spanGaps: false,
            fill: false
          },
          {
            label: `${prod} - Amort. Proy.`,
            data: projA,
            borderColor: colorA,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [6, 4],
            tension: 0.4,
            pointRadius: 2,
            pointBackgroundColor: colorA,
            spanGaps: false,
            fill: false
          }
      );
    });
  }

  const labels = projection.value.length
      ? projection.value.map((d) => d.month)
      : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  if (chartFilters.value.projectionMetric === 'DESEMBOLSOS')
    return {labels, datasets: allDatasets.filter((d) => d.label.includes('Desemb'))};
  if (chartFilters.value.projectionMetric === 'AMORTIZACION')
    return {labels, datasets: allDatasets.filter((d) => d.label.includes('Amort'))};
  return {labels, datasets: allDatasets};
});

const flowRows = computed(() => {
  const rows = filteredTimeSeries.value.filter((item) =>
      chartFilters.value.projectionProduct === 'TODOS' || item.producto === chartFilters.value.projectionProduct
  );
  return rows.length ? rows : filteredTimeSeries.value;
});

const flowChart = computed(() => ({
  labels: flowRows.value.map((item) => item.month),
  datasets: [
    {
      label: 'Stock USD',
      data: flowRows.value.map((item) => item.stock),
      backgroundColor: 'rgba(38,180,96,.22)',
      borderColor: '#26b460',
      borderWidth: 2,
      borderRadius: {topLeft: 8, topRight: 8}
    },
    {
      label: 'Presupuesto',
      data: flowRows.value.map((item) => item.presupuesto),
      backgroundColor: 'rgba(139,92,246,.18)',
      borderColor: '#8b5cf6',
      borderWidth: 2,
      borderRadius: {topLeft: 8, topRight: 8}
    }
  ]
}));

const filteredBenchmark = computed(() =>
    benchmark.value.filter((item) => {
      const prodFilters = filtersApplied.value.producto || [];

      const bankOk =
          !filtersApplied.value.banco ||
          filtersApplied.value.banco === 'TODOS' ||
          item.banco === filtersApplied.value.banco;

      const productOk =
          prodFilters.length === 0 ||
          prodFilters.includes('TODOS') ||
          prodFilters.includes(item.producto) ||
          prodFilters.includes(item.segmentacioncredito);

      const chartBankOk =
          chartFilters.value.marketBank === 'TODOS' ||
          item.banco === chartFilters.value.marketBank;

      const chartProductOk =
          chartFilters.value.marketProduct === 'TODOS' ||
          item.producto === chartFilters.value.marketProduct ||
          item.segmentacioncredito === chartFilters.value.marketProduct;

      return bankOk && productOk && chartBankOk && chartProductOk;
    })
);

const filteredMarketShare = computed(() =>
    marketShare.value.filter((item) => {
      const prodFilters = filtersApplied.value.producto || [];
      return prodFilters.length === 0 || prodFilters.includes('TODOS') || prodFilters.includes(item.segmentacioncredito);
    })
);

const marketVisualRows = computed(() =>
    filteredMarketShare.value.filter((item) =>
        chartFilters.value.marketProduct === 'TODOS' || item.segmentacioncredito === chartFilters.value.marketProduct
    )
);

const marketChart = computed(() => ({
  labels: marketVisualRows.value.map((item) => item.segmentacioncredito),
  datasets: [{
    label: 'Participación BNB (%)',
    data: marketVisualRows.value.map((item) => item.participacionPct),
    backgroundColor: '#26b460',
    borderRadius: 4
  }]
}));

const scatterChart = computed(() => ({
  datasets: [{
    label: 'Productos',
    data: filteredMarketShare.value.map((item) => ({
      x: item.montoSistema / 1_000_000,
      y: item.crecimientoPct,
      product: item.segmentacioncredito,
      r: item.participacionPct * 1.5
    })),
    backgroundColor: 'rgba(38,180,96,0.6)',
    borderColor: '#26b460'
  }]
}));

const compositionChart = computed(() => ({
  labels: marketVisualRows.value.map((item) => item.segmentacioncredito),
  datasets: [{
    data: marketVisualRows.value.map((item) => item.montoBNB / 1_000_000),
    backgroundColor: PALETTE,
    borderColor: '#ffffff',
    borderWidth: 3,
    hoverOffset: 8
  }]
}));

const carteraSnapshot = computed(() => [
  {label: 'Stock', value: money(summary.value?.stockActual), icon: 'chart-line', helper: 'Hub_CarteraBNB.stock'},
  {
    label: 'Presupuesto',
    value: money(summary.value?.presupuesto),
    icon: 'bullseye',
    helper: 'Hub_CarteraBNB.presupuesto'
  },
  {
    label: 'Amortizacion',
    value: money(summary.value?.amortizacion),
    icon: 'rotate',
    helper: 'Hub_CarteraBNB.amortizacion'
  },
  {
    label: 'Brecha',
    value: money(summary.value?.brechaPresupuesto),
    icon: 'triangle-exclamation',
    helper: 'stock - presupuesto'
  }
]);

const commercialHealth = computed(() => [
  {
    title: 'Cumplimiento de stock',
    value: percent(summary.value?.cumplimientoPct),
    status: (summary.value?.cumplimientoPct || 0) >= 100 ? 'Cumple meta' : 'Bajo presupuesto',
    tone: (summary.value?.cumplimientoPct || 0) >= 100 ? 'success' : 'danger'
  },
  {
    title: 'Presion de brecha',
    value: money(summary.value?.brechaPresupuesto),
    status: 'Diferencia contra presupuesto vigente',
    tone: (summary.value?.brechaPresupuesto || 0) >= 0 ? 'success' : 'danger'
  },
  {
    title: 'Ritmo de desembolso',
    value: money(summary.value?.desembolsosAcum),
    status: `${percent(summary.value?.desembolsosVariacionPct)} vs periodo comparable`,
    tone: 'success'
  },
  {
    title: 'Amortización',
    value: money(summary.value?.amortizacion),
    status: 'Amortizacion del periodo',
    tone: 'warning'
  }
]);

const riskSignals = computed(() => [
  {
    label: 'Brecha / presupuesto',
    value: Math.abs((summary.value?.brechaPresupuesto || 0) / (summary.value?.presupuesto || 1)) * 100
  },
  {
    label: 'Amortizacion / desembolso',
    value: ((summary.value?.amortizacion || 0) / (summary.value?.desembolsosAcum || 1)) * 100
  },
  {label: 'Stock / presupuesto', value: summary.value?.cumplimientoPct || 0}
]);

const captacionCards = [
  {
    title: 'KPIs',
    body: 'Espacio reservado para saldos, crecimiento y cumplimiento de captaciones cuando exista fuente oficial.',
    icon: 'chart-pie'
  },
  {
    title: 'Persona natural',
    body: 'Vista para cuentas, saldos y comportamiento por segmento natural.',
    icon: 'user-tie'
  },
  {
    title: 'Persona juridica',
    body: 'Vista para empresas, productos transaccionales y saldos por banca.',
    icon: 'building-columns'
  }
];

const scoreLight = computed(() => {
  const pct = summary.value?.cumplimientoPct || 0;
  if (pct >= 100) return {score: 'A+', label: 'Óptimo', light: 'g'};
  if (pct >= 90) return {score: 'A-', label: 'En vigilancia', light: 'y'};
  return {score: 'B', label: 'Crítico', light: 'r'};
});

const heroInlineStats = computed(() => [
  {
    val: moneyFull(summary.value?.stockActual),
    lbl: 'Stock actual'
  },
  {
    val: percent(summary.value?.crecimientoPct),
    lbl: 'vs. Dic 2025',
    pos: (summary.value?.crecimientoPct || 0) >= 0
  },
  {
    val: percent(summary.value?.cumplimientoPct),
    lbl: 'Cumplimiento presupuesto',
    pos: (summary.value?.cumplimientoPct || 0) >= 100
  },
  {
    val: moneyFull(summary.value?.desembolsosAcum),
    lbl: 'Desembolsos acum. 2026',
    pos: true
  }
]);

function moneyFull(value) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '$0.00';
  }

  return `$${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function progressValue(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.max(0, Math.min(n, 100));
}

const benchmarkMatrix = computed(() => {
  const rows = filteredBenchmark.value;
  const productos = [...new Set(rows.map(r => r.producto).filter(Boolean))].sort();
  const bancosSet = new Set(rows.map(r => r.banco).filter(Boolean));
  const bancos = Array.from(bancosSet).sort((a, b) => {
    if (a === 'BNB') return -1;
    if (b === 'BNB') return 1;
    return a.localeCompare(b);
  });

  const matrix = productos.map(prod => {
    const rowObj = { producto: prod };
    let rowTotal = 0;
    bancos.forEach(banco => {
      const found = rows.find(r => r.producto === prod && r.banco === banco);
      if (found) {
        rowObj[banco] = { crecimientoPct: found.crecimientoPct, total: found.total };
        rowTotal += (found.total || 0);
      } else {
        rowObj[banco] = null;
      }
    });
    rowObj.rowTotal = rowTotal;
    return rowObj;
  });

  return { bancos, matrix };
});

// ─── Carga de datos ───────────────────────────────────────────────────────────

async function loadAll() {
  loading.value = true;
  const params = {
    fecha: filtersApplied.value.fecha,
    sucursal: filtersApplied.value.sucursal,
    producto: filtersApplied.value.producto,
    agencia: filtersApplied.value.agencia,
    banco: filtersApplied.value.banco
  };

  const [
    health, catalogRes, summaryRes, kpisRes, kpisProdRes,
    timeseriesRes, projectionRes, benchmarkRes, marketRes,
    oficialesRes, fuentesRes
  ] = await Promise.all([
    api.health().catch(() => ({mode: 'offline'})),
    api.catalogs(),
    api.summary(params),
    api.kpis(params),
    api.kpisByProduct(params),
    api.timeseries(params),
    api.projection(scenario.value, params),
    api.benchmark(params),
    api.marketShare(params),
    api.oficiales(params),
    api.fuentes()
  ]);

  dataMode.value = health.mode || summaryRes.mode || 'mock';
  catalogs.value = {...catalogRes.data, agencias: catalogRes.data.agencias || []};

  if (!filtersApplied.value.fecha && catalogRes.data.fechas?.[0]) {
    const f = catalogRes.data.fechas[0];
    filtersApplied.value.fecha = f;
    filtersDraft.value.fecha = f;
  }

  summary.value = summaryRes.data;
  kpis.value = kpisRes.data;
  kpisProductData.value = kpisProdRes.data;
  filteredTimeSeries.value = timeseriesRes.data;
  projection.value = projectionRes.data;
  benchmark.value = benchmarkRes.data;
  marketShare.value = marketRes.data;
  oficiales.value = oficialesRes.data;
  fuentes.value = fuentesRes.data;

  await loadProjectionByProduct();

  loading.value = false;
}

async function loadProjectionByProduct() {
  for (const prod of selectedProjProducts.value) {
    if (!projectionProductData.value[prod]) {
      const res = await api.projectionByProduct(scenario.value, prod);
      projectionProductData.value[prod] = res.data;
    }
  }
}

async function toggleProjProduct(product) {
  if (selectedProjProducts.value.includes(product)) {
    selectedProjProducts.value = selectedProjProducts.value.filter((p) => p !== product);
  } else {
    selectedProjProducts.value.push(product);
    if (!projectionProductData.value[product]) {
      const res = await api.projectionByProduct(scenario.value, product);
      projectionProductData.value[product] = res.data;
    }
  }
}

async function changeScenario(nextScenario) {
  scenario.value = nextScenario;
  const response = await api.projection(nextScenario, filtersApplied.value);
  projection.value = response.data;
  for (const prod of Object.keys(projectionProductData.value)) {
    const res = await api.projectionByProduct(nextScenario, prod);
    projectionProductData.value[prod] = res.data;
  }
}

function applyFilters() {
  filtersApplied.value = cloneFilters(filtersDraft.value);
  loadAll();
}

function resetFilters() {
  const next = {
    fecha: catalogs.value.fechas?.[0] || null,
    sucursal: ['TODAS'],
    producto: [...DEFAULT_PRODUCTOS],
    agencia: ['TODAS'],
    banco: 'TODOS'
  };
  filtersDraft.value = next;
  filtersApplied.value = cloneFilters(next);
  loadAll();
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

async function sendChat(message = chatInput.value) {
  const text = String(message || '').trim();
  if (!text) return;
  chat.value.push({role: 'user', text});
  chatInput.value = '';
  chatLoading.value = true;
  try {
    const response = await api.agentQuery(text);
    chat.value.push({role: 'bot', text: response.data.answer});
  } catch {
    chat.value.push({
      role: 'bot',
      text: 'No pude conectar con el backend del agente. Revisa que el servidor este activo.'
    });
  } finally {
    chatLoading.value = false;
  }
}

// ─── Navegación ───────────────────────────────────────────────────────────────

function setActive(id) {
  active.value = id;
  menuOpen.value = false;
  window.scrollTo({top: 0, behavior: 'smooth'});
}

// ─── Helpers de presentación ──────────────────────────────────────────────────

function kpiValue(kpi) {
  return kpi.unit === 'percent' ? percent(kpi.value) : moneyFull(kpi.value);
}

function trendClass(value) {
  if (value === null || value === undefined) return 'trend-neutral';
  return Number(value) >= 0 ? 'trend-up' : 'trend-down';
}

function heatClass(value) {
  if (value === null || value === undefined) return 'heat-empty';
  if (value > 1) return 'heat-good';
  if (value >= -1) return 'heat-watch';
  return 'heat-risk';
}

// ─── Ciclo de vida ────────────────────────────────────────────────────────────

onMounted(async () => {
  await loadAll();
});
</script>

<template>
  <section v-if="!hasEntered" class="entry-screen">
    <div class="entry-grid"></div>
    <div class="entry-content">
      <div class="entry-brand">
        <div class="brand-mark large">BNB</div>
        <span>Gerencia de Analitica de Datos</span>
      </div>
      <h1>Hub Analitica</h1>
      <p>
        Inteligencia comercial para cartera, cumplimiento, mercado y seguimiento ejecutivo del Banco Nacional de
        Bolivia.
      </p>
      <Button class="entry-button" @click="hasEntered = true">
        <span>Comenzar</span>
        <font-awesome-icon icon="arrow-right"/>
      </Button>
      <small>Generado y desarrollado por el equipo de Gerencia de Analitica de Datos.</small>
    </div>
  </section>

  <div v-else class="app-shell">
    <aside class="sidebar" :class="{ open: menuOpen }">
      <div class="brand">
        <div class="brand-mark">BNB</div>
        <div>
          <strong>Hub Analitico</strong>
          <span>Gestion de cartera</span>
        </div>
      </div>

      <nav class="nav-list">
        <template v-for="section in sections" :key="section.id">
          <button
              v-if="!section.children"
              class="nav-item"
              :class="{ active: active === section.id }"
              @click="setActive(section.id)"
          >
            <font-awesome-icon :icon="section.icon"/>
            <span>{{ section.label }}</span>
          </button>

          <div v-else class="nav-group">
            <button
                class="nav-group-title"
                :class="{ active: active === section.id }"
                @click="setActive(section.id)"
            >
              <font-awesome-icon :icon="section.icon"/>
              <span>{{ section.label }}</span>
              <font-awesome-icon icon="chevron-down"/>
            </button>
            <button
                v-for="child in section.children"
                :key="child.id"
                class="nav-subitem"
                :class="{ active: active === child.id }"
                @click="setActive(child.id)"
            >
              <font-awesome-icon :icon="child.icon"/>
              <span>{{ child.label }}</span>
            </button>
          </div>
        </template>
      </nav>

      <div class="sidebar-status">
        <span class="pulse"></span>
        <div>
          <strong>{{ dataMode === 'sql-server' ? 'SQL Server' : 'Datos demo' }}</strong>
          <span>{{ dataMode === 'sql-server' ? 'Conexion activa' : 'Modo sin credenciales' }}</span>
        </div>
      </div>

      <div class="sidebar-credit">
        Desarrollado por<br/>
        <strong>Gerencia de Analitica de Datos</strong>
      </div>
    </aside>

    <div v-if="menuOpen" class="scrim" @click="menuOpen = false"></div>

    <main class="workspace">
      <header class="topbar">
        <Button class="mobile-menu" text rounded @click="menuOpen = true">
          <font-awesome-icon icon="bars"/>
        </Button>
        <div>
          <p>Banco Nacional de Bolivia</p>
          <h1>{{ activeTitle }}</h1>
        </div>
        <div class="topbar-actions">
          <Dropdown v-model="selectedPeriod" :options="periods" class="period-select"/>
          <Tag
              :severity="dataMode === 'sql-server' ? 'success' : 'warning'"
              :value="dataMode === 'sql-server' ? 'En vivo' : 'Demo'"
          />
        </div>
      </header>

      <section v-if="showFilters" class="filter-bar">
        <div class="filter-field">
          <label>Fecha corte</label>
          <Dropdown
              v-model="filtersDraft.fecha"
              :options="dateOptions"
              placeholder="yyyy-mm-dd"
              append-to="body"
          />
        </div>
        <div class="filter-field">
          <label>Sucursal</label>
          <MultiSelect
              v-model="filtersDraft.sucursal"
              :options="catalogs.sucursales"
              placeholder="Seleccione sucursales"
              :maxSelectedLabels="2"
              display="chip"
              :showToggleAll="true"
              append-to="body"
          />
        </div>
        <div class="filter-field">
          <label>Agencia</label>
          <MultiSelect
              v-model="filtersDraft.agencia"
              :options="catalogs.agencias"
              optionLabel="label"
              optionValue="cod"
              placeholder="Cod. agencia (DimAgencia)"
              :maxSelectedLabels="2"
              display="chip"
              :showToggleAll="true"
              filter
              filterPlaceholder="Buscar por código o nombre"
              append-to="body"
          />
        </div>
        <div class="filter-field">
          <label>Producto</label>
          <MultiSelect
              v-model="filtersDraft.producto"
              :options="productOptions"
              placeholder="Seleccione productos"
              :maxSelectedLabels="2"
              display="chip"
              :showToggleAll="true"
              append-to="body"
          />
        </div>
        <div v-if="showBankFilter" class="filter-field">
          <label>Banco</label>
          <Dropdown v-model="filtersDraft.banco" :options="catalogs.bancos" append-to="body"/>
        </div>
        <div class="filter-actions">
          <Button label="Aplicar" @click="applyFilters"/>
          <Button label="Limpiar" outlined @click="resetFilters"/>
        </div>
      </section>

      <section v-if="loading" class="loading-state">
        <ProgressBar mode="indeterminate"/>
        <p>Cargando fuentes del hub...</p>
      </section>

      <template v-else>
        <!-- ═══ PORTADA ═══════════════════════════════════════════════════════ -->
        <section v-show="active === 'portada'" class="page-grid">
          <div class="hero-panel">
            <div class="hero-copy">
              <span class="section-kicker">Hub Analítico BNB · En vivo</span>
              <h2>Dashboard Ejecutivo</h2>
              <p>KPIs, proyecciones financieras, benchmarking del sistema financiero y consulta asistida por IA sobre
                fuentes oficiales.</p>
            </div>
            <div class="score-card">
              <span>Estado del portafolio</span>
              <div class="sem-lights">
                <div class="sem-light sl-r" :class="{ on: scoreLight.light === 'r' }"></div>
                <div class="sem-light sl-y" :class="{ on: scoreLight.light === 'y' }"></div>
                <div class="sem-light sl-g" :class="{ on: scoreLight.light === 'g' }"></div>
              </div>
              <strong>{{ scoreLight.score }}</strong>
              <p>{{ scoreLight.label }}</p>
              <ProgressBar :value="Math.min(summary.cumplimientoPct || 0, 100)"/>
            </div>
          </div>

          <div class="hero-stats-bar">
            <div v-for="(stat, i) in heroInlineStats" :key="i" class="hero-stat-item">
              <div class="hero-stat-val" :class="{ pos: stat.pos === true, neg: stat.pos === false }">{{
                  stat.val
                }}
              </div>
              <div class="hero-stat-lbl">{{ stat.lbl }}</div>
            </div>
          </div>

          <div class="section-header">
            <div><span>Alertas</span>
              <h3>Señales del período</h3></div>
            <Tag severity="warning" value="Excepciones"/>
          </div>
          <div class="alert-grid">
            <div
                v-for="alert in summary.alerts"
                :key="alert.id"
                class="alert-item-rich"
                :class="`alert-${alert.level}`"
            >
              <div class="alert-icon-rich">{{ alert.emoji }}</div>
              <div class="alert-body-rich">
                <div class="alert-title-rich">{{ alert.title }}</div>
                <div class="alert-text-rich">{{ alert.body }}</div>
              </div>
              <div class="alert-badge-rich" :class="`badge-${alert.level}`">{{ alert.badge }}</div>
            </div>
          </div>

          <div class="section-header">
            <div><span>Diagnostico comercial</span>
              <h3>Lecturas rapidas del estado actual</h3></div>
          </div>
          <div class="health-grid">
            <Card v-for="item in commercialHealth" :key="item.title" class="health-card" :class="`health-${item.tone}`">
              <template #content>
                <span>{{ item.title }}</span>
                <strong>{{ item.value }}</strong>
                <p>{{ item.status }}</p>
              </template>
            </Card>
          </div>
        </section>

        <!-- ═══ CARTERA ═══════════════════════════════════════════════════════ -->
        <section v-show="active === 'cartera'" class="page-grid">
          <div class="section-header">
            <div><span>Cartera</span>
              <h3>Vista integral del dominio comercial</h3></div>
            <Tag severity="success" value="Interactivo"/>
          </div>

          <div class="overview-grid">
            <Card v-for="item in carteraSnapshot" :key="item.label" class="overview-card">
              <template #content>
                <font-awesome-icon :icon="item.icon"/>
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <small>{{ item.helper }}</small>
              </template>
            </Card>
          </div>

          <div class="system-grid">
            <Card>
              <template #title>
                <div class="card-title-row">
                  <span>Evolucion stock vs presupuesto</span>
                  <Dropdown v-model="chartFilters.projectionProduct" :options="catalogs.productosBNB"
                            class="mini-select"/>
                </div>
              </template>
              <template #content>
                <div class="chart-box compact">
                  <Chart type="bar" :data="flowChart" :options="chartOptions"/>
                </div>
              </template>
            </Card>
            <Card>
              <template #title>Accesos de cartera</template>
              <template #content>
                <div class="module-actions">
                  <Button label="KPIs ejecutivos" icon="pi pi-chart-line" @click="setActive('kpis')"/>
                  <Button label="Proyeccion" icon="pi pi-arrow-up-right" outlined @click="setActive('proyeccion')"/>
                  <Button label="Sistema financiero" icon="pi pi-table" outlined @click="setActive('sistema')"/>
                  <Button label="Agente IA" icon="pi pi-comments" outlined @click="setActive('agente')"/>
                </div>
              </template>
            </Card>
          </div>

          <div class="system-grid">
            <Card>
              <template #title>Participación BNB por producto (%)</template>
              <template #content>
                <div class="chart-box compact">
                  <Chart type="bar" :data="marketChart" :options="pctChartOptions"/>
                </div>
              </template>
            </Card>
            <Card>
              <template #title>Reglas de interpretación</template>
              <template #content>
                <div class="rule-note-list">
                  <div><strong>CONSUMO SF</strong><span>Agrupa consumo, vehicular y tarjetas de crédito en sistema financiero.</span>
                  </div>
                  <div><strong>Cumplimiento</strong><span>stock / presupuesto × 100. Si presupuesto = 0 → N/A.</span>
                  </div>
                  <div><strong>BNB en mercado</strong><span>Código exacto <code>sf.banco = 'BNB'</code> en Hub_CarteraSF.</span>
                  </div>
                  <div><strong>Montos</strong><span>Todos los valores monetarios expresados en USD.</span></div>
                </div>
              </template>
            </Card>
          </div>
        </section>

        <!-- ═══ GOBERNANZA ════════════════════════════════════════════════════ -->
        <section v-show="active === 'gobernanza'" class="page-grid">
          <div class="section-header">
            <div><span>Fuente de verdad</span>
              <h3>Marco comercial de cartera</h3></div>
            <Tag severity="success" value="SELECT / WITH"/>
          </div>

          <div class="governance-grid">
            <Card>
              <template #title>Tablas habilitadas</template>
              <template #content>
                <div class="table-list">
                  <div>
                    <strong>Hub_CarteraBNB</strong><span>stock, Desembolso, pendiente, presupuesto, amortizacion</span>
                  </div>
                  <div><strong>DimAgencia</strong><span>Region, Sucursal, Agencia y nombres alternativos</span></div>
                  <div><strong>Hub_CarteraSF</strong><span>banco, segmentacioncredito, Sucursal, monto</span></div>
                  <div><strong>Hub_OONN</strong><span>Oficial y MontoDesembolsoDolares</span></div>
                </div>
              </template>
            </Card>
            <Card>
              <template #title>Reglas criticas</template>
              <template #content>
                <ul class="rules-list">
                  <li>Cumplimiento = <code>SUM(s.stock) / SUM(s.presupuesto) * 100</code>.</li>
                  <li>Banco propio en SF = <code>sf.banco = 'BNB'</code>.</li>
                  <li>No se usa <code>SaldoDeudor</code>, <code>Pendiente</code>, <code>Presupuesto</code> ni <code>Amortizacion</code>.
                  </li>
                  <li>CONSUMO homologado incluye consumo, vehicular y tarjetas.</li>
                </ul>
              </template>
            </Card>
          </div>

          <Card class="formula-card">
            <template #content>
              <span>Relacion financiera referencial</span>
              <strong>stock(t) ~= stock(t-1) + Desembolso(t) - amortizacion(t)</strong>
              <p>La diferencia puede explicarse por ajustes contables, castigos, ventas o reclasificaciones.</p>
            </template>
          </Card>
        </section>

        <!-- ═══ KPIs ══════════════════════════════════════════════════════════ -->
        <section v-show="active === 'kpis'" class="page-grid">
          <div class="section-header">
            <div><span>Cartera</span>
              <h3>KPIs ejecutivos</h3></div>
            <Tag severity="info" :value="dateIso(summary.fechaCorte)"/>
          </div>

          <div class="kpi-grid">
            <Card v-for="kpi in kpis" :key="kpi.key" class="kpi-card" :class="kpiSeverityClass[kpi.severity]">
              <template #content>
                <div class="kpi-top">
                  <span>{{ kpi.label }}</span>
                  <font-awesome-icon :icon="kpi.icon"/>
                </div>
                <strong>{{ kpiValue(kpi) }}</strong>
                <small :class="trendClass(kpi.delta)">
                  {{ kpi.delta === null || kpi.delta === undefined ? 'Meta vigente' : percent(kpi.delta) }}
                  <span>{{ kpi.deltaLabel }}</span>
                </small>
              </template>
            </Card>
          </div>

          <Card class="mt-4">
            <template #title>Detalle por producto</template>
            <template #content>
              <DataTable
                  :value="kpisProductData"
                  responsive-layout="scroll"
                  class="product-kpi-table"
                  paginator
                  :rows="10"
                  :rowsPerPageOptions="[10, 20, 50]"
                  sortField="stock"
                  :sortOrder="-1"
              >
                <Column field="producto" header="Producto">
                  <template #body="{ data }">
                    <strong>{{ data.producto }}</strong>
                  </template>
                </Column>

                <Column field="stock" header="Stock Actual">
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.stock) }}</strong>
                  </template>
                </Column>

                <Column field="crecimientoPct" header="Crecimiento">
                  <template #body="{ data }">
          <span :class="trendClass(data.crecimientoPct)">
            {{ data.crecimientoPct > 0 ? '+' : '' }}{{ percent(data.crecimientoPct) }}
          </span>
                  </template>
                </Column>

                <Column field="desembolsos" header="Desembolsos">
                  <template #body="{ data }">
                    {{ moneyFull(data.desembolsos) }}
                  </template>
                </Column>

                <Column field="amortizacion" header="Amortización">
                  <template #body="{ data }">
                    {{ moneyFull(data.amortizacion) }}
                  </template>
                </Column>

                <Column field="presupuesto" header="Presupuesto">
                  <template #body="{ data }">
                    {{ moneyFull(data.presupuesto) }}
                  </template>
                </Column>

                <Column field="cumplimientoPct" header="Cumplimiento">
                  <template #body="{ data }">
                    <div class="kpi-progress">
            <span :class="Number(data.cumplimientoPct || 0) >= 100 ? 'text-green' : 'text-danger'">
              {{ percent(data.cumplimientoPct) }}
            </span>

                      <ProgressBar
                          :value="progressValue(data.cumplimientoPct)"
                          :class="Number(data.cumplimientoPct || 0) >= 100 ? 'prog-green' : 'prog-red'"
                      />
                    </div>
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>

          <Card>
            <template #title>Ranking por oficial de negocios</template>
            <template #content>
              <DataTable
                  :value="oficiales"
                  v-model:first="oficialesFirst"
                  responsive-layout="scroll"
                  paginator
                  :rows="15"
                  :rowsPerPageOptions="[15, 30, 50, 100]"
                  sortField="desembolso"
                  :sortOrder="-1"
              >
                <Column header="#" style="width:42px;text-align:center">
                  <template #body="{ index }"><span class="rank-badge">{{ oficialesFirst + index + 1 }}</span></template>
                </Column>
                <Column field="oficial" header="Oficial"/>
                <Column field="nombreAgencia" header="Agencia"/>
                <Column field="sucursal" header="Sucursal"/>
                <Column header="Desembolso USD" sortable sort-field="desembolso">
                  <template #body="{ data }"><strong>{{ moneyFull(data.desembolso) }}</strong></template>
                </Column>
                <Column header="% sucursal" sortable sort-field="participacionSucursalPct">
                  <template #body="{ data }">
                    <div class="rank-bar-wrap">
                      <div
                          class="rank-bar"
                          :style="{
                            width: (Number(data.participacionSucursalPct) || 0).toFixed(1) + '%'
                          }"
                      ></div>
                      <span>{{ percent(data.participacionSucursalPct) }}</span>
                    </div>
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </section>

        <!-- ═══ PROYECCIÓN ════════════════════════════════════════════════════ -->
        <section v-show="active === 'proyeccion'" class="page-grid">
          <div class="section-header">
            <div><span>Escenarios</span>
              <h3>Proyeccion financiera 2026</h3></div>
            <div class="scenario-actions">
              <Button
                  v-for="item in scenarios"
                  :key="item.value"
                  :label="item.label"
                  :outlined="scenario !== item.value"
                  @click="changeScenario(item.value)"
              />
            </div>
          </div>

          <div class="chart-filter-card">
            <div>
              <label>Métrica del gráfico</label>
              <Dropdown v-model="chartFilters.projectionMetric" :options="projectionMetrics" append-to="body"/>
            </div>
            <div class="proj-products">
              <label>Desglose por producto</label>
              <div class="chip-list">
                <button
                    v-for="prod in catalogs.productosBNB.filter((p) => p !== 'TODOS')"
                    :key="prod"
                    class="prod-chip"
                    :class="{ active: selectedProjProducts.includes(prod) }"
                    @click="toggleProjProduct(prod)"
                >
                  {{ prod }}
                </button>
              </div>
            </div>
          </div>

          <Card>
            <template #content>
              <div class="proy-legend">
                <div v-for="ds in projectionChart.datasets" :key="ds.label" class="proy-leg-item">
                  <div
                      class="proy-leg-line"
                      :class="{ dashed: !!ds.borderDash, solid: !ds.borderDash }"
                      :style="{ background: !ds.borderDash ? ds.borderColor : 'transparent', borderColor: ds.borderColor }"
                  ></div>
                  <span>{{ ds.label }}</span>
                </div>
              </div>
              <div class="chart-box">
                <Chart type="line" :data="projectionChart" :options="chartOptions"/>
              </div>
            </template>
          </Card>
        </section>

        <!-- ═══ SISTEMA FINANCIERO ════════════════════════════════════════════ -->
        <section v-show="active === 'sistema'" class="page-grid">
          <div class="section-header">
            <div><span>Benchmarking</span>
              <h3>Sistema financiero</h3></div>
            <Tag value="Denominador incluye BNB" severity="success"/>
          </div>

          <div class="chart-filter-card">
            <div>
              <label>Banco del grafico</label>
              <Dropdown v-model="chartFilters.marketBank" :options="catalogs.bancos" append-to="body"/>
            </div>
            <div>
              <label>Producto del grafico</label>
              <Dropdown v-model="chartFilters.marketProduct" :options="catalogs.productosSF" append-to="body"/>
            </div>
          </div>

          <div class="system-grid">
            <Card>
              <template #title>
                <div class="card-title-row">
                  <span>Heatmap por banco — crecimiento (%)</span>
                </div>
              </template>
              <template #content>
                <table class="heat-table sf-matrix-table">
                  <thead>
                  <tr>
                    <th>Producto</th>
                    <th v-for="banco in benchmarkMatrix.bancos" :key="banco" :class="{ 'bnb-col': banco === 'BNB' }" style="text-align: center;">
                       <span class="bdot" :class="{ bnb: banco === 'BNB' }" style="display:inline-block; margin-right:4px;"></span>
                       {{ banco }}
                    </th>
                    <th style="text-align: center;">Total Sistema</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr v-for="row in benchmarkMatrix.matrix" :key="row.producto">
                    <td><strong>{{ row.producto }}</strong></td>
                    <td v-for="banco in benchmarkMatrix.bancos" :key="banco" :class="{ 'bnb-col': banco === 'BNB' }" style="text-align: center; vertical-align: middle;">
                      <div v-if="row[banco]" class="sf-cell">
                        <div :class="heatClass(row[banco].crecimientoPct)" style="font-weight: 600; margin-bottom: 4px;">
                          {{ row[banco].crecimientoPct !== null ? (row[banco].crecimientoPct > 0 ? '↑ +' : '↓ ') + row[banco].crecimientoPct.toFixed(2) + '%' : 'Sin datos' }}
                        </div>
                        <div class="sf-stock" style="font-size: 0.85em; color: #666; font-weight: 500;">
                          {{ moneyFull(row[banco].total) }}
                        </div>
                      </div>
                      <div v-else class="heat-empty">--</div>
                    </td>
                    <td style="text-align: center; vertical-align: middle;">
                      <strong>{{ moneyFull(row.rowTotal) }}</strong>
                    </td>
                  </tr>
                  </tbody>
                </table>
              </template>
            </Card>

            <Card>
              <template #title>Participación BNB por producto (%)</template>
              <template #content>
                <div class="chart-box compact">
                  <Chart type="bar" :data="marketChart" :options="pctChartOptions"/>
                </div>
              </template>
            </Card>

            <Card class="mt-4" style="grid-column: 1 / -1;">
              <template #title>Oportunidad de mercado (Stock vs Crecimiento)</template>
              <template #content>
                <div class="chart-box">
                  <Chart type="bubble" :data="scatterChart" :options="scatterOptions"/>
                </div>
              </template>
            </Card>
          </div>
        </section>

        <!-- ═══ AGENTE IA ══════════════════════════════════════════════════════ -->
        <section v-show="active === 'agente'" class="page-grid">
          <div class="section-header">
            <div><span>Consulta asistida</span>
              <h3>Agente IA de cartera</h3></div>
            <Tag severity="success" value="Backend seguro"/>
          </div>

          <Card class="chat-card">
            <template #content>
              <div class="chat-messages">
                <div v-for="(message, index) in chat" :key="index" class="chat-message" :class="message.role">
                  <div class="chat-avatar">
                    <font-awesome-icon :icon="message.role === 'bot' ? 'brain' : 'user-tie'"/>
                  </div>
                  <p>{{ message.text }}</p>
                </div>
                <div v-if="chatLoading" class="chat-message bot">
                  <div class="chat-avatar">
                    <font-awesome-icon icon="brain"/>
                  </div>
                  <p>Analizando reglas comerciales...</p>
                </div>
              </div>
              <div class="prompt-row">
                <Button label="Explica la brecha" outlined @click="sendChat('Explica la brecha presupuestaria')"/>
                <Button label="BNB vs competencia" outlined @click="sendChat('Como esta BNB vs la competencia?')"/>
                <Button label="Ranking oficiales" outlined @click="sendChat('Dame el ranking por oficial')"/>
              </div>
              <div class="chat-input">
                <Textarea
                    v-model="chatInput"
                    rows="2"
                    auto-resize
                    placeholder="Escribe tu consulta sobre el portafolio..."
                    @keydown.enter.exact.prevent="sendChat()"
                />
                <Button @click="sendChat()">
                  <font-awesome-icon icon="arrow-right"/>
                </Button>
              </div>
            </template>
          </Card>
        </section>

        <!-- ═══ CAPTACIONES ════════════════════════════════════════════════════ -->
        <section v-show="active === 'captaciones'" class="page-grid">
          <div class="section-header">
            <div><span>Captaciones</span>
              <h3>Hub preparado para fuentes futuras</h3></div>
            <Tag severity="warning" value="Pendiente de BD"/>
          </div>
          <div class="overview-grid">
            <Card v-for="item in captacionCards" :key="item.title" class="overview-card">
              <template #content>
                <font-awesome-icon :icon="item.icon"/>
                <span>{{ item.title }}</span>
                <p>{{ item.body }}</p>
              </template>
            </Card>
          </div>
          <Card>
            <template #title>Filtros listos para conectar</template>
            <template #content>
              <p class="muted-copy">
                Fecha, sucursal y producto ya quedan modelados en la interfaz. Cuando se definan las tablas de
                captaciones,
                se conectan al mismo patron de endpoints sin cambiar la experiencia.
              </p>
            </template>
          </Card>
        </section>

        <!-- ═══ CAPTACIONES HIJOS ═════════════════════════════════════════════ -->
        <section v-show="active.startsWith('capt-')" class="page-grid">
          <Card class="placeholder-card">
            <template #content>
              <font-awesome-icon icon="building-columns"/>
              <h3>Modulo de captaciones en preparacion</h3>
              <p>No hay tablas declaradas para captaciones en el manual comercial, por eso queda como placeholder
                controlado.</p>
              <Tag severity="warning" value="Fuente pendiente"/>
            </template>
          </Card>
        </section>

        <!-- ═══ ACTUALIZACIONES ════════════════════════════════════════════════ -->
        <section v-show="active === 'actualizaciones'" class="page-grid">
          <div class="section-header">
            <div><span>Observabilidad de datos</span>
              <h3>Estado de fuentes</h3></div>
            <Tag
                :severity="dataMode === 'sql-server' ? 'success' : 'warning'"
                :value="dataMode === 'sql-server' ? 'SQL Server' : 'Mock activo'"
            />
          </div>
          <div class="source-grid">
            <Card v-for="source in fuentes" :key="source.fuente" class="source-card">
              <template #content>
                <div class="source-icon">
                  <font-awesome-icon icon="database"/>
                </div>
                <div>
                  <strong>{{ source.fuente }}</strong>
                  <span>{{ source.tipo }}</span>
                </div>
                <dl>
                  <div>
                    <dt>Tabla</dt>
                    <dd>{{ source.tabla }}</dd>
                  </div>
                  <div>
                    <dt>Corte</dt>
                    <dd>{{ dateIso(source.fechaCorte) }}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{{ source.estado }}</dd>
                  </div>
                </dl>
              </template>
            </Card>
          </div>
          <Card class="credit-card">
            <template #content>
              <span>Creditos</span>
              <strong>Generado y desarrollado por el equipo de Gerencia de Analitica de Datos.</strong>
            </template>
          </Card>
        </section>
      </template>
    </main>
  </div>
</template>
