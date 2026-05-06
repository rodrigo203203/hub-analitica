<script setup>
import {computed, onMounted, ref} from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Chart from 'primevue/chart';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Divider from 'primevue/divider';
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import ProgressBar from 'primevue/progressbar';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import {marked} from 'marked';
import {api} from './api';
import {dateIso, money, moneyFull, percent} from './format';

// ─────────────────────────────────────────────────────────────
// Helpers base
// ─────────────────────────────────────────────────────────────

function formatDesembolsoMiles(value) {
  const n = Math.round(Number(value || 0) / 1000);
  return n.toLocaleString('en-US');
}

function fmtMoneyPrompt(value) {
  const n = Number(value || 0);

  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function fmtPctPrompt(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return `${Number(value).toFixed(2)}%`;
}

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function toPeriodYYYYMM(value) {
  if (!value) return 'Último periodo disponible';

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text.slice(0, 7).replace('-', '');
  }

  if (/^\d{4}-\d{2}$/.test(text)) {
    return text.replace('-', '');
  }

  if (/^\d{6}$/.test(text)) {
    return text;
  }

  return text;
}

function signedMoneyFull(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';

  return `${sign}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function fullMoneyFromTimeSeries(value) {
  const n = Number(value || 0);

  // La serie histórica viene en millones desde el backend.
  // Por eso se multiplica por 1_000_000 para mostrar monto completo.
  return n * 1_000_000;
}

function moneyFullNoDecimals(value) {
  const n = Number(value || 0);

  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function signedMoneyFullNoDecimals(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';

  return `${sign}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function productGrowthAmount(row) {
  const directValue = Number(row?.crecimientoMonto);

  if (Number.isFinite(directValue) && directValue !== 0) {
    return directValue;
  }

  const stock = Number(row?.stock || 0);
  const stockBase = Number(row?.stockBase || 0);

  return stock - stockBase;
}

// ─────────────────────────────────────────────────────────────
// Menú
// ─────────────────────────────────────────────────────────────

const sections = [
  {id: 'portada', label: 'Portada', icon: 'house'},
  {id: 'gobernanza', label: 'Gobernanza', icon: 'shield-halved'},
  {id: 'organigrama', label: 'Organigrama', icon: 'sitemap'},
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

// ─────────────────────────────────────────────────────────────
// Estado UI
// ─────────────────────────────────────────────────────────────

const active = ref('portada');
const hasEntered = ref(false);
const menuOpen = ref(false);
const sidebarCollapsed = ref(false);
const dataMode = ref('mock');
const selectedPeriod = ref('Ultimo corte');
const periods = ['Ultimo corte', '2026 Q2', '2026 Q1', '2025 cierre'];

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

// ─────────────────────────────────────────────────────────────
// Catálogos y filtros
// ─────────────────────────────────────────────────────────────

const catalogs = ref({
  fechas: [],
  fechasSF: [],
  sucursales: ['TODAS'],
  productosBNB: ['TODOS'],
  productosSF: ['TODOS'],
  bancos: ['TODOS'],
  agencias: []
});

const filtersDraft = ref(initialFilterState());
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

// ─────────────────────────────────────────────────────────────
// Datos
// ─────────────────────────────────────────────────────────────

const loading = ref(true);
const summary = ref(null);
const kpis = ref([]);
const kpisProductData = ref([]);
const projection = ref([]);
const projectionProductData = ref({});
const selectedProjProducts = ref(['CONSUMO', 'VIVIENDA']);
const benchmark = ref([]);
const marketShare = ref([]);
const oficiales = ref([]);
const oficialesFirst = ref(0);
const fuentes = ref([]);
const filteredTimeSeries = ref([]);

// ─────────────────────────────────────────────────────────────
// Chat y memoria temporal
// ─────────────────────────────────────────────────────────────

const chatInput = ref('');
const chatLoading = ref(false);
const useMcp = ref(false);
const chatMemory = ref([]);
const MAX_MEMORY_MESSAGES = 10;

const chat = ref([
  {
    role: 'bot',
    text: 'Hola. Soy el Analista IA de cartera. Puedo ayudarte a explorar KPIs, interpretar la brecha presupuestaria, comparar BNB con el sistema financiero y revisar el desempeño comercial. ¿Qué quieres saber?'
  }
]);

function compactPromptForMemory(text, maxLength = 2500) {
  const clean = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();

  if (clean.length <= maxLength) return clean;

  return `${clean.slice(0, maxLength)}...`;
}

function buildConversationMemoryText() {
  if (!chatMemory.value.length) {
    return 'No existe contexto conversacional previo en esta sesión.';
  }

  return chatMemory.value
      .slice(-MAX_MEMORY_MESSAGES)
      .map((item, index) => {
        const role = item.role === 'user' ? 'Usuario' : 'Asistente';
        return `${index + 1}. ${role}: ${compactPromptForMemory(item.text, 1200)}`;
      })
      .join('\n');
}

function buildMessageWithMemory(currentMessage) {
  return `
Contexto conversacional previo de esta sesión:
${buildConversationMemoryText()}

Consulta actual del usuario:
${currentMessage}

Instrucción de continuidad:
- Responde considerando el contexto conversacional previo.
- Si la consulta actual hace referencia a "lo anterior", "ese producto", "la brecha", "la competencia", "los oficiales" o términos similares, usa el contexto previo para mantener continuidad.
- No repitas todo el análisis anterior si no es necesario.
- Responde directamente a la nueva pregunta.
- Si el contexto previo no alcanza para responder, indica qué dato falta.
`.trim();
}

function addToChatMemory(role, text) {
  chatMemory.value.push({
    role,
    text: compactPromptForMemory(text)
  });

  if (chatMemory.value.length > MAX_MEMORY_MESSAGES) {
    chatMemory.value = chatMemory.value.slice(-MAX_MEMORY_MESSAGES);
  }
}

function clearChatSessionMemory() {
  chatMemory.value = [];

  chat.value = [
    {
      role: 'bot',
      text: 'Memoria temporal limpiada. Podemos iniciar un nuevo análisis.'
    }
  ];
}

// ─────────────────────────────────────────────────────────────
// Organigrama
// ─────────────────────────────────────────────────────────────

const orgArea = {
  gerente: {
    nombre: 'Rony Rojas',
    cargo: 'Gerente Analítica de Datos',
    icon: 'user-tie',
    tone: 'manager'
  },
  equipo: [
    {
      nombre: 'Marcelo Fraija',
      cargo: 'Analista de Información',
      icon: 'chart-simple',
      tone: 'analyst',
      agentes: [
        {
          nombre: 'Agente IA Macroeconómico',
          cargo: 'Agente especializado',
          icon: 'robot',
          tone: 'agent'
        },
        {
          nombre: 'Agente IA Datos Cartera',
          cargo: 'Agente especializado',
          icon: 'brain',
          tone: 'agent'
        }
      ]
    },
    {
      nombre: 'Lucia Perez',
      cargo: 'Gestor de Datos',
      icon: 'database',
      tone: 'data'
    },
    {
      nombre: 'Marcelo Cabrera',
      cargo: 'Analista Sr. de Datos',
      icon: 'ranking-star',
      tone: 'senior'
    },
    {
      nombre: 'Rodrigo Morales',
      cargo: 'Analista de Datos',
      icon: 'chart-line',
      tone: 'analyst'
    }
  ]
};

// ─────────────────────────────────────────────────────────────
// Computed generales
// ─────────────────────────────────────────────────────────────

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

const dateOptions = computed(() =>
    active.value === 'sistema'
        ? catalogs.value.fechasSF || catalogs.value.fechas
        : catalogs.value.fechas
);

const showFilters = computed(() =>
    !['gobernanza', 'organigrama', 'agente', 'actualizaciones'].includes(active.value)
);

const productTotals = computed(() => {
  const rows = kpisProductData.value || [];

  const totalStock = rows.reduce((acc, row) => acc + Number(row.stock || 0), 0);
  const totalStockBase = rows.reduce((acc, row) => acc + Number(row.stockBase || 0), 0);
  const totalCrecimientoMonto = rows.reduce((acc, row) => acc + productGrowthAmount(row), 0);
  const totalDesembolsos = rows.reduce((acc, row) => acc + Number(row.desembolsos || 0), 0);
  const totalAmortizacion = rows.reduce((acc, row) => acc + Number(row.amortizacion || 0), 0);
  const totalPresupuesto = rows.reduce((acc, row) => acc + Number(row.presupuesto || 0), 0);

  const totalCrecimientoPct =
      totalStockBase > 0
          ? ((totalStock / totalStockBase) - 1) * 100
          : null;

  const totalCumplimientoPct =
      totalPresupuesto > 0
          ? (totalStock / totalPresupuesto) * 100
          : null;

  return {
    stock: totalStock,
    stockBase: totalStockBase,
    crecimientoMonto: totalCrecimientoMonto,
    crecimientoPct: totalCrecimientoPct,
    desembolsos: totalDesembolsos,
    amortizacion: totalAmortizacion,
    presupuesto: totalPresupuesto,
    cumplimientoPct: totalCumplimientoPct
  };
});

// ─────────────────────────────────────────────────────────────
// Constantes visuales
// ─────────────────────────────────────────────────────────────

const USD_TO_BOB = 6.86;

const PALETTE = [
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

// ─────────────────────────────────────────────────────────────
// Opciones de gráficos
// ─────────────────────────────────────────────────────────────

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {duration: 600, easing: 'easeOutQuart'},
  interaction: {mode: 'index', intersect: false},
  plugins: {
    legend: {
      display: true,
      labels: {
        color: '#4a6355',
        boxWidth: 12,
        padding: 16,
        usePointStyle: true
      }
    },
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
        color: '#6f8177',
        font: {size: 12},
        callback: (value) => `$${Number(value).toLocaleString('en-US')}M`
      }
    }
  }
};

const portadaFlowChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {duration: 600, easing: 'easeOutQuart'},
  interaction: {mode: 'index', intersect: false},
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: '#4a6355',
        boxWidth: 12,
        padding: 16,
        usePointStyle: true,
        filter: (legendItem) => legendItem.text !== 'Diferencia'
      }
    },
    tooltip: {
      ...tooltipBase,
      callbacks: {
        label: (ctx) => {
          const value = Number(ctx.parsed.y || ctx.raw || 0);

          if (ctx.dataset.label === 'Diferencia') {
            return ` Diferencia: ${signedMoneyFullNoDecimals(value)}`;
          }

          return ` ${ctx.dataset.label}: ${moneyFullNoDecimals(value)}`;
        },
        afterBody: (items) => {
          const stockItem = items.find((item) => item.dataset.label === 'Stock ejecutado');
          const presupuestoItem = items.find((item) => item.dataset.label === 'Presupuesto');

          if (!stockItem || !presupuestoItem) return [];

          const stock = Number(stockItem.raw || 0);
          const presupuesto = Number(presupuestoItem.raw || 0);
          const diferencia = stock - presupuesto;
          const cumplimiento = presupuesto > 0 ? (stock / presupuesto) * 100 : null;

          return [
            '',
            `Diferencia: ${signedMoneyFullNoDecimals(diferencia)}`,
            `Cumplimiento: ${cumplimiento === null ? 'N/A' : `${cumplimiento.toFixed(2)}%`}`
          ];
        },
        labelColor: (ctx) => {
          if (ctx.dataset.label === 'Stock ejecutado') {
            return {
              borderColor: '#26b460',
              backgroundColor: '#26b460'
            };
          }

          if (ctx.dataset.label === 'Presupuesto') {
            return {
              borderColor: '#8b5cf6',
              backgroundColor: '#8b5cf6'
            };
          }

          const value = Number(ctx.raw || 0);

          return {
            borderColor: value >= 0 ? '#26b460' : '#e05252',
            backgroundColor: value >= 0 ? '#26b460' : '#e05252'
          };
        }
      }
    }
  },
  scales: {
    x: {
      grid: {color: 'rgba(15,31,22,.04)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        font: {size: 11, weight: '600'},
        autoSkip: false,
        maxRotation: 0,
        minRotation: 0,
        padding: 10
      }
    },
    y: {
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      beginAtZero: false,
      ticks: {
        color: '#6f8177',
        font: {size: 12},
        maxTicksLimit: 12,
        callback: (value) => moneyFullNoDecimals(value)
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
        color: '#6f8177',
        font: {size: 12},
        callback: (value) => `${Number(value).toFixed(1)}%`
      }
    }
  }
};

const horizontalPctChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: {display: false},
    tooltip: {
      ...tooltipBase,
      callbacks: {
        label: (ctx) => ` ${Number(ctx.parsed.x).toFixed(2)}%`
      }
    }
  },
  scales: {
    x: {
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        callback: (value) => `${Number(value).toFixed(0)}%`
      }
    },
    y: {
      grid: {display: false, drawBorder: false},
      ticks: {color: '#4a6355'}
    }
  }
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {duration: 700, easing: 'easeOutQuart'},
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#4a6355',
        boxWidth: 12,
        padding: 16,
        usePointStyle: true
      }
    },
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
          return `${d.product}: Stock ${moneyKFull(d.stockOriginal)} | Crec. ${signedMoneyK(d.crecimientoOriginal)} | Share ${(d.r / 1.5).toFixed(1)}%`;
        }
      }
    }
  },
  scales: {
    x: {
      title: {display: true, text: 'Stock Sistema / 1000', color: '#4a6355'},
      grid: {color: '#e8ecef'},
      ticks: {
        callback: (value) => `$${Number(value).toLocaleString('en-US')}`
      }
    },
    y: {
      title: {display: true, text: 'Crecimiento total / 1000', color: '#4a6355'},
      grid: {color: '#e8ecef'},
      ticks: {
        callback: (value) => `$${Number(value).toLocaleString('en-US')}`
      }
    }
  }
};

// ─────────────────────────────────────────────────────────────
// Computed de gráficos y datos derivados
// ─────────────────────────────────────────────────────────────

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

  if (chartFilters.value.projectionMetric === 'DESEMBOLSOS') {
    return {labels, datasets: allDatasets.filter((d) => d.label.includes('Desemb'))};
  }

  if (chartFilters.value.projectionMetric === 'AMORTIZACION') {
    return {labels, datasets: allDatasets.filter((d) => d.label.includes('Amort'))};
  }

  return {labels, datasets: allDatasets};
});

const flowRows = computed(() => {
  const rows = filteredTimeSeries.value.filter((item) =>
      chartFilters.value.projectionProduct === 'TODOS' || item.producto === chartFilters.value.projectionProduct
  );

  return rows.length ? rows : filteredTimeSeries.value;
});

const flowChart = computed(() => {
  const labels = flowRows.value.map((item) => toPeriodYYYYMM(item.fecha || item.month));

  const stockData = flowRows.value.map((item) => fullMoneyFromTimeSeries(item.stock));
  const presupuestoData = flowRows.value.map((item) => fullMoneyFromTimeSeries(item.presupuesto));
  const diferenciaData = stockData.map((stock, index) => stock - Number(presupuestoData[index] || 0));

  return {
    labels,
    datasets: [
      {
        label: 'Stock ejecutado',
        data: stockData,
        borderColor: '#26b460',
        backgroundColor: 'rgba(38,180,96,.14)',
        borderWidth: 3,
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 8,
        pointBackgroundColor: '#26b460',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      },
      {
        label: 'Presupuesto',
        data: presupuestoData,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,.10)',
        borderWidth: 3,
        tension: 0.35,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 8,
        pointBackgroundColor: '#8b5cf6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      },
      {
        label: 'Diferencia',
        data: diferenciaData,
        borderColor: 'rgba(0,0,0,0)',
        backgroundColor: 'rgba(0,0,0,0)',
        borderWidth: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        showLine: false,
        hidden: true
      }
    ]
  };
});

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

      return (
          prodFilters.length === 0 ||
          prodFilters.includes('TODOS') ||
          prodFilters.includes(item.segmentacioncredito)
      );
    })
);

const marketVisualRows = computed(() =>
    filteredMarketShare.value.filter((item) =>
        chartFilters.value.marketProduct === 'TODOS' ||
        item.segmentacioncredito === chartFilters.value.marketProduct
    )
);

const marketChart = computed(() => ({
  labels: marketVisualRows.value.map((item) => item.segmentacioncredito),
  datasets: [
    {
      label: 'Participación BNB (%)',
      data: marketVisualRows.value.map((item) => item.participacionPct),
      backgroundColor: '#26b460',
      borderRadius: 4
    }
  ]
}));

const scatterChart = computed(() => ({
  datasets: [
    {
      label: 'Productos',
      data: filteredMarketShare.value.map((item) => ({
        x: Number(item.montoSistema || 0) / 1000 / USD_TO_BOB,
        y: Number(item.crecimientoTotal || 0) / 1000 / USD_TO_BOB,
        stockOriginal: item.montoSistema,
        crecimientoOriginal: item.crecimientoTotal,
        product: item.segmentacioncredito,
        r: Math.max(Number(item.participacionPct || 0) * 1.5, 4)
      })),
      backgroundColor: 'rgba(38,180,96,0.6)',
      borderColor: '#26b460'
    }
  ]
}));

const compositionChart = computed(() => ({
  labels: marketVisualRows.value.map((item) => item.segmentacioncredito),
  datasets: [
    {
      data: marketVisualRows.value.map((item) => item.montoBNB / 1_000_000),
      backgroundColor: PALETTE,
      borderColor: '#ffffff',
      borderWidth: 3,
      hoverOffset: 8
    }
  ]
}));

const benchmarkMatrix = computed(() => {
  const rows = filteredBenchmark.value;

  const productosSet = new Set(rows.map((r) => r.producto).filter(Boolean));
  const productos = Array.from(productosSet).sort();

  const bancosSet = new Set(rows.map((r) => r.banco).filter(Boolean));
  const bancos = Array.from(bancosSet).sort((a, b) => a.localeCompare(b));

  const matrix = bancos.map((banco) => {
    const rowObj = {banco};

    let rowStock = 0;
    let rowGrowth = 0;

    productos.forEach((prod) => {
      const found = rows.find((r) => r.producto === prod && r.banco === banco);

      if (found) {
        const stock = Number(found.stock ?? found.total ?? 0);
        const crecimientoTotal = Number(found.crecimientoTotal ?? 0);

        rowObj[prod] = {
          crecimientoPct: found.crecimientoPct,
          crecimientoTotal,
          stock
        };

        rowStock += stock;
        rowGrowth += crecimientoTotal;
      } else {
        rowObj[prod] = null;
      }
    });

    rowObj.rowStock = rowStock;
    rowObj.rowGrowth = rowGrowth;

    rowObj.composition = productos
        .map((prod, i) => {
          const val = rowObj[prod];

          return {
            label: prod,
            value: rowStock > 0 ? ((val?.stock || 0) / rowStock) * 100 : 0,
            color: PALETTE[i % PALETTE.length]
          };
        })
        .filter((c) => c.value > 0);

    return rowObj;
  });

  matrix.sort((a, b) => Number(b.rowGrowth || 0) - Number(a.rowGrowth || 0));

  return {productos, matrix};
});

// ─────────────────────────────────────────────────────────────
// Computed de portada
// ─────────────────────────────────────────────────────────────

const portadaUpdatedAt = computed(() => {
  const dates = [
    summary.value?.fechaCorte,
    ...(fuentes.value || []).map((f) => f.fechaCorte).filter(Boolean)
  ].filter(Boolean);

  if (!dates.length) return 'N/D';

  const latest = dates
      .map((d) => new Date(d))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];

  return latest.toLocaleDateString('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
});

const portadaKpiCards = computed(() => [
  {
    label: 'Stock actual',
    value: moneyFull(summary.value?.stockActual),
    helper: 'Cartera vigente al corte',
    icon: 'chart-line'
  },
  {
    label: 'Presupuesto',
    value: moneyFull(summary.value?.presupuesto),
    helper: 'Meta vigente de stock',
    icon: 'bullseye'
  },
  {
    label: 'Cumplimiento',
    value: percent(summary.value?.cumplimientoPct),
    helper: 'Stock / presupuesto',
    icon: 'gauge-high'
  },
  {
    label: 'Brecha',
    value: moneyFull(summary.value?.brechaPresupuesto),
    helper: 'Diferencia vs presupuesto',
    icon: 'triangle-exclamation'
  },
  {
    label: 'Desembolsos acum.',
    value: moneyFull(summary.value?.desembolsosAcum),
    helper: 'Acumulado anual',
    icon: 'sack-dollar'
  },
  {
    label: 'Amortización',
    value: moneyFull(summary.value?.amortizacion),
    helper: 'Acumulado anual',
    icon: 'rotate'
  }
]);

const portadaTopProducts = computed(() =>
    [...(kpisProductData.value || [])]
        .sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0))
        .slice(0, 5)
);

const portadaCriticalProducts = computed(() =>
    [...(kpisProductData.value || [])]
        .filter((p) => p.cumplimientoPct !== null && p.cumplimientoPct !== undefined)
        .sort((a, b) => Number(a.cumplimientoPct || 0) - Number(b.cumplimientoPct || 0))
        .slice(0, 5)
);

const portadaTopOfficials = computed(() =>
    [...(oficiales.value || [])]
        .sort((a, b) => Number(b.desembolso || 0) - Number(a.desembolso || 0))
        .slice(0, 5)
);

const portadaBestMarketSegment = computed(() => {
  const rows = filteredMarketShare.value || [];
  if (!rows.length) return null;

  return [...rows]
      .filter((r) => r.participacionPct !== null && r.participacionPct !== undefined)
      .sort((a, b) => Number(b.participacionPct || 0) - Number(a.participacionPct || 0))[0] || null;
});

const portadaFastInsights = computed(() => {
  const topProduct = portadaTopProducts.value[0];
  const criticalProduct = portadaCriticalProducts.value[0];
  const topOfficial = portadaTopOfficials.value[0];
  const bestSegment = portadaBestMarketSegment.value;

  return [
    {
      title: 'Producto líder',
      value: topProduct?.producto || 'N/D',
      helper: topProduct ? `${moneyFull(topProduct.stock)} en stock` : 'Sin información',
      tone: 'success'
    },
    {
      title: 'Producto crítico',
      value: criticalProduct?.producto || 'N/D',
      helper: criticalProduct ? `${percent(criticalProduct.cumplimientoPct)} de cumplimiento` : 'Sin información',
      tone: 'danger'
    },
    {
      title: 'Oficial líder',
      value: topOfficial?.oficial || 'N/D',
      helper: topOfficial ? `${formatDesembolsoMiles(topOfficial.desembolso)} en desembolsos` : 'Sin información',
      tone: 'info'
    },
    {
      title: 'Segmento fuerte BNB',
      value: bestSegment?.segmentacioncredito || 'N/D',
      helper: bestSegment ? `${percent(bestSegment.participacionPct)} de participación` : 'Sin información',
      tone: 'warning'
    }
  ];
});

const portadaProductGoalChart = computed(() => ({
  labels: portadaTopProducts.value.map((p) => p.producto),
  datasets: [
    {
      label: 'Stock actual',
      data: portadaTopProducts.value.map((p) => Number(p.stock || 0)),
      backgroundColor: '#26b460',
      borderRadius: 10,
      borderSkipped: false
    },
    {
      label: 'Presupuesto',
      data: portadaTopProducts.value.map((p) => Number(p.presupuesto || 0)),
      backgroundColor: '#8b5cf6',
      borderRadius: 10,
      borderSkipped: false
    }
  ]
}));

const portadaProductGoalOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: '#4a6355',
        boxWidth: 12,
        padding: 16,
        usePointStyle: true
      }
    },
    tooltip: {
      ...tooltipBase,
      callbacks: {
        label: (ctx) => {
          const value = Number(ctx.parsed.x || 0);
          return ` ${ctx.dataset.label}: ${moneyFullNoDecimals(value)}`;
        },
        afterBody: (items) => {
          const stockItem = items.find((item) => item.dataset.label === 'Stock actual');
          const presupuestoItem = items.find((item) => item.dataset.label === 'Presupuesto');

          if (!stockItem || !presupuestoItem) return [];

          const stock = Number(stockItem.raw || 0);
          const presupuesto = Number(presupuestoItem.raw || 0);
          const diferencia = stock - presupuesto;
          const cumplimiento = presupuesto > 0 ? (stock / presupuesto) * 100 : null;

          return [
            '',
            `Diferencia: ${signedMoneyFullNoDecimals(diferencia)}`,
            `Cumplimiento: ${cumplimiento === null ? 'N/A' : `${cumplimiento.toFixed(2)}%`}`
          ];
        },
        labelColor: (ctx) => {
          if (ctx.dataset.label === 'Stock actual') {
            return {
              borderColor: '#26b460',
              backgroundColor: '#26b460'
            };
          }

          return {
            borderColor: '#8b5cf6',
            backgroundColor: '#8b5cf6'
          };
        }
      }
    }
  },
  scales: {
    x: {
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        callback: (value) => moneyFullNoDecimals(value)
      }
    },
    y: {
      grid: {display: false, drawBorder: false},
      ticks: {
        color: '#354158',
        font: {size: 11, weight: '600'}
      }
    }
  }
};


const portadaGrowthLeaders = computed(() => {
  const prodFilters = filtersApplied.value.producto || [];

  const rows = (benchmark.value || []).filter((item) => {
    if (!item.producto) return false;

    return (
        prodFilters.length === 0 ||
        prodFilters.includes('TODOS') ||
        prodFilters.includes(item.producto)
    );
  });

  const grouped = new Map();

  rows.forEach((row) => {
    const producto = row.producto;
    const crecimiento = Number(row.crecimientoTotal || 0);

    if (!grouped.has(producto)) {
      grouped.set(producto, {
        producto,
        banco: row.banco || 'N/D',
        crecimientoTotal: crecimiento,
        crecimientoPct: Number(row.crecimientoPct || 0)
      });
      return;
    }

    const current = grouped.get(producto);

    if (crecimiento > Number(current.crecimientoTotal || 0)) {
      grouped.set(producto, {
        producto,
        banco: row.banco || 'N/D',
        crecimientoTotal: crecimiento,
        crecimientoPct: Number(row.crecimientoPct || 0)
      });
    }
  });

  return Array.from(grouped.values())
      .sort((a, b) => Number(b.crecimientoTotal || 0) - Number(a.crecimientoTotal || 0))
      .slice(0, 6);
});

// ─────────────────────────────────────────────────────────────
// Otros computed de módulos
// ─────────────────────────────────────────────────────────────

const carteraSnapshot = computed(() => [
  {
    label: 'Stock',
    value: moneyFull(summary.value?.stockActual),
    icon: 'chart-line',
    helper: 'Hub_CarteraBNB.stock'
  },
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

// ─────────────────────────────────────────────────────────────
// Prompt builder agente IA
// ─────────────────────────────────────────────────────────────

function buildAppliedFiltersText() {
  const f = filtersApplied.value;
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

function buildExecutiveRulesText() {
  return `
Reglas comerciales obligatorias:
- El objetivo principal es alcanzar o superar el presupuesto de stock.
- Cumplimiento = stock actual / presupuesto * 100.
- Cumplimiento mayor o igual a 100% es positivo.
- Superávit contra presupuesto es excelente.
- Brecha negativa representa déficit contra presupuesto.
- El crecimiento se evalúa contra la base de diciembre 2025.
- En sistema financiero, la participación BNB se calcula sobre el total del sistema financiero, incluyendo BNB en el denominador.
- No inventes datos. Si falta un dato, indica "Dato no disponible".
- Usa únicamente los datos enviados en este mensaje.
`.trim();
}

function buildSummaryText() {
  if (!summary.value) return 'Resumen ejecutivo no disponible.';

  return `
Resumen ejecutivo de cartera:
| Métrica | Valor |
|---|---:|
| Periodo corte | ${toPeriodYYYYMM(summary.value.fechaCorte)} |
| Fecha corte original | ${summary.value.fechaCorte || 'N/A'} |
| Stock actual | ${fmtMoneyPrompt(summary.value.stockActual)} |
| Stock base Dic-25 | ${fmtMoneyPrompt(summary.value.stockBase)} |
| Crecimiento nominal | ${fmtMoneyPrompt(summary.value.crecimientoNominal)} |
| Crecimiento % | ${fmtPctPrompt(summary.value.crecimientoPct)} |
| Desembolsos acumulados | ${fmtMoneyPrompt(summary.value.desembolsosAcum)} |
| Desembolsos del mes | ${fmtMoneyPrompt(summary.value.desembolsosMes)} |
| Amortización acumulada | ${fmtMoneyPrompt(summary.value.amortizacion)} |
| Amortización del mes | ${fmtMoneyPrompt(summary.value.amortizacionMes)} |
| Presupuesto stock | ${fmtMoneyPrompt(summary.value.presupuesto)} |
| Cumplimiento presupuesto | ${fmtPctPrompt(summary.value.cumplimientoPct)} |
| Brecha presupuesto | ${fmtMoneyPrompt(summary.value.brechaPresupuesto)} |
| Estado | ${summary.value.estado || 'N/A'} |
| Score | ${summary.value.score || 'N/A'} |
`.trim();
}

function buildProductsTable(limit = 20) {
  if (!kpisProductData.value?.length) return 'No hay detalle por producto disponible.';

  const rows = [...kpisProductData.value]
      .sort((a, b) => safeNumber(b.stock) - safeNumber(a.stock))
      .slice(0, limit)
      .map((p) => {
        const brecha = safeNumber(p.stock) - safeNumber(p.presupuesto);

        return `| ${p.producto} | ${fmtMoneyPrompt(p.stock)} | ${fmtMoneyPrompt(p.presupuesto)} | ${fmtMoneyPrompt(brecha)} | ${fmtPctPrompt(p.cumplimientoPct)} | ${fmtPctPrompt(p.crecimientoPct)} | ${fmtMoneyPrompt(p.desembolsos)} | ${fmtMoneyPrompt(p.amortizacion)} |`;
      })
      .join('\n');

  return `
Detalle por producto:
| Producto | Stock | Presupuesto | Brecha | Cumplimiento | Crecimiento | Desembolsos | Amortización |
|---|---:|---:|---:|---:|---:|---:|---:|
${rows}
`.trim();
}

function buildMarketTable(limit = 20) {
  const rowsSource = filteredMarketShare.value || [];

  if (!rowsSource.length) return 'No hay datos de participación de mercado disponibles.';

  const rows = [...rowsSource]
      .sort((a, b) => safeNumber(b.crecimientoTotal) - safeNumber(a.crecimientoTotal))
      .slice(0, limit)
      .map((m) =>
          `| ${m.segmentacioncredito} | ${fmtMoneyPrompt(m.montoBNB)} | ${fmtMoneyPrompt(m.montoSistema)} | ${fmtPctPrompt(m.participacionPct)} | ${fmtMoneyPrompt(m.crecimientoTotal)} | ${fmtPctPrompt(m.crecimientoPct)} |`
      )
      .join('\n');

  return `
Participación BNB vs sistema financiero:
| Segmento | Monto BNB | Monto sistema | Participación BNB | Crecimiento sistema | Crecimiento % |
|---|---:|---:|---:|---:|---:|
${rows}
`.trim();
}

function buildCompetitorBenchmarkTable(limit = 80) {
  const rowsSource = filteredBenchmark.value || [];

  if (!rowsSource.length) {
    return 'No hay datos detallados de bancos competidores disponibles.';
  }

  const rows = [...rowsSource]
      .sort((a, b) => {
        const productCompare = String(a.producto || '').localeCompare(String(b.producto || ''));
        if (productCompare !== 0) return productCompare;

        const bnbPriorityA = a.banco === 'BNB' ? -1 : 0;
        const bnbPriorityB = b.banco === 'BNB' ? -1 : 0;
        if (bnbPriorityA !== bnbPriorityB) return bnbPriorityA - bnbPriorityB;

        return safeNumber(b.crecimientoTotal) - safeNumber(a.crecimientoTotal);
      })
      .slice(0, limit)
      .map((b) =>
          `| ${b.producto || 'N/A'} | ${b.banco || 'N/A'} | ${fmtMoneyPrompt(b.stock)} | ${fmtMoneyPrompt(b.stockBase)} | ${fmtMoneyPrompt(b.crecimientoTotal)} | ${fmtPctPrompt(b.crecimientoPct)} |`
      )
      .join('\n');

  return `
Detalle competitivo por banco y producto:
| Producto | Banco | Stock actual | Stock base | Crecimiento total | Crecimiento % |
|---|---|---:|---:|---:|---:|
${rows}
`.trim();
}

function buildOfficialsTable(limit = 15) {
  if (!oficiales.value?.length) return 'No hay ranking de oficiales disponible.';

  const rows = [...oficiales.value]
      .sort((a, b) => safeNumber(b.desembolso) - safeNumber(a.desembolso))
      .slice(0, limit)
      .map((o, idx) =>
          `| ${idx + 1} | ${o.oficial} | ${o.sucursal} | ${o.nombreAgencia} | ${fmtMoneyPrompt(o.desembolso)} | ${fmtPctPrompt(o.participacionAportePct)} |`
      )
      .join('\n');

  return `
Ranking de oficiales:
| Rank | Oficial | Sucursal | Agencia | Desembolso | % aporte |
|---:|---|---|---|---:|---:|
${rows}
`.trim();
}

function buildTimeSeriesTable(limit = 12) {
  if (!filteredTimeSeries.value?.length) return 'No hay serie histórica disponible.';

  const rows = [...filteredTimeSeries.value]
      .slice(-limit)
      .map((t) => {
        const periodo = toPeriodYYYYMM(t.fecha || t.month);

        return `| ${periodo} | ${fmtMoneyPrompt(safeNumber(t.stock) * 1_000_000)} | ${fmtMoneyPrompt(safeNumber(t.presupuesto) * 1_000_000)} | ${fmtMoneyPrompt(safeNumber(t.desembolso) * 1_000_000)} | ${fmtMoneyPrompt(safeNumber(t.amortizacion) * 1_000_000)} | ${fmtPctPrompt(t.cumplimientoPct)} |`;
      })
      .join('\n');

  return `
Serie histórica reciente:
| Periodo yyyymm | Stock | Presupuesto | Desembolso | Amortización | Cumplimiento |
|---|---:|---:|---:|---:|---:|
${rows}
`.trim();
}

function buildAgentPrompt({
                            title,
                            objective,
                            includeMarket = false,
                            includeCompetitors = false,
                            includeOfficials = false,
                            includeTimeSeries = false
                          }) {
  const blocks = [
    'Actúa como Gerente Comercial Senior de un banco y Analista Ejecutivo de Cartera.',
    buildAppliedFiltersText(),
    buildExecutiveRulesText(),
    `
Objetivo del análisis:
${objective}
`.trim(),
    buildSummaryText(),
    buildProductsTable()
  ];

  if (includeMarket) blocks.push(buildMarketTable());
  if (includeCompetitors) blocks.push(buildCompetitorBenchmarkTable());
  if (includeOfficials) blocks.push(buildOfficialsTable());
  if (includeTimeSeries) blocks.push(buildTimeSeriesTable());

  blocks.push(`
Formato obligatorio de respuesta:
1. Resumen ejecutivo en máximo 5 bullets.
2. Diagnóstico comercial de la situación actual.
3. Tabla de hallazgos relevantes con impacto, causa probable y acción sugerida.
4. Análisis de productos críticos, productos líderes y productos con oportunidad.
5. Riesgos comerciales y alertas tempranas.
6. Recomendaciones accionables para gerencia comercial.

Importante:
- Cuando menciones periodos, usa formato yyyymm.
- Si necesitas explicar el rango, indica desde qué periodo hasta qué periodo se observa la serie histórica.
- No menciones proyecciones ni escenarios proyectados.
- No inventes datos futuros.
- Analiza únicamente información real enviada en el mensaje.

Estilo:
- Ejecutivo.
- Directo.
- Basado en datos.
- No genérico.
- No inventes cifras.
- Usa tablas cuando ayuden a comparar.
`.trim());

  return `
# ${title}

${blocks.join('\n\n')}
`.trim();
}

function triggerAnalysis() {
  if (!summary.value) return;

  const finalPrompt = buildAgentPrompt({
    title: 'Análisis integral de cartera',
    objective: `
Realiza un análisis completo del estado real de la cartera usando los KPIs globales,
el detalle por producto, la serie histórica, el desempeño competitivo y el ranking de oficiales.
Identifica salud comercial, brecha contra presupuesto, productos críticos, oportunidades de crecimiento,
riesgos de amortización y acciones recomendadas para mejorar el cumplimiento.

No incluyas proyecciones ni escenarios futuros.
Cuando analices periodos, usa formato yyyymm.
`,
    includeMarket: true,
    includeCompetitors: true,
    includeOfficials: true,
    includeTimeSeries: true
  });

  sendChat(finalPrompt);
}

function triggerBrechaAnalysis() {
  if (!summary.value) return;

  const finalPrompt = buildAgentPrompt({
    title: 'Análisis de brecha presupuestaria',
    objective: `
Explica la brecha presupuestaria actual, separando productos con déficit y productos con superávit.
Determina qué productos arrastran el cumplimiento, qué productos sostienen el resultado y qué acciones
comerciales se deberían tomar para cerrar la brecha contra presupuesto.
`,
    includeMarket: false,
    includeOfficials: false,
    includeTimeSeries: true
  });

  sendChat(finalPrompt);
}

function triggerCompetenciaAnalysis() {
  const finalPrompt = buildAgentPrompt({
    title: 'Análisis competitivo BNB vs sistema financiero',
    objective: `
Compara el desempeño de BNB contra cada banco competidor del sistema financiero.

El análisis debe usar dos niveles:
1. Participación BNB por producto contra el total del sistema financiero.
2. Comparación banco por banco usando stock actual, stock base, crecimiento total y crecimiento porcentual.

Identifica:
- En qué productos BNB tiene mejor posición relativa.
- En qué productos otros bancos están creciendo más que BNB.
- Qué bancos representan mayor presión competitiva por producto.
- Dónde BNB tiene oportunidad de capturar cuota de mercado.
- Dónde BNB debe defender posición.
- Qué acciones comerciales deberían priorizarse por producto y competidor.

No incluyas proyecciones ni escenarios futuros.
Cuando analices periodos, usa formato yyyymm.
`,
    includeMarket: true,
    includeCompetitors: true,
    includeOfficials: false,
    includeTimeSeries: false
  });

  sendChat(finalPrompt);
}

function triggerOficialesAnalysis() {
  const finalPrompt = buildAgentPrompt({
    title: 'Análisis de desempeño por oficiales',
    objective: `
Evalúa el desempeño de la fuerza comercial usando el ranking de oficiales.
Identifica concentración de desembolsos, sucursales/agencias con mayor aporte,
posibles dependencias en pocos oficiales y acciones para replicar mejores prácticas.
`,
    includeMarket: false,
    includeOfficials: true,
    includeTimeSeries: false
  });

  sendChat(finalPrompt);
}

function triggerRiesgoAnalysis() {
  if (!summary.value) return;

  const finalPrompt = buildAgentPrompt({
    title: 'Análisis de riesgos comerciales de cartera',
    objective: `
Identifica riesgos comerciales de cartera considerando brecha presupuestaria,
crecimiento contra diciembre, amortización, desembolsos, productos con bajo cumplimiento
y señales de desaceleración en la serie histórica real.

No incluyas proyecciones ni escenarios futuros.
Cuando analices periodos, usa formato yyyymm.
`,
    includeMarket: false,
    includeOfficials: false,
    includeTimeSeries: true
  });

  sendChat(finalPrompt);
}

function triggerPlanComercialAnalysis() {
  if (!summary.value) return;

  const finalPrompt = buildAgentPrompt({
    title: 'Plan comercial de acción para mejorar cumplimiento',
    objective: `
Diseña un plan comercial accionable para mejorar el cumplimiento de cartera.
El plan debe priorizar productos, oficiales, sucursales/agencias y oportunidades de mercado
usando únicamente datos reales enviados.

No incluyas proyecciones ni escenarios futuros.
Cuando analices periodos, usa formato yyyymm.
`,
    includeMarket: true,
    includeOfficials: true,
    includeTimeSeries: true
  });

  sendChat(finalPrompt);
}

// ─────────────────────────────────────────────────────────────
// Carga de datos
// ─────────────────────────────────────────────────────────────

async function loadAll() {
  loading.value = true;

  const params = {
    fecha: filtersApplied.value.fecha,
    sucursal: filtersApplied.value.sucursal,
    producto: filtersApplied.value.producto,
    agencia: filtersApplied.value.agencia,
    banco: filtersApplied.value.banco
  };

  try {
    const [
      health,
      catalogRes,
      summaryRes,
      kpisRes,
      kpisProdRes,
      timeseriesRes,
      projectionRes,
      benchmarkRes,
      marketRes,
      oficialesRes,
      fuentesRes
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
  } finally {
    loading.value = false;
  }
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
    return;
  }

  selectedProjProducts.value.push(product);

  if (!projectionProductData.value[product]) {
    const res = await api.projectionByProduct(scenario.value, product);
    projectionProductData.value[product] = res.data;
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

// ─────────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────────

async function sendChat(message = chatInput.value) {
  const text = String(message || '').trim();
  if (!text) return;

  chat.value.push({role: 'user', text});
  addToChatMemory('user', text);

  chatInput.value = '';
  chatLoading.value = true;

  try {
    const finalMessage = buildMessageWithMemory(text);
    const response = await api.agentQuery(finalMessage, useMcp.value);
    const answer = response.data.answer;

    chat.value.push({role: 'bot', text: answer});
    addToChatMemory('bot', answer);
  } catch {
    const errorText = 'No pude conectar con el backend del agente. Revisa que el servidor este activo.';

    chat.value.push({
      role: 'bot',
      text: errorText
    });

    addToChatMemory('bot', errorText);
  } finally {
    chatLoading.value = false;
  }
}

function renderMarkdown(text) {
  if (!text) return '';

  const cleanText = String(text)
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();

  return marked.parse(cleanText);
}

// ─────────────────────────────────────────────────────────────
// Navegación
// ─────────────────────────────────────────────────────────────

function toggleSidebar() {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 780px)').matches) {
    menuOpen.value = !menuOpen.value;
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }
}

function setActive(id) {
  active.value = id;
  menuOpen.value = false;
  window.scrollTo({top: 0, behavior: 'smooth'});
}

// ─────────────────────────────────────────────────────────────
// Helpers de presentación
// ─────────────────────────────────────────────────────────────

function kpiValue(kpi) {
  return kpi.unit === 'percent' ? percent(kpi.value) : moneyFull(kpi.value);
}

function trendClass(value) {
  if (value === null || value === undefined) return 'trend-neutral';
  return Number(value) >= 0 ? 'trend-up' : 'trend-down';
}

function progressValue(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.max(0, Math.min(n, 100));
}

function amountK(value) {
  const n = Number(value || 0) / 1000 / USD_TO_BOB;

  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function moneyKFull(value) {
  const n = Number(value || 0) / 1000 / USD_TO_BOB;

  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function signedMoneyK(value) {
  const n = Number(value || 0) / 1000 / USD_TO_BOB;
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';

  return `${sign}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function heatClass(value) {
  if (value === null || value === undefined) return 'heat-empty';
  if (value > 1) return 'heat-good';
  if (value >= -1) return 'heat-watch';
  return 'heat-risk';
}

// ─────────────────────────────────────────────────────────────
// Ciclo de vida
// ─────────────────────────────────────────────────────────────

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

  <div v-else class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
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
        <Button
            class="sidebar-toggle"
            text
            rounded
            aria-label="Menú lateral"
            @click="toggleSidebar"
        >
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
        <div class="loading-skeletons">
          <Card v-for="n in 4" :key="n" class="loading-skel-card">
            <template #content>
              <Skeleton width="40%" class="mb-3"/>
              <Skeleton height="2rem" class="mb-2"/>
              <Skeleton width="70%" height=".85rem"/>
            </template>
          </Card>
        </div>
      </section>

      <template v-else>
        <!-- ═══ PORTADA ═══════════════════════════════════════════════════════ -->
        <section v-show="active === 'portada'" class="page-grid">
          <div class="hero-panel hero-panel-summary">
            <div class="hero-copy">
              <span class="section-kicker">Hub Analítico BNB · Resumen ejecutivo</span>
              <h2>Portada ejecutiva</h2>
              <p>
                Vista resumida del estado actual de cartera, productos, sistema financiero y desempeño comercial,
                construida únicamente con fuentes activas y datos reales disponibles.
              </p>

              <div class="hero-meta-list">
                <div class="hero-meta-item">
                  <font-awesome-icon icon="clock"/>
                  <span>Actualizado al {{ portadaUpdatedAt }}</span>
                </div>
                <div class="hero-meta-item">
                  <font-awesome-icon icon="database"/>
                  <span>{{
                      dataMode === 'sql-server' ? 'Datos en vivo desde SQL Server' : 'Modo demo / sin credenciales'
                    }}</span>
                </div>
                <div class="hero-meta-item">
                  <font-awesome-icon icon="table-cells"/>
                  <span>{{ portadaTopProducts.length }} productos visibles en resumen</span>
                </div>
              </div>
            </div>
          </div>

          <div class="summary-kpi-grid">
            <Card v-for="item in portadaKpiCards" :key="item.label" class="summary-kpi-card">
              <template #content>
                <div class="summary-kpi-top">
                  <span>{{ item.label }}</span>
                  <div class="summary-kpi-icon">
                    <font-awesome-icon :icon="item.icon"/>
                  </div>
                </div>
                <strong>{{ item.value }}</strong>
                <small>{{ item.helper }}</small>
              </template>
            </Card>
          </div>

          <div class="section-header">
            <div>
              <span>Visuales clave</span>
              <h3>Resumen gráfico del estado actual</h3>
            </div>
            <Tag severity="success" value="Resumen real"/>
          </div>

          <div class="system-grid portada-stock-grid">
            <Card class="chart-flow-full elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-green">
                    <font-awesome-icon icon="chart-line"/>
                  </div>
                  <div>
                    <strong>Stock vs presupuesto</strong>
                    <small>Serie histórica con diferencia real vs meta</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box chart-box-stock-budget">
                  <Chart type="line" :data="flowChart" :options="portadaFlowChartOptions"/>
                </div>
              </template>
            </Card>
          </div>

          <div class="system-grid portada-product-goal-grid">
            <Card class="chart-flow-full elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-purple">
                    <font-awesome-icon icon="chart-simple"/>
                  </div>
                  <div>
                    <strong>Stock y meta por producto</strong>
                    <small>Composición de cartera + cumplimiento contra presupuesto</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box chart-box-product-goal">
                  <Chart
                      type="bar"
                      :data="portadaProductGoalChart"
                      :options="portadaProductGoalOptions"
                  />
                </div>
              </template>
            </Card>
          </div>

          <div class="system-grid portada-growth-grid">
            <Card class="chart-flow-full elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-blue">
                    <font-awesome-icon icon="building-columns"/>
                  </div>
                  <div>
                    <strong>Líder en crecimiento por producto</strong>
                    <small>Banco con mayor crecimiento total por producto</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="growth-leaders-grid growth-leaders-wide">
                  <div
                      v-for="(item, index) in portadaGrowthLeaders"
                      :key="`${item.producto}-${item.banco}`"
                      class="growth-leader-card"
                  >
                    <div class="growth-leader-head">
                      <div class="growth-rank">
                        <i class="pi pi-trophy"></i>
                        <span>#{{ index + 1 }}</span>
                      </div>
                      <Tag severity="info" :value="item.banco"/>
                    </div>

                    <div class="growth-leader-body">
                      <strong>{{ item.producto }}</strong>
                      <span class="growth-bank">{{ item.banco }}</span>
                    </div>

                    <div class="growth-leader-metrics">
                      <div>
                        <small>Crecimiento monto</small>
                        <strong>{{ moneyFull(item.crecimientoTotal) }}</strong>
                      </div>
                      <div>
                        <small>Crecimiento %</small>
                        <strong :class="trendClass(item.crecimientoPct)">
                          {{ item.crecimientoPct > 0 ? '+' : '' }}{{ percent(item.crecimientoPct) }}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </Card>
          </div>

          <div class="section-header">
            <div>
              <span>Detalle resumido</span>
              <h3>Productos, oficiales y fuentes</h3>
            </div>
          </div>

          <div class="summary-detail-grid">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-green">
                    <font-awesome-icon icon="table-cells"/>
                  </div>
                  <div>
                    <strong>Top 5 productos por stock</strong>
                    <small>Resumen comercial</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="spotlight-list">
                  <div
                      v-for="(data, index) in portadaTopProducts"
                      :key="data.producto"
                      class="spotlight-item"
                  >
                    <div class="spotlight-rank">
                      <span>{{ index + 1 }}</span>
                    </div>

                    <div class="spotlight-main">
                      <strong>{{ data.producto }}</strong>
                      <div class="spotlight-meta">
                        <span><i class="pi pi-wallet"></i> {{ moneyFull(data.stock) }}</span>
                        <span><i class="pi pi-chart-bar"></i> {{ percent(data.cumplimientoPct) }}</span>
                        <span :class="trendClass(data.crecimientoPct)">
                  <i class="pi pi-arrow-up-right"></i>
                  {{ data.crecimientoPct > 0 ? '+' : '' }}{{ percent(data.crecimientoPct) }}
                </span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-purple">
                    <font-awesome-icon icon="user-tie"/>
                  </div>
                  <div>
                    <strong>Top 5 oficiales por desembolso</strong>
                    <small>Ranking comercial</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="spotlight-list">
                  <div
                      v-for="(data, index) in portadaTopOfficials"
                      :key="`${data.oficial}-${index}`"
                      class="spotlight-item spotlight-official"
                  >
                    <div class="spotlight-rank">
                      <i class="pi pi-star-fill"></i>
                      <span>{{ index + 1 }}</span>
                    </div>

                    <div class="spotlight-main">
                      <strong>{{ data.oficial }}</strong>
                      <div class="spotlight-meta">
                        <span><i class="pi pi-building"></i> {{ data.nombreAgencia }}</span>
                        <span><i class="pi pi-map-marker"></i> {{ data.sucursal }}</span>
                        <span><i class="pi pi-dollar"></i> {{ formatDesembolsoMiles(data.desembolso) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-amber">
                    <font-awesome-icon icon="database"/>
                  </div>
                  <div>
                    <strong>Fuentes activas</strong>
                    <small>Control de actualización</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="source-status-list">
                  <div class="source-status-item">
                    <div class="source-status-left">
                      <i class="pi pi-check-circle"></i>
                      <div>
                        <strong>Cartera BNB</strong>
                        <span>Hub_CarteraBNB</span>
                      </div>
                    </div>
                    <Tag severity="success"
                         :value="dateIso(fuentes.find(f => f.fuente === 'Hub_CarteraBNB')?.fechaCorte) || 'N/D'"/>
                  </div>

                  <div class="source-status-item">
                    <div class="source-status-left">
                      <i class="pi pi-check-circle"></i>
                      <div>
                        <strong>Sistema financiero</strong>
                        <span>Hub_CarteraSF</span>
                      </div>
                    </div>
                    <Tag severity="info"
                         :value="dateIso(fuentes.find(f => f.fuente === 'Hub_CarteraSF')?.fechaCorte) || 'N/D'"/>
                  </div>

                  <div class="source-status-item">
                    <div class="source-status-left">
                      <i class="pi pi-check-circle"></i>
                      <div>
                        <strong>Oficiales</strong>
                        <span>Hub_OONN</span>
                      </div>
                    </div>
                    <Tag severity="warning"
                         :value="dateIso(fuentes.find(f => f.fuente === 'Hub_OONN')?.fechaCorte) || 'N/D'"/>
                  </div>

                  <div class="source-status-item total-update">
                    <div class="source-status-left">
                      <i class="pi pi-clock"></i>
                      <div>
                        <strong>Última actualización consolidada</strong>
                        <span>Resumen general</span>
                      </div>
                    </div>
                    <Tag severity="contrast" :value="portadaUpdatedAt"/>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </section>

        <!-- ═══ CARTERA ═══════════════════════════════════════════════════════ -->
        <section v-show="active === 'cartera'" class="page-grid page-grid-enter">
          <div class="section-header">
            <div><span>Cartera</span>
              <h3>Vista integral del dominio comercial</h3></div>
            <Tag severity="success" value="Interactivo"/>
          </div>

          <Divider class="section-rule"/>

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
            <Card class="chart-flow-full">
              <template #title>
                <div class="card-title-row">
                  <span>Evolucion stock vs presupuesto</span>
                  <Dropdown v-model="chartFilters.projectionProduct" :options="catalogs.productosBNB"
                            class="mini-select"/>
                </div>
              </template>
              <template #content>
                <div class="chart-box chart-box-flow">
                  <Chart type="line" :data="flowChart" :options="chartOptions"/>
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

        <!-- ═══ ORGANIGRAMA ═══════════════════════════════════════════════════════ -->
        <section v-show="active === 'organigrama'" class="page-grid">
          <div class="section-header">
            <div>
              <span>Estructura interna</span>
              <h3>Organigrama del área</h3>
            </div>
            <Tag severity="success" value="Analítica de Datos"/>
          </div>

          <Card class="org-card">
            <template #content>
              <div class="org-wrapper">
                <!-- Gerente -->
                <div class="org-level org-level-manager">
                  <div class="org-node org-node-manager">
                    <div class="org-avatar">
                      <font-awesome-icon :icon="orgArea.gerente.icon"/>
                    </div>
                    <div class="org-info">
                      <strong>{{ orgArea.gerente.nombre }}</strong>
                      <span>{{ orgArea.gerente.cargo }}</span>
                    </div>
                    <Tag value="Gerencia" severity="success"/>
                  </div>
                </div>

                <div class="org-connector-main"></div>

                <!-- Equipo -->
                <div class="org-level org-level-team">
                  <div
                      v-for="member in orgArea.equipo"
                      :key="member.nombre"
                      class="org-branch"
                      :class="{ 'has-agents': member.agentes && member.agentes.length }"
                  >
                    <div class="org-connector-vertical"></div>

                    <div class="org-node org-node-member" :class="`org-tone-${member.tone}`">
                      <div class="org-avatar">
                        <font-awesome-icon :icon="member.icon"/>
                      </div>

                      <div class="org-info">
                        <strong>{{ member.nombre }}</strong>
                        <span>{{ member.cargo }}</span>
                      </div>
                    </div>

                    <!-- Agentes debajo de Marcelo Fraija -->
                    <div v-if="member.agentes && member.agentes.length" class="org-agents">
                      <div class="org-agents-connector"></div>

                      <div
                          v-for="agent in member.agentes"
                          :key="agent.nombre"
                          class="org-node org-node-agent"
                      >
                        <div class="org-avatar agent-avatar">
                          <font-awesome-icon :icon="agent.icon"/>
                        </div>

                        <div class="org-info">
                          <strong>{{ agent.nombre }}</strong>
                          <span>{{ agent.cargo }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </Card>
        </section>

        <!-- ═══ KPIs ══════════════════════════════════════════════════════════ -->
        <section v-show="active === 'kpis'" class="page-grid">
          <div class="section-header">
            <div><span>Cartera</span>
              <h3>KPIs ejecutivos</h3></div>
            <Tag severity="info" :value="dateIso(summary?.fechaCorte) || 'N/D'"/>
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
                  sortField="stock"
                  :sortOrder="-1"
                  showGridlines
              >
                <Column field="producto" header="Producto" footer="Totales">
                  <template #body="{ data }">
                    <strong>{{ data.producto }}</strong>
                  </template>
                  <template #footer>
                    <strong>Totales</strong>
                  </template>
                </Column>

                <Column field="stock" header="Stock Actual">
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.stock) }}</strong>
                  </template>
                  <template #footer>
                    <strong>{{ moneyFull(productTotals.stock) }}</strong>
                  </template>
                </Column>

                <Column field="crecimientoPct" header="Crecimiento %">
                  <template #body="{ data }">
      <span :class="trendClass(data.crecimientoPct)">
        {{ data.crecimientoPct > 0 ? '+' : '' }}{{ percent(data.crecimientoPct) }}
      </span>
                  </template>
                  <template #footer>
                    <strong :class="trendClass(productTotals.crecimientoPct)">
                      {{ productTotals.crecimientoPct > 0 ? '+' : '' }}{{ percent(productTotals.crecimientoPct) }}
                    </strong>
                  </template>
                </Column>

                <Column field="crecimientoMonto" header="Crecimiento Monto">
                  <template #body="{ data }">
    <span :class="trendClass(productGrowthAmount(data))">
      {{ signedMoneyFull(productGrowthAmount(data)) }}
    </span>
                  </template>

                  <template #footer>
                    <strong :class="trendClass(productTotals.crecimientoMonto)">
                      {{ signedMoneyFull(productTotals.crecimientoMonto) }}
                    </strong>
                  </template>
                </Column>

                <Column field="desembolsos" header="Desembolsos">
                  <template #body="{ data }">
                    {{ moneyFull(data.desembolsos) }}
                  </template>
                  <template #footer>
                    <strong>{{ moneyFull(productTotals.desembolsos) }}</strong>
                  </template>
                </Column>

                <Column field="amortizacion" header="Amortización">
                  <template #body="{ data }">
                    {{ moneyFull(data.amortizacion) }}
                  </template>
                  <template #footer>
                    <strong>{{ moneyFull(productTotals.amortizacion) }}</strong>
                  </template>
                </Column>

                <Column field="presupuesto" header="Presupuesto">
                  <template #body="{ data }">
                    {{ moneyFull(data.presupuesto) }}
                  </template>
                  <template #footer>
                    <strong>{{ moneyFull(productTotals.presupuesto) }}</strong>
                  </template>
                </Column>

                <Column field="cumplimientoPct" header="Cumplimiento">
                  <template #body="{ data }">
                    <div class="compliance-cell">
                      <div class="compliance-head">
                        <strong :class="Number(data.cumplimientoPct || 0) >= 100 ? 'text-green' : 'text-danger'">
                          {{ percent(data.cumplimientoPct) }}
                        </strong>
                        <span
                            class="compliance-status"
                            :class="Number(data.cumplimientoPct || 0) >= 100 ? 'is-good' : 'is-risk'"
                        >
            {{ Number(data.cumplimientoPct || 0) >= 100 ? 'Meta alcanzada' : 'Bajo meta' }}
          </span>
                      </div>

                      <div class="compliance-bar-wrap">
                        <div class="compliance-bar-track">
                          <div class="compliance-bar-marker"></div>
                          <div
                              class="compliance-bar-fill"
                              :class="Number(data.cumplimientoPct || 0) >= 100 ? 'fill-good' : 'fill-risk'"
                              :style="{ width: Math.min(Math.max(Number(data.cumplimientoPct || 0), 0), 100) + '%' }"
                          ></div>
                        </div>

                        <small v-if="Number(data.cumplimientoPct || 0) > 100" class="compliance-extra good">
                          +{{ (Number(data.cumplimientoPct || 0) - 100).toFixed(2) }} pp sobre meta
                        </small>
                        <small v-else-if="Number(data.cumplimientoPct || 0) < 100" class="compliance-extra risk">
                          -{{ (100 - Number(data.cumplimientoPct || 0)).toFixed(2) }} pp para meta
                        </small>
                        <small v-else class="compliance-extra neutral">
                          Meta exacta
                        </small>
                      </div>
                    </div>
                  </template>

                  <template #footer>
                    <div class="compliance-footer-total">
                      <strong :class="Number(productTotals.cumplimientoPct || 0) >= 100 ? 'text-green' : 'text-danger'">
                        {{ percent(productTotals.cumplimientoPct) }}
                      </strong>
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
                  <template #body="{ index }"><span class="rank-badge">{{ oficialesFirst + index + 1 }}</span>
                  </template>
                </Column>
                <Column field="oficial" header="Oficial"/>
                <Column field="nombreAgencia" header="Agencia"/>
                <Column field="sucursal" header="Sucursal"/>
                <Column header="Desembolso USD" sortable sort-field="desembolso">
                  <template #body="{ data }">
                    <strong>{{ formatDesembolsoMiles(data.desembolso) }}</strong>
                  </template>
                </Column>
                <Column header="% aporte" sortable sort-field="participacionAportePct">
                  <template #body="{ data }">
                    <div class="rank-bar-wrap">
                      <div
                          class="rank-bar"
                          :style="{
            width: Math.min(Number(data.participacionAportePct) || 0, 100).toFixed(1) + '%'
          }"
                      ></div>
                      <span>{{ percent(data.participacionAportePct) }}</span>
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

          <div class="system-charts-stack">
            <Card>
              <template #title>
                <div class="card-title-row">
                  <span>Heatmap por banco — crecimiento total</span>
                </div>
              </template>
              <template #content>
                <table class="heat-table sf-matrix-table">
                  <thead>
                  <tr>
                    <th>Banco</th>
                    <th v-for="prod in benchmarkMatrix.productos" :key="prod" style="text-align: center;">
                      {{ prod }}
                    </th>
                    <th style="text-align: center; width: 140px;">Participación</th>
                    <th style="text-align: center;">Crecimiento / Stock</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr v-for="row in benchmarkMatrix.matrix" :key="row.banco">
                    <td>
                      <div class="bname">
                        <span class="bdot" :class="{ bnb: row.banco === 'BNB' }"></span>
                        <strong v-if="row.banco === 'BNB'">{{ row.banco }}</strong>
                        <span v-else>{{ row.banco }}</span>
                      </div>
                    </td>
                    <td v-for="prod in benchmarkMatrix.productos" :key="prod"
                        style="text-align: center; vertical-align: middle;">
                      <div v-if="row[prod]" class="sf-cell">
                        <div
                            :class="trendClass(row[prod].crecimientoTotal)"
                            style="font-weight: 700; font-size: 1.05em; margin-bottom: 4px;"
                        >
                          {{ signedMoneyK(row[prod].crecimientoTotal) }}
                        </div>

                        <div class="sf-stock" style="font-size: 0.9em; color: #444; font-weight: 500;">
                          Stock: {{ moneyKFull(row[prod].stock) }}
                        </div>
                      </div>
                      <div v-else class="heat-empty">--</div>
                    </td>
                    <td style="text-align: center; vertical-align: middle;">
                      <div class="mini-bar-container" v-if="row.rowStock > 0">
                        <div
                            v-for="(seg, si) in row.composition"
                            :key="si"
                            class="mini-bar-segment"
                            :style="{
        width: seg.value + '%',
        backgroundColor: seg.color
      }"
                            :title="seg.label + ': ' + seg.value.toFixed(1) + '%'"
                        ></div>
                      </div>

                      <small class="participation-label" v-if="row.rowStock > 0">
                        {{ row.composition.length }} productos
                      </small>
                    </td>
                    <td style="text-align: center; vertical-align: middle;">
                      <strong
                          :class="trendClass(row.rowGrowth)"
                          style="font-size: 1.1em; display: block;"
                      >
                        {{ signedMoneyK(row.rowGrowth) }}
                      </strong>
                      <small style="display: block; margin-top: 4px; color: #64748b;">
                        Stock: {{ moneyKFull(row.rowStock) }}
                      </small>
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
              <template #title>Oportunidad de mercado (Stock vs crecimiento total)</template>
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
                  <div class="chat-bubble" v-html="renderMarkdown(message.text)"></div>
                </div>
                <div v-if="chatLoading" class="chat-message bot">
                  <div class="chat-avatar">
                    <font-awesome-icon icon="brain"/>
                  </div>
                  <p>Analizando reglas comerciales...</p>
                </div>
              </div>
              <div class="prompt-row">
                <Button label="Análisis integral" severity="info" outlined @click="triggerAnalysis()"/>
                <Button label="Explica la brecha" outlined @click="triggerBrechaAnalysis()"/>
                <Button label="BNB vs competencia" outlined @click="triggerCompetenciaAnalysis()"/>
                <Button label="Ranking oficiales" outlined @click="triggerOficialesAnalysis()"/>
                <Button label="Riesgos comerciales" outlined @click="triggerRiesgoAnalysis()"/>
                <Button label="Plan comercial" outlined @click="triggerPlanComercialAnalysis()"/>
              </div>

              <!-- Toggle de MCP visual -->
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin: 12px 0 8px 0;">
                <Button
                    label="Limpiar memoria"
                    icon="pi pi-trash"
                    severity="secondary"
                    size="small"
                    text
                    @click="clearChatSessionMemory()"
                />

                <Button
                    :label="useMcp ? 'MCP Activado' : 'Activar búsqueda profunda (MCP)'"
                    :icon="useMcp ? 'pi pi-check-circle' : 'pi pi-circle'"
                    :severity="useMcp ? 'success' : 'secondary'"
                    size="small"
                    text
                    @click="useMcp = !useMcp"
                />
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
