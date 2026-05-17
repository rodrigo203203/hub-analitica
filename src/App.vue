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
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import {marked} from 'marked';
import {api} from './api';
import {dateIso, moneyFull, percent} from './format';
// Fotos
import ronyImg from './img/rony.jpg'
import marceloImg from './img/marcelo.jpg'
import fraijaImg from './img/fraija.jpg'
import luciaImg from './img/lucia.jpg'
import rodrigoImg from './img/rodrigo.jpg'
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

function normalizeText(value) {
  return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
}

function isCaptacionFugaCategory(value) {
  const text = normalizeText(value);

  if (!text || text === 'n/d' || text === 'sin categoria') return false;

  return (
      text.includes('fuga') ||
      text.includes('negativ') ||
      text.includes('caida') ||
      text.includes('dismin') ||
      text.includes('decrec') ||
      text.includes('riesgo') ||
      text.includes('alerta')
  );
}

function captacionFugaLevelFromCategory(value) {
  const text = normalizeText(value);

  if (!isCaptacionFugaCategory(text)) return 'Sin alerta';
  if (text.includes('alta') || text.includes('crit') || text.includes('severa')) return 'Alta';
  if (text.includes('media') || text.includes('moderada')) return 'Media';
  if (text.includes('baja') || text.includes('leve')) return 'Baja';

  return 'Media';
}

function captacionCategorySeverity(value) {
  const level = captacionFugaLevelFromCategory(value);

  if (level === 'Alta') return 'danger';
  if (level === 'Media') return 'warning';
  if (level === 'Baja') return 'warning';

  const text = normalizeText(value);
  if (text.includes('positiv') || text.includes('crec') || text.includes('estable')) return 'success';

  return 'info';
}


function opportunityProduct(row) {
  return row?.producto ||
      row?.segmentacionCredito ||
      row?.SegmentacionCredito ||
      row?.segmentacioncredito ||
      row?.PRODUCTO ||
      row?.productoCredito ||
      row?.tipoProducto ||
      'N/D';
}

function creditCountValue(row) {
  const candidates = [
    row?.cantidadCreditos,
    row?.CantidadCreditos,
    row?.nroCreditos,
    row?.NroCreditos,
    row?.numeroCreditos,
    row?.NumeroCreditos,
    row?.operaciones,
    row?.Operaciones,
    row?.stockCreditos,
    row?.StockCreditos
  ];

  const found = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) > 0);

  // No se infieren créditos si la consulta no trae una columna explícita de cantidad.
  return found === undefined ? null : Number(found);
}

function maduracionAlertLevel(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return 'N/D';

  // Regla vigente: en maduración, mayor porcentaje representa mayor alerta comercial.
  if (n > 50) return 'Crítico';
  if (n >= 30) return 'Alerta';
  return 'Normal';
}

function lcfSaldoActivadoValue(row) {
  // Regla vigente de origen: la consulta trae los campos invertidos.
  // cupoNoUtilizado de la fuente debe leerse como saldo activado.
  return Number(row?.cupoNoUtilizado || 0);
}

function lcfCupoNoUtilizadoValue(row) {
  // saldoActivado de la fuente debe leerse como cupo no utilizado.
  return Number(row?.saldoActivado || 0);
}

function maduracionAlertSeverity(value) {
  const level = maduracionAlertLevel(value);

  if (level === 'Crítico') return 'danger';
  if (level === 'Alerta') return 'warning';
  if (level === 'Normal') return 'success';
  return 'info';
}

function maduracionAlertIcon(value) {
  const level = maduracionAlertLevel(value);

  if (level === 'Crítico') return 'circle-exclamation';
  if (level === 'Alerta') return 'triangle-exclamation';
  if (level === 'Normal') return 'circle-check';
  return 'circle-question';
}

function maduracionRiskOrder(value) {
  const level = maduracionAlertLevel(value);

  if (level === 'Crítico') return 3;
  if (level === 'Alerta') return 2;
  if (level === 'Normal') return 1;
  return 0;
}

function maduracionRuleText() {
  return 'Regla de maduración: mayor porcentaje = peor condición comercial, porque el crédito está más cerca de completarse/vencer. Priorizar Crítico >50%, luego Alerta 30–50%, luego Normal <30%.';
}

function toPeriodYYYYMM(value) {
  if (!value) return 'Último periodo disponible';

  const text = String(value).trim();

  // Soporta fechas ISO completas:
  // 2025-01-31T00:00:00.000Z -> 202501
  // 2025-01-31T00:00:00.000-04:00 -> 202501
  if (/^\d{4}-\d{2}/.test(text)) {
    return text.slice(0, 7).replace('-', '');
  }

  // Soporta 202501
  if (/^\d{6}$/.test(text)) {
    return text;
  }

  // Soporta Date real de JS
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${year}${month}`;
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
  {id: 'agente', label: 'Agente IA', icon: 'brain'},
  {
    id: 'oportunidades',
    label: 'Oportunidades',
    icon: 'lightbulb',
    groupOnly: true,
    children: [
      {id: 'op-resumen', label: 'Resumen oportunidades', icon: 'chart-simple'},
      {id: 'op-maduracion', label: 'Maduración créditos', icon: 'hourglass-half'},
      {id: 'op-lcf', label: 'Líneas crédito familiar', icon: 'credit-card'}
    ]
  },
  {
    id: 'cartera',
    label: 'Cartera',
    icon: 'chart-line',
    groupOnly: true,
    children: [
      {id: 'desempeno', label: 'Desempeño comercial', icon: 'gauge-high'},
      {id: 'riesgo-pd', label: 'Riesgo predictivo', icon: 'triangle-exclamation'},
      {id: 'proyeccion', label: 'Proyección', icon: 'arrow-trend-up'},
      {id: 'sistema', label: 'Sistema financiero', icon: 'table-cells'},
    ]
  },
  {
    id: 'captaciones',
    label: 'Captaciones',
    icon: 'piggy-bank',
    groupOnly: true,
    children: [
      {id: 'capt-desempeno', label: 'Desempeño captaciones', icon: 'chart-simple'},
      {id: 'capt-tendencias', label: 'Tendencias captaciones', icon: 'arrow-trend-up'},
      {id: 'capt-fuga', label: 'Fuga de captaciones', icon: 'triangle-exclamation'}
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
const captaciones = ref([]);
const captacionesHistorico = ref([]);
const captacionHistoricoProducto = ref('TODOS');
const captacionStockBudgetFilter = ref('TODOS');
const maduracion = ref([]);
const lcf = ref([]);
const maduracionSucursalProductoSortField = ref('maduracionPct');
const maduracionSucursalProductoSortOrder = ref(-1);
const maduracionDetalleSortField = ref('maduracionPct');
const maduracionDetalleSortOrder = ref(-1);

const captacionHistoricoProductoOptions = [
  { label: 'Todos', value: 'TODOS' },
  { label: 'Vista', value: 'VISTA' },
  { label: 'Ahorros', value: 'AHORROS' },
  { label: 'DPF / Plazo', value: 'PLAZO' }
];
const dataMode = ref('mock');
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
const desembolsoScenario = ref('base');
const amortizacionScenario = ref('base');

const draftDesembolsoScenario = ref('base');
const draftAmortizacionScenario = ref('base');

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
const kpisProductData = ref([]);
const projection = ref([]);
const projectionProductData = ref({});
const selectedProjProducts = ref(['CONSUMO',
  'VIVIENDA',
  'VIVIENDA SOCIAL',
  'TARJETAS DE CREDITO',
  'VEHICULAR',
  'MICROCREDITO']);
const draftProjectionMetric = ref('AMBOS');
const draftSelectedProjProducts = ref(['CONSUMO',
  'VIVIENDA',
  'VIVIENDA SOCIAL',
  'TARJETAS DE CREDITO',
  'VEHICULAR',
  'MICROCREDITO']);
const benchmark = ref([]);
const marketShare = ref([]);
const sharedPortfolio = ref([]);
const oficiales = ref([]);
const oficialesFirst = ref(0);
const fuentes = ref([]);
const filteredTimeSeries = ref([]);
const pdRisk = ref([]);
const pdRiskHistory = ref([]);
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

async function loadProjectionByProduct() {
  for (const prod of selectedProjProducts.value) {
    if (!projectionProductData.value[prod]) {
      try {
        projectionProductData.value[prod] = await fetchMergedProjectionByProduct(prod);
      } catch (error) {
        console.error('projectionByProduct error:', prod, error);
        projectionProductData.value[prod] = [];
      }
    }
  }
}

async function applyProjectionFilters() {
  chartFilters.value.projectionMetric = draftProjectionMetric.value;
  selectedProjProducts.value = [...draftSelectedProjProducts.value];

  desembolsoScenario.value = draftDesembolsoScenario.value;
  amortizacionScenario.value = draftAmortizacionScenario.value;

  projectionProductData.value = {};

  const params = {
    fecha: filtersApplied.value.fecha,
    sucursal: filtersApplied.value.sucursal,
    producto: filtersApplied.value.producto,
    agencia: filtersApplied.value.agencia,
    banco: filtersApplied.value.banco
  };

  try {
    projection.value = await fetchMergedProjection(params);
    await loadProjectionByProduct();
  } catch (error) {
    console.error('applyProjectionFilters error:', error);
  }
}

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

function buildMessageForNormalChat(currentMessage) {
  return `
Contexto conversacional previo de esta sesión:
${buildConversationMemoryText()}

Consulta actual del usuario:
${currentMessage}

Modo:
- Chat normal.
- No usar MCP.
- No usar herramientas.
- No invocar @agent.
- Responder de forma conversacional.
`.trim();
}

function buildMessageForMcp(currentMessage) {
  return `
Contexto conversacional previo de esta sesión:
${buildConversationMemoryText()}

Consulta actual del usuario:
${currentMessage}

Modo:
- MCP activado por el usuario.
- Puedes usar datos reales mediante la herramienta comercial cuando sea necesario.
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
      img: fraijaImg,
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
      img: luciaImg,
      tone: 'data'
    },
    {
      nombre: 'Marcelo Cabrera',
      cargo: 'Analista Sr. de Datos',
      img: marceloImg,
      tone: 'senior'
    },
    {
      nombre: 'Rodrigo Morales',
      cargo: 'Analista de Datos',
      img: rodrigoImg,
      tone: 'analyst'
    }
  ]
};

// ─────────────────────────────────────────────────────────────
// Computed generales
// ─────────────────────────────────────────────────────────────

const activeTitle = computed(() => {
  const flat = sections.flatMap((s) => [...(s.children || []), ...(s.groupOnly ? [] : [s])]);
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
    !['gobernanza', 'organigrama', 'actualizaciones', 'cartera'].includes(active.value)
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

const projectionChartOptions = {
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
        usePointStyle: true,
        filter: (legendItem) => {
          const label = String(legendItem.text || '');
          return !label.includes('Proy') && !label.includes('Proyect');
        }
      }
    },
    tooltip: {
      ...tooltipBase,
      // EL FILTRO CORREGIDO:
      filter: (tooltipItem) => {
        const label = tooltipItem.dataset.label || '';

        // Atrapamos cualquier variante (Proyectado, Proyectada o Proy.)
        if (label.includes('Proy')) {

          // Construimos el nombre exacto de su pareja "Real"
          const realLabel = label
              .replace('Proyectado', 'Real')
              .replace('Proyectada', 'Real')
              .replace('Proy.', 'Real');

          const realDataset = tooltipItem.chart.data.datasets.find(d => d.label === realLabel);

          // Si la línea "Real" tiene un valor válido en este mes exacto,
          // ocultamos la línea "Proyectada" del tooltip.
          if (realDataset && realDataset.data[tooltipItem.dataIndex] !== null && realDataset.data[tooltipItem.dataIndex] !== undefined) {
            return false;
          }
        }

        return true; // Mostrar el resto normalmente
      },
      callbacks: {
        label: (ctx) => {
          const val = ctx.parsed.y;
          if (val === null || val === undefined) return '';
          return ` ${ctx.dataset.label}: ${Number(val).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          })}`;
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
        callback: (value) => Number(value).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})
      }
    }
  }
};

const portadaFlowChartOptions = computed(() => {
  const values = [
    ...(flowChart.value?.datasets?.find((d) => d.label === 'Stock ejecutado')?.data || []),
    ...(flowChart.value?.datasets?.find((d) => d.label === 'Presupuesto')?.data || [])
  ]
      .map((v) => Number(v || 0))
      .filter((v) => Number.isFinite(v));

  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const range = Math.max(maxValue - minValue, 1);

  // Escala más honesta: no arranca pegada al mínimo.
  // Baja bastante el mínimo para que la diferencia no parezca exagerada.
  const visualMin = Math.max(0, minValue - range * 2.5);
  const visualMax = maxValue + range * 0.6;

  return {
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
        min: visualMin,
        max: visualMax,
        grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
        ticks: {
          color: '#6f8177',
          font: {size: 12},
          maxTicksLimit: 8,
          callback: (value) => moneyFullNoDecimals(value)
        }
      }
    }
  };
});

const captacionesHistoricoRows = computed(() => {
  const rows = [...(captacionesHistorico.value || [])];

  return rows
      .map((row) => ({
        periodo: toPeriodYYYYMM(row.fecha),

        ejecutadaCaptaciones: Number(row.ejecutadaCaptaciones || 0),
        presupuestadaCaptaciones: Number(row.presupuestadaCaptaciones || 0),

        ejecutadaVista: Number(row.ejecutadaVista || 0),
        presupuestadaVista: Number(row.presupuestadaVista || 0),

        ejecutadaAhorros: Number(row.ejecutadaAhorros || 0),
        presupuestadaAhorros: Number(row.presupuestadaAhorros || 0),

        ejecutadaPlazo: Number(row.ejecutadaPlazo || 0),
        presupuestadaPlazo: Number(row.presupuestadaPlazo || 0)
      }))
      .filter((row) => row.periodo && row.periodo !== 'Último periodo disponible')
      .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
});

const captacionesHistoricoChart = computed(() => {
  const rows = captacionesHistoricoRows.value;

  const configByProducto = {
    TODOS: {
      ejecutadoField: 'ejecutadaCaptaciones',
      presupuestoField: 'presupuestadaCaptaciones',
      labelEjecutado: 'Captación ejecutada',
      labelPresupuesto: 'Presupuesto captaciones'
    },
    VISTA: {
      ejecutadoField: 'ejecutadaVista',
      presupuestoField: 'presupuestadaVista',
      labelEjecutado: 'Vista ejecutada',
      labelPresupuesto: 'Presupuesto vista'
    },
    AHORROS: {
      ejecutadoField: 'ejecutadaAhorros',
      presupuestoField: 'presupuestadaAhorros',
      labelEjecutado: 'Ahorros ejecutado',
      labelPresupuesto: 'Presupuesto ahorros'
    },
    PLAZO: {
      ejecutadoField: 'ejecutadaPlazo',
      presupuestoField: 'presupuestadaPlazo',
      labelEjecutado: 'DPF / Plazo ejecutado',
      labelPresupuesto: 'Presupuesto DPF / Plazo'
    }
  };

  const config = configByProducto[captacionHistoricoProducto.value] || configByProducto.TODOS;

  const ejecutadoData = rows.map((row) => Number(row[config.ejecutadoField] || 0));
  const presupuestoData = rows.map((row) => Number(row[config.presupuestoField] || 0));
  const diferenciaData = ejecutadoData.map((value, index) => value - Number(presupuestoData[index] || 0));
  const cumplimientoData = ejecutadoData.map((value, index) => {
    const presupuesto = Number(presupuestoData[index] || 0);
    return presupuesto > 0 ? (value / presupuesto) * 100 : null;
  });

  return {
    labels: rows.map((row) => row.periodo),
    datasets: [
      {
        label: config.labelEjecutado,
        data: ejecutadoData,
        borderColor: '#26b460',
        backgroundColor: 'rgba(38,180,96,.14)',
        borderWidth: 3,
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 8,
        pointBackgroundColor: '#26b460',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        metaRows: rows,
        metaType: 'money'
      },
      {
        label: config.labelPresupuesto,
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
        pointBorderWidth: 2,
        metaRows: rows,
        metaType: 'money'
      },
      {
        label: 'Cumplimiento %',
        data: cumplimientoData,
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        borderDash: [6, 4],
        tension: 0.35,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 7,
        pointBackgroundColor: '#f59e0b',
        yAxisID: 'y1',
        metaRows: rows,
        metaType: 'percent'
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
        hidden: true,
        metaRows: rows,
        metaType: 'hidden'
      }
    ]
  };
});

const captacionesHistoricoLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600, easing: 'easeOutQuart' },
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
        usePointStyle: true,
        filter: (legendItem) => legendItem.text !== 'Diferencia'
      }
    },
    tooltip: {
      ...tooltipBase,
      filter: (tooltipItem) => tooltipItem.dataset.label !== 'Diferencia',
      callbacks: {
        label: (ctx) => {
          const value = Number(ctx.raw || 0);

          if (ctx.dataset.label === 'Cumplimiento %') {
            return ` Cumplimiento: ${Number(value).toFixed(2)}%`;
          }

          return ` ${ctx.dataset.label}: ${moneyFullNoDecimals(value)}`;
        },
        afterBody: (items) => {
          const stockItem = items.find((item) =>
              !String(item.dataset.label || '').includes('Presupuesto') &&
              item.dataset.label !== 'Cumplimiento %'
          );

          const presupuestoItem = items.find((item) =>
              String(item.dataset.label || '').includes('Presupuesto')
          );

          const cumplimientoItem = items.find((item) =>
              item.dataset.label === 'Cumplimiento %'
          );

          if (!stockItem || !presupuestoItem) return [];

          const ejecutado = Number(stockItem.raw || 0);
          const presupuesto = Number(presupuestoItem.raw || 0);
          const diferencia = ejecutado - presupuesto;
          const cumplimiento = cumplimientoItem?.raw ?? (
              presupuesto > 0 ? (ejecutado / presupuesto) * 100 : null
          );

          return [
            '',
            `Diferencia: ${signedMoneyFullNoDecimals(diferencia)}`,
            `Cumplimiento monto: ${moneyFullNoDecimals(ejecutado)} / ${moneyFullNoDecimals(presupuesto)}`,
            `Cumplimiento %: ${
                cumplimiento === null || cumplimiento === undefined
                    ? 'N/A'
                    : `${Number(cumplimiento).toFixed(2)}%`
            }`
          ];
        }
      }
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(15,31,22,.04)', drawBorder: false },
      ticks: {
        color: '#6f8177',
        font: { size: 11, weight: '600' },
        autoSkip: false,
        maxRotation: 0,
        minRotation: 0,
        padding: 10
      }
    },
    y: {
      beginAtZero: true,
      position: 'left',
      grid: { color: 'rgba(15,31,22,.05)', drawBorder: false },
      ticks: {
        color: '#6f8177',
        font: { size: 12 },
        callback: (value) => moneyFullNoDecimals(value)
      }
    },
    y1: {
      beginAtZero: true,
      position: 'right',
      grid: {
        drawOnChartArea: false
      },
      ticks: {
        color: '#6f8177',
        font: { size: 12 },
        callback: (value) => `${Number(value).toFixed(0)}%`
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

function normalizeTipoDato(value) {
  return String(value || '')
      .trim()
      .toUpperCase();
}

function projectionDateKey(row) {
  if (row?.fecha) {
    const d = new Date(row.fecha);

    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }

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

  return (desembolsoRows || []).map((row) => {
    const key = projectionMergeKey(row);

    return {
      ...row,
      amortizacion: amortMap.has(key)
          ? amortMap.get(key)
          : Number(row.amortizacion || 0)
    };
  });
}

async function fetchMergedProjection(params = {}) {
  const [desembolsoRes, amortizacionRes] = await Promise.all([
    api.projection(desembolsoScenario.value, params),
    api.projection(amortizacionScenario.value, params)
  ]);

  return mergeProjectionScenarios(desembolsoRes.data, amortizacionRes.data);
}

async function fetchMergedProjectionByProduct(product) {
  const [desembolsoRes, amortizacionRes] = await Promise.all([
    api.projectionByProduct(desembolsoScenario.value, product),
    api.projectionByProduct(amortizacionScenario.value, product)
  ]);

  return mergeProjectionScenarios(desembolsoRes.data, amortizacionRes.data);
}

function projectionLabel(row) {
  if (row?.month) return row.month;

  if (row?.fecha) {
    const d = new Date(row.fecha);

    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('es-BO', {month: 'short'}).format(d);
    }
  }

  return String(row?.fecha || '');
}

function sortProjectionRows(rows = []) {
  return [...rows].sort((a, b) => {
    const da = new Date(a.fecha || a.month);
    const db = new Date(b.fecha || b.month);

    if (!Number.isNaN(da.getTime()) && !Number.isNaN(db.getTime())) {
      return da - db;
    }

    return String(a.month || '').localeCompare(String(b.month || ''));
  });
}

function buildProjectionAxis(rows = []) {
  const sorted = sortProjectionRows(rows);
  const map = new Map();

  sorted.forEach((row) => {
    const key = projectionDateKey(row);

    if (!map.has(key)) {
      map.set(key, {
        key,
        label: projectionLabel(row)
      });
    }
  });

  return Array.from(map.values());
}

function valueByTipoAndDate(rows = [], tipoDato, field, axis = []) {
  const targetTipo = normalizeTipoDato(tipoDato);

  const map = new Map();

  rows.forEach((row) => {
    if (normalizeTipoDato(row.tipoDato) !== targetTipo) return;

    map.set(projectionDateKey(row), Number(row[field] || 0));
  });

  return axis.map((item) => map.has(item.key) ? map.get(item.key) : null);
}

const projectionSelectedProductBase = computed(() => {
  const selected = selectedProjProducts.value || [];
  const allRows = kpisProductData.value || [];

  const rows =
      selected.length > 0
          ? allRows.filter((row) => selected.includes(row.producto))
          : allRows;

  const stockActual = rows.reduce((acc, row) => acc + Number(row.stock || 0), 0);
  const stockBase = rows.reduce((acc, row) => acc + Number(row.stockBase || 0), 0);
  const presupuesto = rows.reduce((acc, row) => acc + Number(row.presupuesto || 0), 0);

  return {
    rows,
    stockActual,
    stockBase,
    presupuesto
  };
});

const projectionYearSummary = computed(() => {
  const rowsSource = [];

  if (selectedProjProducts.value.length > 0) {
    selectedProjProducts.value.forEach((product) => {
      const rows = projectionProductData.value?.[product] || [];

      rows.forEach((row) => {
        rowsSource.push({
          ...row,
          producto: product
        });
      });
    });
  } else {
    (projection.value || []).forEach((row) => {
      rowsSource.push(row);
    });
  }

  const rows2026 = rowsSource.filter((row) =>
      String(row.fecha || row.month || '').startsWith('2026')
  );

  const realRows = rows2026.filter((row) =>
      normalizeTipoDato(row.tipoDato) === 'HISTORICO'
  );

  const projectedRows = rows2026.filter((row) =>
      normalizeTipoDato(row.tipoDato) === 'PROYECCION'
  );

  const desembolsoReal = realRows.reduce(
      (acc, row) => acc + Number(row.desembolso || 0) * 1000,
      0
  );

  const desembolsoProyectado = projectedRows.reduce(
      (acc, row) => acc + Number(row.desembolso || 0) * 1000,
      0
  );

  const amortizacionReal = realRows.reduce(
      (acc, row) => acc + Number(row.amortizacion || 0) * 1000,
      0
  );

  const amortizacionProyectada = projectedRows.reduce(
      (acc, row) => acc + Number(row.amortizacion || 0) * 1000,
      0
  );

  const totalDesembolsoAnio = desembolsoReal + desembolsoProyectado;
  const totalAmortizacionAnio = amortizacionReal + amortizacionProyectada;

  const stockActual = Number(projectionSelectedProductBase.value.stockActual || 0);
  const stockBase = Number(projectionSelectedProductBase.value.stockBase || 0);
  const presupuesto = Number(projectionSelectedProductBase.value.presupuesto || 0);

  const stockFinAnio =
      stockActual + desembolsoProyectado - amortizacionProyectada;

  const crecimientoVsDicMonto = stockFinAnio - stockBase;
  const crecimientoVsDicPct =
      stockBase > 0 ? ((stockFinAnio / stockBase) - 1) * 100 : null;

  const diferenciaVsPresupuesto = stockFinAnio - presupuesto;
  const cumplimientoVsPresupuesto =
      presupuesto > 0 ? (stockFinAnio / presupuesto) * 100 : null;

  return {
    stockActual,
    stockBase,
    presupuesto,

    desembolsoReal,
    desembolsoProyectado,
    amortizacionReal,
    amortizacionProyectada,

    totalDesembolsoAnio,
    totalAmortizacionAnio,

    stockFinAnio,
    crecimientoVsDicMonto,
    crecimientoVsDicPct,
    diferenciaVsPresupuesto,
    cumplimientoVsPresupuesto
  };
});

const projectionChart = computed(() => {
  const allDatasets = [];

  // 1. Extraer YYYYMM
  const getLabelYYYYMM = (str) => {
    const s = String(str || '');
    if (s.length >= 7) return s.substring(0, 4) + s.substring(5, 7);
    return s;
  };

  // 2. Procesar, unificar duplicados y conectar líneas
  const processSeries = (rawData) => {
    // 1. Filtrar solo año 2026
    const filtered = (rawData || []).filter(d => String(d.fecha || d.month).startsWith('2026'));

    const map = new Map();
    filtered.forEach(d => {
      const lbl = getLabelYYYYMM(d.fecha || d.month);
      if (!map.has(lbl)) {
        map.set(lbl, {
          label: lbl,
          valHistDes: 0, valProjDes: 0,
          valHistAmo: 0, valProjAmo: 0,
          hasRealDes: false, // ¿Tiene desembolso real este mes?
          hasRealAmo: false  // ¿Tiene amortización real este mes?
        });
      }

      const item = map.get(lbl);
      const mDes = Number(d.desembolso || 0) * 1000;
      const mAmo = Number(d.amortizacion || 0) * 1000;
      const tipo = String(d.tipoDato).toUpperCase();

      if (tipo === 'HISTORICO') {
        // Procesar Desembolso Histórico
        if (mDes > 0) {
          item.valHistDes += mDes;
          item.hasRealDes = true;
        }
        // Procesar Amortización Histórica
        if (mAmo > 0) {
          item.valHistAmo += mAmo;
          item.hasRealAmo = true;
        }
      } else {
        // Procesar Proyecciones
        item.valProjDes += mDes;
        item.valProjAmo += mAmo;
      }
    });

    const sorted = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    const labels = sorted.map(d => d.label);

    // 2. Identificar puntos de corte INDEPENDIENTES
    let lastRealIdxDes = -1;
    let lastRealIdxAmo = -1;

    sorted.forEach((d, i) => {
      if (d.hasRealDes) lastRealIdxDes = i;
      if (d.hasRealAmo) lastRealIdxAmo = i;
    });

    // 3. Construir series de DESEMBOLSO (Usa su propio índice)
    const realD = sorted.map((d, i) => i <= lastRealIdxDes ? Math.round(d.valHistDes) : null);
    const projD = sorted.map((d, i) => {
      if (i === lastRealIdxDes) return Math.round(d.valHistDes);
      if (i > lastRealIdxDes) return Math.round(d.valProjDes);
      return null;
    });

    // 4. Construir series de AMORTIZACIÓN (Usa su propio índice - detectará Mayo)
    const realA = sorted.map((d, i) => i <= lastRealIdxAmo ? Math.round(d.valHistAmo) : null);
    const projA = sorted.map((d, i) => {
      // Si Mayo es el último real, aquí se conectará con el valor real de Mayo
      if (i === lastRealIdxAmo) return Math.round(d.valHistAmo);
      // Empezará a mostrar proyección desde Junio
      if (i > lastRealIdxAmo) return Math.round(d.valProjAmo);
      return null;
    });

    return {labels, realD, projD, realA, projA};
  };

  // 3. Generar Datasets
  if (selectedProjProducts.value.length === 0) {
    const {labels, realD, projD, realA, projA} = processSeries(projection.value);

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
          fill: false
        }
    );

    if (chartFilters.value.projectionMetric === 'DESEMBOLSOS') return {
      labels,
      datasets: allDatasets.filter(d => d.label.includes('Desemb'))
    };
    if (chartFilters.value.projectionMetric === 'AMORTIZACION') return {
      labels,
      datasets: allDatasets.filter(d => d.label.includes('Amort'))
    };
    return {labels, datasets: allDatasets};

  } else {
    let globalLabels = [];

    selectedProjProducts.value.forEach((prod, i) => {
      const {labels, realD, projD, realA, projA} = processSeries(projectionProductData.value[prod]);
      if (labels.length > globalLabels.length) globalLabels = labels;

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
            fill: false
          }
      );
    });

    if (chartFilters.value.projectionMetric === 'DESEMBOLSOS') return {
      labels: globalLabels,
      datasets: allDatasets.filter(d => d.label.includes('Desemb'))
    };
    if (chartFilters.value.projectionMetric === 'AMORTIZACION') return {
      labels: globalLabels,
      datasets: allDatasets.filter(d => d.label.includes('Amort'))
    };
    return {labels: globalLabels, datasets: allDatasets};
  }
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
const sharedPortfolioTotals = computed(() => {
  const rows = sharedPortfolio.value || [];

  const clientesCompartidos = rows.reduce((acc, row) => acc + Number(row.clientesCompartidos || 0), 0);
  const bnb = rows.reduce((acc, row) => acc + Number(row.bnb || 0), 0);
  const otrosBancos = rows.reduce((acc, row) => acc + Number(row.otrosBancos || 0), 0);
  const totalCompartido = bnb + otrosBancos;

  return {
    clientesCompartidos,
    bnb,
    otrosBancos,
    totalCompartido,
    participacionBNBPct: totalCompartido > 0 ? (bnb * 100) / totalCompartido : null,
    participacionOtrosPct: totalCompartido > 0 ? (otrosBancos * 100) / totalCompartido : null,
    potencialCompra: otrosBancos
  };
});

const sharedPortfolioBankTotals = computed(() => {
  const bankKeys = ['BIS', 'BCR', 'BEC', 'BIE', 'BGA', 'BME', 'BSO', 'OTRO'];

  return bankKeys
      .map((bank) => {
        const key = bank.toLowerCase();

        const monto = (sharedPortfolio.value || []).reduce(
            (acc, row) => acc + Number(row[key] || 0),
            0
        );

        const total = sharedPortfolioTotals.value.otrosBancos;

        return {
          banco: bank,
          monto,
          participacionPct: total > 0 ? (monto * 100) / total : null
        };
      })
      .filter((item) => item.monto > 0)
      .sort((a, b) => Number(b.monto || 0) - Number(a.monto || 0));
});

const sharedPortfolioAgencyRows = computed(() => {
  const grouped = new Map();

  (sharedPortfolio.value || []).forEach((row) => {
    const key = `${row.sucursal || 'Sin sucursal'}|${row.codAgencia || 'N/D'}|${row.nombreAgencia || 'N/D'}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        sucursal: row.sucursal || 'Sin sucursal',
        codAgencia: row.codAgencia || 'N/D',
        nombreAgencia: row.nombreAgencia || 'N/D',
        clientesCompartidos: 0,
        bnb: 0,
        otrosBancos: 0,
        totalCompartido: 0
      });
    }

    const item = grouped.get(key);

    item.clientesCompartidos += Number(row.clientesCompartidos || 0);
    item.bnb += Number(row.bnb || 0);
    item.otrosBancos += Number(row.otrosBancos || 0);
    item.totalCompartido += Number(row.totalCompartido || 0);
  });

  return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        participacionBNBPct: item.totalCompartido > 0 ? (item.bnb * 100) / item.totalCompartido : null,
        participacionOtrosPct: item.totalCompartido > 0 ? (item.otrosBancos * 100) / item.totalCompartido : null,
        prioridad:
            item.otrosBancos >= 5_000_000 ? 'Alta' :
                item.otrosBancos >= 1_000_000 ? 'Media' : 'Baja'
      }))
      .sort((a, b) => Number(b.otrosBancos || 0) - Number(a.otrosBancos || 0));
});

const sharedPortfolioSegmentRows = computed(() => {
  const grouped = new Map();

  (sharedPortfolio.value || []).forEach((row) => {
    const segmento = row.segmento || 'N/D';

    if (!grouped.has(segmento)) {
      grouped.set(segmento, {
        segmento,
        clientesCompartidos: 0,
        bnb: 0,
        otrosBancos: 0,
        totalCompartido: 0
      });
    }

    const item = grouped.get(segmento);

    item.clientesCompartidos += Number(row.clientesCompartidos || 0);
    item.bnb += Number(row.bnb || 0);
    item.otrosBancos += Number(row.otrosBancos || 0);
    item.totalCompartido += Number(row.totalCompartido || 0);
  });

  return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        participacionOtrosPct: item.totalCompartido > 0 ? (item.otrosBancos * 100) / item.totalCompartido : null
      }))
      .sort((a, b) => Number(b.otrosBancos || 0) - Number(a.otrosBancos || 0));
});
function matrixCellClass(value) {
  const n = Number(value || 0);

  if (n >= 5_000_000) return 'matrix-high';
  if (n >= 1_000_000) return 'matrix-mid';
  if (n > 0) return 'matrix-low';

  return 'matrix-empty';
}
const sharedPortfolioMatrix = computed(() => {
  const rows = sharedPortfolio.value || [];

  const bankKeys = [
    { key: 'bis', banco: 'BIS' },
    { key: 'bcr', banco: 'BCR' },
    { key: 'bec', banco: 'BEC' },
    { key: 'bie', banco: 'BIE' },
    { key: 'bga', banco: 'BGA' },
    { key: 'bme', banco: 'BME' },
    { key: 'bso', banco: 'BSO' },
    { key: 'otro', banco: 'OTRO' }
  ];

  const segments = Array.from(
      new Set(
          rows
              .map((row) => row.segmento || 'N/D')
              .filter(Boolean)
      )
  ).sort((a, b) => a.localeCompare(b));

  const segmentTotals = {};
  const bankTotals = {};
  const matrixMap = new Map();

  bankKeys.forEach((bank) => {
    matrixMap.set(bank.banco, {
      banco: bank.banco,
      key: bank.key,
      segmentos: {},
      totalBanco: 0,
      participacionTotalPct: 0
    });

    bankTotals[bank.banco] = 0;
  });

  segments.forEach((segment) => {
    segmentTotals[segment] = 0;
  });

  rows.forEach((row) => {
    const segment = row.segmento || 'N/D';

    bankKeys.forEach((bank) => {
      const monto = Number(row[bank.key] || 0);

      const bankRow = matrixMap.get(bank.banco);

      if (!bankRow.segmentos[segment]) {
        bankRow.segmentos[segment] = {
          segmento: segment,
          monto: 0,
          participacionSegmentoPct: null
        };
      }

      bankRow.segmentos[segment].monto += monto;
      bankRow.totalBanco += monto;

      bankTotals[bank.banco] += monto;
      segmentTotals[segment] += monto;
    });
  });

  const totalGeneral = Object.values(bankTotals).reduce(
      (acc, value) => acc + Number(value || 0),
      0
  );

  const resultRows = Array.from(matrixMap.values())
      .map((bankRow) => {
        segments.forEach((segment) => {
          const monto = Number(bankRow.segmentos[segment]?.monto || 0);
          const totalSegmento = Number(segmentTotals[segment] || 0);

          bankRow.segmentos[segment] = {
            ...bankRow.segmentos[segment],
            monto,
            participacionSegmentoPct:
                totalSegmento > 0 ? (monto * 100) / totalSegmento : null
          };
        });

        return {
          ...bankRow,
          participacionTotalPct:
              totalGeneral > 0 ? (bankRow.totalBanco * 100) / totalGeneral : 0
        };
      })
      .filter((row) => Number(row.totalBanco || 0) > 0)
      .sort((a, b) => Number(b.totalBanco || 0) - Number(a.totalBanco || 0));

  return {
    segments,
    rows: resultRows,
    segmentTotals,
    totalGeneral
  };
});

const sharedPortfolioBankChart = computed(() => ({
  labels: sharedPortfolioBankTotals.value.map((item) => item.banco),
  datasets: [
    {
      label: 'Monto compartido otros bancos',
      data: sharedPortfolioBankTotals.value.map((item) => item.monto),
      backgroundColor: '#8b5cf6',
      borderRadius: 8
    }
  ]
}));

const sharedPortfolioDonutChart = computed(() => ({
  labels: ['BNB', 'Otros bancos'],
  datasets: [
    {
      data: [
        sharedPortfolioTotals.value.bnb,
        sharedPortfolioTotals.value.otrosBancos
      ],
      backgroundColor: ['#26b460', '#8b5cf6'],
      borderColor: '#ffffff',
      borderWidth: 3,
      hoverOffset: 8
    }
  ]
}));

const sharedPortfolioSegmentChart = computed(() => ({
  labels: sharedPortfolioSegmentRows.value.map((item) => item.segmento),
  datasets: [
    {
      label: 'Potencial compra deuda',
      data: sharedPortfolioSegmentRows.value.map((item) => item.otrosBancos),
      backgroundColor: '#26b460',
      borderRadius: 8
    }
  ]
}));

const sharedPortfolioBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: {display: false},
    tooltip: {
      ...tooltipBase,
      callbacks: {
        label: (ctx) => {
          const value = Number(ctx.raw || 0);
          return ` ${ctx.dataset.label}: ${moneyFullNoDecimals(value)}`;
        }
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        callback: (value) => moneyFullNoDecimals(value)
      }
    },
    y: {
      grid: {display: false, drawBorder: false},
      ticks: {
        color: '#4a6355',
        font: {size: 11, weight: '600'}
      }
    }
  }
};

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
        x: Number(item.montoSistema || 0),
        y: Number(item.crecimientoTotal || 0),
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

const pdRiskTotals = computed(() => {
  const rows = pdRisk.value || [];

  const alto = rows.reduce((acc, row) => acc + Number(row.alto || 0), 0);
  const media = rows.reduce((acc, row) => acc + Number(row.media || 0), 0);
  const baja = rows.reduce((acc, row) => acc + Number(row.baja || 0), 0);
  const total = alto + media + baja;

  return {
    alto,
    media,
    baja,
    total,
    altoPct: total > 0 ? (alto * 100) / total : null,
    mediaPct: total > 0 ? (media * 100) / total : null,
    bajaPct: total > 0 ? (baja * 100) / total : null
  };
});

const pdRiskByProduct = computed(() => {
  const grouped = new Map();

  (pdRisk.value || []).forEach((row) => {
    const producto = row.producto || 'N/D';

    if (!grouped.has(producto)) {
      grouped.set(producto, {
        producto,
        alto: 0,
        media: 0,
        baja: 0,
        total: 0
      });
    }

    const item = grouped.get(producto);

    item.alto += Number(row.alto || 0);
    item.media += Number(row.media || 0);
    item.baja += Number(row.baja || 0);
    item.total += Number(row.totalOperaciones || 0);
  });

  return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        altoPct: item.total > 0 ? (item.alto * 100) / item.total : null,
        mediaPct: item.total > 0 ? (item.media * 100) / item.total : null,
        bajaPct: item.total > 0 ? (item.baja * 100) / item.total : null
      }))
      .sort((a, b) => Number(b.alto || 0) - Number(a.alto || 0));
});

const pdRiskBySucursal = computed(() => {
  const grouped = new Map();

  (pdRisk.value || []).forEach((row) => {
    const sucursal = row.sucursal || 'Sin sucursal';

    if (!grouped.has(sucursal)) {
      grouped.set(sucursal, {
        sucursal,
        alto: 0,
        media: 0,
        baja: 0,
        total: 0
      });
    }

    const item = grouped.get(sucursal);

    item.alto += Number(row.alto || 0);
    item.media += Number(row.media || 0);
    item.baja += Number(row.baja || 0);
    item.total += Number(row.totalOperaciones || 0);
  });

  return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        altoPct: item.total > 0 ? (item.alto * 100) / item.total : null
      }))
      .sort((a, b) => Number(b.alto || 0) - Number(a.alto || 0));
});

const pdRiskCriticalAgencies = computed(() =>
    [...(pdRisk.value || [])]
        .sort((a, b) => {
          const altoCompare = Number(b.alto || 0) - Number(a.alto || 0);

          if (altoCompare !== 0) {
            return altoCompare;
          }

          return Number(b.media || 0) - Number(a.media || 0);
        })
        .slice(0, 15)
);

const pdRiskHistoryByPeriod = computed(() => {
  const grouped = new Map();

  (pdRiskHistory.value || []).forEach((row) => {
    const periodo = toPeriodYYYYMM(row.fecha);

    if (!grouped.has(periodo)) {
      grouped.set(periodo, {
        periodo,
        alto: 0,
        media: 0,
        baja: 0,
        total: 0,
        productos: new Map()
      });
    }

    const item = grouped.get(periodo);

    const alto = Number(row.alto || 0);
    const media = Number(row.media || 0);
    const baja = Number(row.baja || 0);

    item.alto += alto;
    item.media += media;
    item.baja += baja;
    item.total += alto + media + baja;

    const producto = row.producto || 'N/D';

    if (!item.productos.has(producto)) {
      item.productos.set(producto, {
        producto,
        alto: 0,
        media: 0,
        baja: 0,
        total: 0
      });
    }

    const prod = item.productos.get(producto);

    prod.alto += alto;
    prod.media += media;
    prod.baja += baja;
    prod.total += alto + media + baja;
  });

  return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        productos: Array.from(item.productos.values())
            .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
      }))
      .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
});

const pdRiskHistoryChart = computed(() => ({
  labels: pdRiskHistoryByPeriod.value.map((item) => item.periodo),
  datasets: [
    {
      label: 'Alta probabilidad',
      data: pdRiskHistoryByPeriod.value.map((item) => item.alto),
      borderColor: '#e05252',
      backgroundColor: 'rgba(224,82,82,.12)',
      borderWidth: 3,
      tension: 0.35,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 7
    },
    {
      label: 'Media probabilidad',
      data: pdRiskHistoryByPeriod.value.map((item) => item.media),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,.12)',
      borderWidth: 3,
      tension: 0.35,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 7
    }
  ]
}));

const pdRiskHistoryLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {duration: 600, easing: 'easeOutQuart'},
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
        title: (items) => {
          const periodo = items?.[0]?.label || 'N/D';
          return `Periodo ${periodo}`;
        },
        label: (ctx) => {
          const value = Number(ctx.raw || 0);
          return ` ${ctx.dataset.label}: ${value.toLocaleString('en-US')} operaciones`;
        },
        afterBody: (items) => {
          const first = items?.[0];

          if (!first) return [];

          const periodo = first.label;
          const periodRow = pdRiskHistoryByPeriod.value.find((item) => item.periodo === periodo);

          if (!periodRow) return [];

          const lines = [
            '',
            `Total del periodo: ${Number(periodRow.total || 0).toLocaleString('en-US')} operaciones`,
            'Distribución por producto:'
          ];

          periodRow.productos.slice(0, 8).forEach((prod) => {
            lines.push(
                `${prod.producto}: Alta ${Number(prod.alto || 0).toLocaleString('en-US')} | Media ${Number(prod.media || 0).toLocaleString('en-US')} | Baja ${Number(prod.baja || 0).toLocaleString('en-US')}`
            );
          });

          if (periodRow.productos.length > 8) {
            lines.push(`+${periodRow.productos.length - 8} productos adicionales`);
          }

          return lines;
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
      beginAtZero: true,
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        font: {size: 12},
        callback: (value) => Number(value).toLocaleString('en-US')
      }
    }
  }
};

const pdRiskSucursalChart = computed(() => ({
  labels: pdRiskBySucursal.value.slice(0, 10).map((item) => item.sucursal),
  datasets: [
    {
      label: 'Alta probabilidad',
      data: pdRiskBySucursal.value.slice(0, 10).map((item) => item.alto),
      backgroundColor: '#e05252',
      borderRadius: 8
    }
  ]
}));

const pdRiskSucursalProductBreakdown = computed(() => {
  const grouped = new Map();

  (pdRisk.value || []).forEach((row) => {
    const sucursal = row.sucursal || 'Sin sucursal';
    const producto = row.producto || 'N/D';

    if (!grouped.has(sucursal)) {
      grouped.set(sucursal, new Map());
    }

    const productMap = grouped.get(sucursal);

    if (!productMap.has(producto)) {
      productMap.set(producto, {
        producto,
        alto: 0,
        media: 0,
        baja: 0,
        total: 0
      });
    }

    const item = productMap.get(producto);

    item.alto += Number(row.alto || 0);
    item.media += Number(row.media || 0);
    item.baja += Number(row.baja || 0);
    item.total += Number(row.totalOperaciones || 0);
  });

  const result = new Map();

  grouped.forEach((productMap, sucursal) => {
    result.set(
        sucursal,
        Array.from(productMap.values())
            .map((item) => ({
              ...item,
              altoPct: item.total > 0 ? (item.alto * 100) / item.total : null
            }))
            .sort((a, b) => Number(b.alto || 0) - Number(a.alto || 0))
    );
  });

  return result;
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


const portadaIntegratedSummaryCards = computed(() => [
  {
    label: 'Captaciones ejecutadas',
    value: moneyFull(captacionesTotals.value.ejecutadaCaptaciones),
    helper: `${percent(captacionesTotals.value.cumplimientoCaptacionesPct)} de cumplimiento · Brecha ${signedMoneyFullNoDecimals(captacionesTotals.value.brechaCaptaciones)}`,
    icon: 'piggy-bank',
    tone: Number(captacionesTotals.value.brechaCaptaciones || 0) >= 0 ? 'success' : 'danger'
  },
  {
    label: 'Alertas captaciones',
    value: Number(captacionesFugaTotals.value.totalAgencias || 0).toLocaleString('en-US'),
    helper: `${moneyFullNoDecimals(captacionesFugaTotals.value.montoRiesgo)} en agencias con categoría de alerta`,
    icon: 'triangle-exclamation',
    tone: Number(captacionesFugaTotals.value.montoRiesgo || 0) > 0 ? 'danger' : 'success'
  },
  {
    label: 'Maduración ponderada',
    value: percent(maduracionTotals.value.maduracionPonderadaPct),
    helper: `${moneyFull(maduracionTotals.value.stock)} en stock vigente`,
    icon: 'hourglass-half',
    tone: Number(maduracionTotals.value.maduracionPonderadaPct || 0) > 50 ? 'danger' : Number(maduracionTotals.value.maduracionPonderadaPct || 0) >= 30 ? 'warning' : 'success'
  },
  {
    label: 'LCF no utilizado',
    value: moneyFull(lcfTotals.value.cupoNoUtilizado),
    helper: `${percent(lcfTotals.value.cupoNoUtilizadoPct)} del monto autorizado`,
    icon: 'credit-card',
    tone: Number(lcfTotals.value.cupoNoUtilizado || 0) > 0 ? 'success' : 'warning'
  },
  {
    label: 'Cartera compartida',
    value: moneyFull(sharedPortfolioTotals.value.otrosBancos),
    helper: `${sharedPortfolioTotals.value.clientesCompartidos.toLocaleString('en-US')} clientes compartidos`,
    icon: 'building-columns',
    tone: 'info'
  },
  {
    label: 'Oportunidad total',
    value: moneyFull(oportunidadesTotals.value.oportunidadTotal),
    helper: 'LCF no utilizado + cartera otros bancos',
    icon: 'lightbulb',
    tone: 'success'
  }
]);

const portadaExecutiveAlerts = computed(() => {
  const alerts = [];

  if (Number(summary.value?.brechaPresupuesto || 0) < 0) {
    alerts.push({
      title: 'Brecha de cartera bajo presupuesto',
      detail: `Faltan ${moneyFullNoDecimals(Math.abs(Number(summary.value?.brechaPresupuesto || 0)))} para alcanzar la meta de stock.`,
      tone: 'danger',
      icon: 'triangle-exclamation'
    });
  }

  if (Number(captacionesTotals.value.brechaCaptaciones || 0) < 0) {
    alerts.push({
      title: 'Captaciones por debajo del presupuesto',
      detail: `Brecha actual de ${signedMoneyFullNoDecimals(captacionesTotals.value.brechaCaptaciones)} frente al presupuesto.`,
      tone: 'danger',
      icon: 'piggy-bank'
    });
  }

  if (Number(captacionesFugaTotals.value.montoRiesgo || 0) > 0) {
    alerts.push({
      title: 'Alertas por categoría de captaciones',
      detail: `${captacionesFugaTotals.value.totalAgencias} agencias tienen categoría de alerta; saldo observado ${moneyFullNoDecimals(captacionesFugaTotals.value.montoRiesgo)}.`,
      tone: 'warning',
      icon: 'arrow-trend-down'
    });
  }

  if (Number(lcfTotals.value.cupoNoUtilizado || 0) > 0) {
    alerts.push({
      title: 'Cupo LCF pendiente de activar',
      detail: `Existe ${moneyFullNoDecimals(lcfTotals.value.cupoNoUtilizado)} disponible para activación comercial.`,
      tone: 'success',
      icon: 'credit-card'
    });
  }

  if (Number(sharedPortfolioTotals.value.otrosBancos || 0) > 0) {
    alerts.push({
      title: 'Compra de deuda potencial',
      detail: `La cartera compartida en otros bancos suma ${moneyFullNoDecimals(sharedPortfolioTotals.value.otrosBancos)}.`,
      tone: 'info',
      icon: 'building-columns'
    });
  }

  return alerts.slice(0, 5);
});

const portadaOpportunityAgencyTop = computed(() => oportunidadesByAgencia.value.slice(0, 6));

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

const portadaProductGoalTotals = computed(() => {
  const rows = portadaTopProducts.value || [];

  const stock = rows.reduce((acc, row) => acc + Number(row.stock || 0), 0);
  const stockBase = rows.reduce((acc, row) => acc + Number(row.stockBase || 0), 0);
  const presupuesto = rows.reduce((acc, row) => acc + Number(row.presupuesto || 0), 0);
  const diferencia = stock - presupuesto;
  const crecimientoMonto = stock - stockBase;

  const cumplimientoPct = presupuesto > 0 ? (stock / presupuesto) * 100 : null;
  const crecimientoPct = stockBase > 0 ? ((stock / stockBase) - 1) * 100 : null;

  return {
    stock,
    stockBase,
    presupuesto,
    diferencia,
    crecimientoMonto,
    cumplimientoPct,
    crecimientoPct
  };
});

const portadaProductGoalRows = computed(() => {
  const rows = [...(kpisProductData.value || [])]
      .filter((p) => p.producto)
      .map((p) => {
        const stock = Number(p.stock || 0);
        const stockBase = Number(p.stockBase || 0);
        const presupuesto = Number(p.presupuesto || 0);
        const diferencia = stock - presupuesto;
        const crecimientoMonto = productGrowthAmount(p);

        return {
          producto: p.producto,
          stock,
          stockBase,
          presupuesto,
          diferencia,
          cumplimientoPct: p.cumplimientoPct,
          crecimientoMonto,
          crecimientoPct: p.crecimientoPct,
          isTotal: false
        };
      });

  const totalStock = rows.reduce((acc, row) => acc + Number(row.stock || 0), 0);
  const totalStockBase = rows.reduce((acc, row) => acc + Number(row.stockBase || 0), 0);
  const totalPresupuesto = rows.reduce((acc, row) => acc + Number(row.presupuesto || 0), 0);
  const totalDiferencia = totalStock - totalPresupuesto;
  const totalCrecimientoMonto = totalStock - totalStockBase;

  const totalCumplimientoPct =
      totalPresupuesto > 0
          ? (totalStock / totalPresupuesto) * 100
          : null;

  const totalCrecimientoPct =
      totalStockBase > 0
          ? ((totalStock / totalStockBase) - 1) * 100
          : null;

  rows.push({
    producto: 'TOTAL',
    stock: totalStock,
    stockBase: totalStockBase,
    presupuesto: totalPresupuesto,
    diferencia: totalDiferencia,
    cumplimientoPct: totalCumplimientoPct,
    crecimientoMonto: totalCrecimientoMonto,
    crecimientoPct: totalCrecimientoPct,
    isTotal: true
  });

  return rows;
});

const portadaProductGoalChart = computed(() => {
  const rows = portadaProductGoalRows.value;

  return {
    labels: rows.map((p) => p.producto),
    datasets: [
      {
        label: 'Sobre meta',
        data: rows.map((p) => p.diferencia > 0 ? p.diferencia : null),
        backgroundColor: rows.map((p) => p.isTotal ? '#1a8a49' : '#26b460'),
        borderColor: rows.map((p) => p.isTotal ? '#116b38' : '#26b460'),
        borderWidth: rows.map((p) => p.isTotal ? 2 : 1),
        borderRadius: 10,
        borderSkipped: false,
        metaRows: rows
      },
      {
        label: 'Bajo meta',
        data: rows.map((p) => p.diferencia < 0 ? p.diferencia : null),
        backgroundColor: rows.map((p) => p.isTotal ? '#b91c1c' : '#e05252'),
        borderColor: rows.map((p) => p.isTotal ? '#991b1b' : '#e05252'),
        borderWidth: rows.map((p) => p.isTotal ? 2 : 1),
        borderRadius: 10,
        borderSkipped: false,
        metaRows: rows
      },
      {
        label: 'Línea cero',
        data: rows.map(() => 0),
        type: 'line',
        borderColor: '#8b5cf6',
        backgroundColor: '#8b5cf6',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        fill: false,
        metaRows: rows
      }
    ]
  };
});

const portadaProductGoalOptions = {
  responsive: true,
  maintainAspectRatio: false,

  interaction: {
    mode: 'nearest',
    intersect: true
  },

  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: '#4a6355',
        boxWidth: 12,
        padding: 16,
        usePointStyle: true,
        filter: (legendItem) => legendItem.text !== 'Línea cero'
      }
    },

    tooltip: {
      ...tooltipBase,

      filter: (tooltipItem) => {
        const label = tooltipItem.dataset.label;
        const value = Number(tooltipItem.raw);

        if (label === 'Línea cero') return false;
        if (label === 'Sobre meta') return value > 0;
        if (label === 'Bajo meta') return value < 0;

        return true;
      },

      callbacks: {
        title: (items) => {
          return items[0]?.label || '';
        },

        label: (ctx) => {
          const row = ctx.dataset.metaRows?.[ctx.dataIndex];

          if (!row) return '';

          if (row.diferencia > 0) {
            return ` Sobre meta: ${signedMoneyFullNoDecimals(row.diferencia)}`;
          }

          if (row.diferencia < 0) {
            return ` Bajo meta: ${signedMoneyFullNoDecimals(row.diferencia)}`;
          }

          return ` En meta: ${moneyFullNoDecimals(0)}`;
        },

        afterBody: (items) => {
          const first = items[0];

          if (!first) return [];

          const row = first.dataset.metaRows?.[first.dataIndex];

          if (!row) return [];

          return [
            '', `Stock diciembre: ${moneyFullNoDecimals(row.stockBase)}`,
            `Stock actual: ${moneyFullNoDecimals(row.stock)}`,
            `Meta presupuesto: ${moneyFullNoDecimals(row.presupuesto)}`,
            `Cumplimiento: ${
                row.cumplimientoPct === null || row.cumplimientoPct === undefined
                    ? 'N/A'
                    : `${Number(row.cumplimientoPct).toFixed(2)}%`
            }`,
            `Crecimiento monto: ${signedMoneyFullNoDecimals(row.crecimientoMonto)}`,
            `Crecimiento %: ${
                row.crecimientoPct === null || row.crecimientoPct === undefined
                    ? 'N/A'
                    : `${Number(row.crecimientoPct).toFixed(2)}%`
            }`
          ];
        },

        labelColor: (ctx) => {
          const row = ctx.dataset.metaRows?.[ctx.dataIndex];

          if (row?.diferencia > 0) {
            return {
              borderColor: '#26b460',
              backgroundColor: '#26b460'
            };
          }

          if (row?.diferencia < 0) {
            return {
              borderColor: '#e05252',
              backgroundColor: '#e05252'
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
      grid: {
        color: (ctx) => {
          if (ctx.tick.value === 0) return 'rgba(139,92,246,.35)';
          return 'rgba(15,31,22,.05)';
        },
        drawBorder: false
      },
      beginAtZero: true,
      ticks: {
        color: '#6f8177',
        font: {size: 12},
        callback: (value) => signedMoneyFullNoDecimals(value)
      }
    }
  }
};

const pdRiskStackedOptions = {
  responsive: true,
  maintainAspectRatio: false,
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
          const value = Number(ctx.raw || 0);

          return ` ${ctx.dataset.label}: ${value.toLocaleString('en-US')} operaciones`;
        },
        afterBody: (items) => {
          const first = items[0];

          if (!first) return [];

          const producto = first.label;
          const row = pdRiskByProduct.value.find((item) => item.producto === producto);

          if (!row) return [];

          return [
            '',
            `Total evaluado: ${Number(row.total || 0).toLocaleString('en-US')}`,
            `% Alta: ${row.altoPct === null ? 'N/A' : `${Number(row.altoPct).toFixed(2)}%`}`,
            `% Media: ${row.mediaPct === null ? 'N/A' : `${Number(row.mediaPct).toFixed(2)}%`}`,
            `% Baja: ${row.bajaPct === null ? 'N/A' : `${Number(row.bajaPct).toFixed(2)}%`}`
          ];
        }
      }
    }
  },
  scales: {
    x: {
      stacked: true,
      grid: {color: 'rgba(15,31,22,.04)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        font: {size: 11, weight: '600'},
        autoSkip: false,
        maxRotation: 0,
        minRotation: 0
      }
    },
    y: {
      stacked: true,
      beginAtZero: true,
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        font: {size: 12},
        callback: (value) => Number(value).toLocaleString('en-US')
      }
    }
  }
};

const pdRiskBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      ...tooltipBase,
      callbacks: {
        label: (ctx) => {
          const value = Number(ctx.raw || 0);

          return ` Alta probabilidad: ${value.toLocaleString('en-US')} operaciones`;
        },

        afterBody: (items) => {
          const first = items[0];

          if (!first) return [];

          const sucursal = first.label;
          const row = pdRiskBySucursal.value.find((item) => item.sucursal === sucursal);
          const products = pdRiskSucursalProductBreakdown.value.get(sucursal) || [];

          if (!row) return [];

          const lines = [
            '',
            `Total evaluado: ${Number(row.total || 0).toLocaleString('en-US')}`,
            `% Alta: ${row.altoPct === null ? 'N/A' : `${Number(row.altoPct).toFixed(2)}%`}`,
            '',
            'Distribución por producto:'
          ];

          products.slice(0, 8).forEach((prod) => {
            lines.push(
                `${prod.producto}: ${Number(prod.alto || 0).toLocaleString('en-US')}`
            );
          });

          if (products.length > 8) {
            lines.push(`+${products.length - 8} productos adicionales`);
          }

          return lines;
        }
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        callback: (value) => Number(value).toLocaleString('en-US')
      }
    },
    y: {
      grid: {display: false, drawBorder: false},
      ticks: {
        color: '#4a6355',
        font: {size: 11, weight: '600'}
      }
    }
  }
};


function benchmarkPeriodLabel(row) {
  const value = benchmarkDateValue(row);

  if (!value) return 'N/D';

  const period = toPeriodYYYYMM(value);

  return period === 'Último periodo disponible' ? 'N/D' : period;
}

const portadaGrowthLeadersPeriod = computed(() => {
  const rowWithDate = (benchmark.value || []).find((row) => row.fechaCorteSF);

  if (!rowWithDate?.fechaCorteSF) {
    return 'N/D';
  }

  return toPeriodYYYYMM(rowWithDate.fechaCorteSF);
});
const portadaGrowthLeaders = computed(() => {
  const prodFilters = filtersApplied.value.producto || [];

  const rows = (benchmark.value || []).filter((item) => {
    const producto = item.producto || item.segmentacioncredito;

    if (!producto) return false;

    return (
        prodFilters.length === 0 ||
        prodFilters.includes('TODOS') ||
        prodFilters.includes(producto)
    );
  });

  const grouped = new Map();

  rows.forEach((row) => {
    const producto = row.producto || row.segmentacioncredito;

    if (!grouped.has(producto)) {
      grouped.set(producto, []);
    }

    grouped.get(producto).push({
      producto,
      banco: row.banco || 'N/D',
      stock: Number(row.stock || row.montoActual || row.MontoActualUSD || 0),
      crecimientoTotal: Number(row.crecimientoTotal || row.CrecimientoTotalUSD || 0),
      crecimientoPct: row.crecimientoPct === null || row.crecimientoPct === undefined
          ? null
          : Number(row.crecimientoPct),

      // Fecha correcta: origen Hub_CarteraSF
      fechaCorteSF: row.fechaCorteSF || null,
      periodoCorteSF: row.fechaCorteSF ? toPeriodYYYYMM(row.fechaCorteSF) : 'N/D'
    });
  });

  const result = [];

  grouped.forEach((items, producto) => {
    const ordered = [...items].sort(
        (a, b) => Number(b.crecimientoTotal || 0) - Number(a.crecimientoTotal || 0)
    );

    const leader = ordered[0];

    const bnbIndex = ordered.findIndex((item) =>
        String(item.banco || '').trim().toUpperCase() === 'BNB'
    );

    const bnb = bnbIndex >= 0 ? ordered[bnbIndex] : null;

    const crecimientoSistemaTotal = ordered.reduce(
        (acc, item) => acc + Number(item.crecimientoTotal || 0),
        0
    );

    result.push({
      producto,

      banco: leader?.banco || 'N/D',
      crecimientoTotal: Number(leader?.crecimientoTotal || 0),
      crecimientoPct: leader?.crecimientoPct ?? null,

      bnbPosicion: bnb ? bnbIndex + 1 : null,
      bnbCrecimientoTotal: bnb ? Number(bnb.crecimientoTotal || 0) : null,
      bnbCrecimientoPct: bnb?.crecimientoPct ?? null,

      crecimientoSistemaTotal,
      totalBancos: ordered.length,

      // Fecha oficial de la fuente Hub_CarteraSF
      fechaCorteSF: leader?.fechaCorteSF || null,
      periodoCorteSF: leader?.periodoCorteSF || 'N/D'
    });
  });

  return result
      .sort((a, b) => Number(b.crecimientoSistemaTotal || 0) - Number(a.crecimientoSistemaTotal || 0))
      .slice(0, 6);
});

// ─────────────────────────────────────────────────────────────
// Otros computed de módulos
// ─────────────────────────────────────────────────────────────

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
- Regla obligatoria de maduración: mayor maduración es peor y representa mayor prioridad comercial, porque el crédito se está completando/venciendo.
- Maduración crítica: >50%. Maduración en alerta: 30% a 50%. Maduración normal: <30%.
- En maduración, no interpretes un porcentaje alto como positivo; interprétalo como señal de retención, renovación, recompra, refinanciamiento o ampliación.
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

function buildCompetitorBenchmarkTable(limit = 160) {
  const rowsSource = filteredBenchmark.value || [];

  if (!rowsSource.length) {
    return 'No hay datos detallados de bancos competidores disponibles.';
  }

  const totalStockByProduct = new Map();

  rowsSource.forEach((row) => {
    const producto = row.producto || row.segmentacioncredito || 'N/A';
    const stock = safeNumber(row.stock ?? row.total ?? row.montoActual ?? row.MontoActualUSD);

    totalStockByProduct.set(
        producto,
        safeNumber(totalStockByProduct.get(producto)) + stock
    );
  });

  const rows = [...rowsSource]
      .map((row) => {
        const producto = row.producto || row.segmentacioncredito || 'N/A';
        const banco = row.banco || 'N/A';
        const stock = safeNumber(row.stock ?? row.total ?? row.montoActual ?? row.MontoActualUSD);
        const totalProducto = safeNumber(totalStockByProduct.get(producto));
        const participacionPct = totalProducto > 0 ? (stock / totalProducto) * 100 : null;
        const crecimientoMonto = safeNumber(row.crecimientoTotal ?? row.CrecimientoTotalUSD);
        const crecimientoPct = row.crecimientoPct === null || row.crecimientoPct === undefined
            ? null
            : Number(row.crecimientoPct);

        return {
          banco,
          producto,
          stock,
          participacionPct,
          crecimientoMonto,
          crecimientoPct
        };
      })
      .sort((a, b) => {
        const productCompare = String(a.producto || '').localeCompare(String(b.producto || ''));

        if (productCompare !== 0) {
          return productCompare;
        }

        const bnbPriorityA = String(a.banco || '').toUpperCase() === 'BNB' ? -1 : 0;
        const bnbPriorityB = String(b.banco || '').toUpperCase() === 'BNB' ? -1 : 0;

        if (bnbPriorityA !== bnbPriorityB) {
          return bnbPriorityA - bnbPriorityB;
        }

        return safeNumber(b.stock) - safeNumber(a.stock);
      })
      .slice(0, limit)
      .map((row) =>
          `| ${row.banco} | ${row.producto} | ${fmtMoneyPrompt(row.stock)} | ${fmtPctPrompt(row.participacionPct)} | ${fmtMoneyPrompt(row.crecimientoMonto)} | ${fmtPctPrompt(row.crecimientoPct)} |`
      )
      .join('\n');

  return `
Detalle BNB vs sistema financiero por banco y producto:
| Banco | Producto | Stock | Participación sobre producto | Crecimiento monto | Crecimiento % |
|---|---|---:|---:|---:|---:|
${rows}

Notas de lectura:
- Participación sobre producto = stock del banco / stock total del sistema financiero para ese producto.
- El total del sistema financiero incluye BNB.
- La tabla incluye BNB y los demás bancos competidores bajo la misma estructura.
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

function buildProjectionTable(limit = 36) {
  const rowsSource = [];

  const selectedProducts = selectedProjProducts.value || [];

  if (selectedProducts.length > 0) {
    selectedProducts.forEach((product) => {
      const rows = projectionProductData.value?.[product] || [];

      rows.forEach((row) => {
        rowsSource.push({
          ...row,
          producto: product
        });
      });
    });
  } else {
    (projection.value || []).forEach((row) => {
      rowsSource.push({
        ...row,
        producto: row.producto || 'Consolidado'
      });
    });
  }

  if (!rowsSource.length) {
    return 'No hay información de proyección disponible.';
  }

  const rows = [...rowsSource]
      .sort((a, b) => {
        const da = new Date(a.fecha || a.month);
        const db = new Date(b.fecha || b.month);

        if (!Number.isNaN(da.getTime()) && !Number.isNaN(db.getTime())) {
          return da - db;
        }

        return String(a.month || '').localeCompare(String(b.month || ''));
      })
      .slice(0, limit)
      .map((p) => {
        const periodo = toPeriodYYYYMM(p.fecha || p.month);
        const desembolso = Number(p.desembolso || 0) * 1000;
        const amortizacion = Number(p.amortizacion || 0) * 1000;
        const flujoNeto = desembolso - amortizacion;

        return `| ${periodo} | ${p.producto || 'Consolidado'} | ${p.tipoDato || 'N/D'} | ${fmtMoneyPrompt(desembolso)} | ${fmtMoneyPrompt(amortizacion)} | ${fmtMoneyPrompt(flujoNeto)} |`;
      })
      .join('\n');

  return `
Proyección financiera:
| Periodo yyyymm | Producto | Tipo dato | Desembolso proyectado | Amortización proyectada | Flujo neto |
|---|---|---|---:|---:|---:|
${rows}

Notas:
- Escenario de desembolsos: ${desembolsoScenario.value}.
- Escenario de amortización: ${amortizacionScenario.value}.
- Flujo neto = desembolso - amortización.
- HISTORICO representa dato real; PROYECCION representa escenario futuro.
`.trim();
}

function buildPdRiskTable(limit = 20) {
  if (!pdRisk.value?.length) {
    return 'No hay información de riesgo predictivo disponible.';
  }

  const totals = pdRiskTotals.value;

  const rows = [...pdRisk.value]
      .sort((a, b) => {
        const highCompare = safeNumber(b.alto) - safeNumber(a.alto);
        if (highCompare !== 0) return highCompare;

        return safeNumber(b.media) - safeNumber(a.media);
      })
      .slice(0, limit)
      .map((r) => {
        return `| ${r.sucursal || 'N/D'} | ${r.nombreAgencia || r.codAgencia || 'N/D'} | ${r.producto || 'N/D'} | ${Number(r.alto || 0).toLocaleString('en-US')} | ${Number(r.media || 0).toLocaleString('en-US')} | ${Number(r.baja || 0).toLocaleString('en-US')} | ${Number(r.totalOperaciones || 0).toLocaleString('en-US')} | ${fmtPctPrompt(r.altoPct)} |`;
      })
      .join('\n');

  return `
Riesgo predictivo de mora:
Resumen:
| Métrica | Valor |
|---|---:|
| Operaciones alta probabilidad | ${Number(totals.alto || 0).toLocaleString('en-US')} |
| Operaciones media probabilidad | ${Number(totals.media || 0).toLocaleString('en-US')} |
| Operaciones baja probabilidad | ${Number(totals.baja || 0).toLocaleString('en-US')} |
| Total evaluado | ${Number(totals.total || 0).toLocaleString('en-US')} |
| % alta probabilidad | ${fmtPctPrompt(totals.altoPct)} |
| % media probabilidad | ${fmtPctPrompt(totals.mediaPct)} |
| % baja probabilidad | ${fmtPctPrompt(totals.bajaPct)} |

Detalle crítico por agencia:
| Sucursal | Agencia | Producto | Alta | Media | Baja | Total | % Alta |
|---|---|---|---:|---:|---:|---:|---:|
${rows}

Interpretación:
- Alta, Media y Baja representan cantidad de operaciones según probabilidad de caer en mora el siguiente mes.
- Alta debe priorizarse como alerta temprana comercial y de seguimiento preventivo.
`.trim();
}



function buildCaptacionesTable(limit = 20) {
  if (!captaciones.value?.length) return 'No hay información de captaciones disponible.';

  const totals = captacionesTotals.value;
  const fuga = captacionesFugaTotals.value;

  const rows = [...captacionesByAgencia.value]
      .sort((a, b) => safeNumber(b.ejecutadaCaptaciones) - safeNumber(a.ejecutadaCaptaciones))
      .slice(0, limit)
      .map((r) => `| ${r.sucursal || 'N/D'} | ${r.nombreAgencia || r.codAgencia || 'N/D'} | ${fmtMoneyPrompt(r.ejecutadaCaptaciones)} | ${fmtMoneyPrompt(r.presupuestadaCaptaciones)} | ${fmtMoneyPrompt(r.brechaCaptaciones)} | ${fmtPctPrompt(r.cumplimientoCaptacionesPct)} | ${r.categoriaTendencia || 'N/D'} |`)
      .join('\n');

  return `
Captaciones:
Resumen:
| Métrica | Valor |
|---|---:|
| Periodo captaciones | ${captacionesPeriod.value} |
| Ejecutada captaciones | ${fmtMoneyPrompt(totals.ejecutadaCaptaciones)} |
| Presupuesto captaciones | ${fmtMoneyPrompt(totals.presupuestadaCaptaciones)} |
| Brecha captaciones | ${fmtMoneyPrompt(totals.brechaCaptaciones)} |
| Cumplimiento captaciones | ${fmtPctPrompt(totals.cumplimientoCaptacionesPct)} |
| Vista ejecutada | ${fmtMoneyPrompt(totals.ejecutadaVista)} |
| Ahorros ejecutado | ${fmtMoneyPrompt(totals.ejecutadaAhorros)} |
| DPF / Plazo ejecutado | ${fmtMoneyPrompt(totals.ejecutadaPlazo)} |
| Saldo observado en categorías de alerta | ${fmtMoneyPrompt(fuga.montoRiesgo)} |
| Agencias con categoría de alerta | ${fuga.totalAgencias} |

Detalle por agencia:
| Sucursal | Agencia | Ejecutado | Presupuesto | Brecha | Cumplimiento | Categoría tendencia |
|---|---|---:|---:|---:|---:|---|
${rows}
`.trim();
}

function buildMaduracionTable(limit = 20) {
  if (!maduracion.value?.length) return 'No hay información de maduración disponible.';

  const totals = maduracionTotals.value;

  const rows = [...maduracion.value]
      .sort((a, b) => Number(b.maduracionPct ?? -999) - Number(a.maduracionPct ?? -999))
      .slice(0, limit)
      .map((r) => `| ${r.sucursal || 'N/D'} | ${r.nombreAgencia || r.codAgencia || 'N/D'} | ${opportunityProduct(r)} | ${fmtMoneyPrompt(r.stock)} | ${fmtMoneyPrompt(r.montoDesembolso)} | ${fmtPctPrompt(r.maduracionPct)} | ${maduracionAlertLevel(r.maduracionPct)} | ${fmtPctPrompt(r.saldoSobreDesembolsoPct)} |`)
      .join('\n');

  return `
Maduración de créditos:
Regla de interpretación:
- Mayor maduración = peor condición comercial y mayor prioridad.
- Crítico >50%: crédito cercano a completarse/vencer; requiere acción prioritaria.
- Alerta 30–50%: seguimiento preventivo y gestión comercial.
- Normal <30%: menor prioridad relativa.

Resumen:
| Métrica | Valor |
|---|---:|
| Stock vigente | ${fmtMoneyPrompt(totals.stock)} |
| Monto desembolsado original | ${fmtMoneyPrompt(totals.montoDesembolso)} |
| Amortizado estimado | ${fmtMoneyPrompt(totals.amortizadoEstimado)} |
| Maduración ponderada | ${fmtPctPrompt(totals.maduracionPonderadaPct)} |
| Saldo / desembolso | ${fmtPctPrompt(totals.saldoSobreDesembolsoPct)} |

Resumen por producto:
| Producto | Agencias | Créditos / registros | Stock | Monto desembolso | Maduración ponderada | Crítico >50% | Alerta 30-50% | Saldo / desembolso |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${maduracionBandRows.value.slice(0, 12).map((r) => `| ${r.producto} | ${Number(r.agenciasCount || 0).toLocaleString('en-US')} | ${r.creditos !== null && r.creditos !== undefined ? `${Number(r.creditos || 0).toLocaleString('en-US')} créditos` : `${Number(r.registrosFuente || 0).toLocaleString('en-US')} registros fuente`} | ${fmtMoneyPrompt(r.stock)} | ${fmtMoneyPrompt(r.montoDesembolso)} | ${fmtPctPrompt(r.maduracionPct)} | ${fmtMoneyPrompt(r.criticoStock)} | ${fmtMoneyPrompt(r.alertaStock)} | ${fmtPctPrompt(r.saldoSobreDesembolsoPct)} |`).join('\n')}

Detalle:
| Sucursal | Agencia | Producto | Stock | Monto desembolso | Maduración | Nivel alerta | Saldo / desembolso |
|---|---|---|---:|---:|---:|---|---:|
${rows}
`.trim();
}

function buildLcfTable(limit = 20) {
  if (!lcf.value?.length) return 'No hay información de líneas de crédito familiar disponible.';

  const totals = lcfTotals.value;

  const rows = [...lcf.value]
      .sort((a, b) => safeNumber(b.cupoNoUtilizado) - safeNumber(a.cupoNoUtilizado))
      .slice(0, limit)
      .map((r) => {
        const saldoActivado = lcfSaldoActivadoValue(r);
        const cupoNoUtilizado = lcfCupoNoUtilizadoValue(r);
        const activacionPct = safeNumber(r.montoAutorizado) > 0 ? (saldoActivado * 100) / safeNumber(r.montoAutorizado) : null;

        return `| ${r.sucursal || 'N/D'} | ${r.nombreAgencia || r.codAgencia || 'N/D'} | ${opportunityProduct(r)} | ${fmtMoneyPrompt(r.montoAutorizado)} | ${fmtMoneyPrompt(saldoActivado)} | ${fmtMoneyPrompt(cupoNoUtilizado)} | ${fmtPctPrompt(activacionPct)} |`;
      })
      .join('\n');

  return `
Líneas de crédito familiar LCF:
Resumen:
| Métrica | Valor |
|---|---:|
| Monto autorizado | ${fmtMoneyPrompt(totals.montoAutorizado)} |
| Saldo activado | ${fmtMoneyPrompt(totals.saldoActivado)} |
| Cupo no utilizado | ${fmtMoneyPrompt(totals.cupoNoUtilizado)} |
| Activación | ${fmtPctPrompt(totals.activacionPct)} |
| Cupo no utilizado % | ${fmtPctPrompt(totals.cupoNoUtilizadoPct)} |

Resumen por producto:
| Producto | Agencias | Monto autorizado | Saldo activado | Cupo no utilizado | Activación | % no utilizado |
|---|---:|---:|---:|---:|---:|---:|
${lcfByProduct.value.slice(0, 12).map((r) => `| ${r.producto} | ${Number(r.agenciasCount || 0).toLocaleString('en-US')} | ${fmtMoneyPrompt(r.montoAutorizado)} | ${fmtMoneyPrompt(r.saldoActivado)} | ${fmtMoneyPrompt(r.cupoNoUtilizado)} | ${fmtPctPrompt(r.activacionPct)} | ${fmtPctPrompt(r.cupoNoUtilizadoPct)} |`).join('\n')}

Detalle:
| Sucursal | Agencia | Producto | Monto autorizado | Saldo activado | Cupo no utilizado | Activación |
|---|---|---|---:|---:|---:|---:|
${rows}
`.trim();
}

function buildSharedPortfolioTable(limit = 20) {
  if (!sharedPortfolio.value?.length) return 'No hay información de cartera compartida disponible.';

  const totals = sharedPortfolioTotals.value;

  const rows = [...sharedPortfolioAgencyRows.value]
      .sort((a, b) => safeNumber(b.otrosBancos) - safeNumber(a.otrosBancos))
      .slice(0, limit)
      .map((r) => `| ${r.sucursal || 'N/D'} | ${r.nombreAgencia || r.codAgencia || 'N/D'} | ${Number(r.clientesCompartidos || 0).toLocaleString('en-US')} | ${fmtMoneyPrompt(r.bnb)} | ${fmtMoneyPrompt(r.otrosBancos)} | ${fmtPctPrompt(r.participacionOtrosPct)} | ${r.prioridad || 'N/D'} |`)
      .join('\n');

  return `
Cartera compartida:
Resumen:
| Métrica | Valor |
|---|---:|
| Clientes compartidos | ${Number(totals.clientesCompartidos || 0).toLocaleString('en-US')} |
| Cartera BNB compartida | ${fmtMoneyPrompt(totals.bnb)} |
| Cartera otros bancos | ${fmtMoneyPrompt(totals.otrosBancos)} |
| Total compartido | ${fmtMoneyPrompt(totals.totalCompartido)} |
| Participación BNB | ${fmtPctPrompt(totals.participacionBNBPct)} |
| Participación otros bancos | ${fmtPctPrompt(totals.participacionOtrosPct)} |

Detalle por agencia:
| Sucursal | Agencia | Clientes | BNB | Otros bancos | Participación otros | Prioridad |
|---|---|---:|---:|---:|---:|---|
${rows}
`.trim();
}

function buildOportunidadesTable(limit = 20) {
  const rowsSource = oportunidadesByAgencia.value || [];

  if (!rowsSource.length) return 'No hay matriz integrada de oportunidades disponible.';

  const totals = oportunidadesTotals.value;

  const rows = [...rowsSource]
      .sort((a, b) => safeNumber(b.potencialTotal) - safeNumber(a.potencialTotal))
      .slice(0, limit)
      .map((r) => `| ${r.sucursal || 'N/D'} | ${r.nombreAgencia || r.codAgencia || 'N/D'} | ${fmtMoneyPrompt(r.potencialTotal)} | ${fmtMoneyPrompt(r.cupoNoUtilizadoLcf)} | ${fmtMoneyPrompt(r.carteraOtrosBancos)} | ${fmtPctPrompt(r.maduracionPct)} | ${fmtPctPrompt(r.activacionLcfPct)} | ${r.prioridad} |`)
      .join('\n');

  return `
Oportunidades comerciales integradas:
Resumen:
| Métrica | Valor |
|---|---:|
| Oportunidad total | ${fmtMoneyPrompt(totals.oportunidadTotal)} |
| LCF no utilizado | ${fmtMoneyPrompt(totals.lcfCupoNoUtilizado)} |
| Cartera otros bancos | ${fmtMoneyPrompt(totals.carteraCompartidaPotencial)} |
| Clientes compartidos | ${Number(totals.clientesCompartidos || 0).toLocaleString('en-US')} |
| Maduración ponderada | ${fmtPctPrompt(totals.maduracionPct)} |
| Activación LCF | ${fmtPctPrompt(totals.lcfActivacionPct)} |

Ranking de agencias por potencial:
| Sucursal | Agencia | Potencial total | LCF no utilizado | Otros bancos | Maduración | Activación LCF | Prioridad |
|---|---|---:|---:|---:|---:|---:|---|
${rows}
`.trim();
}

function buildAgentPrompt({
                            title,
                            objective,
                            includeMarket = false,
                            includeCompetitors = false,
                            includeOfficials = false,
                            includeTimeSeries = false,
                            includeProjection = false,
                            includePdRisk = false,
                            includeCaptaciones = false,
                            includeMaduracion = false,
                            includeLcf = false,
                            includeSharedPortfolio = false,
                            includeOportunidades = false
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
  if (includeProjection) blocks.push(buildProjectionTable());
  if (includePdRisk) blocks.push(buildPdRiskTable());
  if (includeCaptaciones) blocks.push(buildCaptacionesTable());
  if (includeMaduracion) blocks.push(buildMaduracionTable());
  if (includeLcf) blocks.push(buildLcfTable());
  if (includeSharedPortfolio) blocks.push(buildSharedPortfolioTable());
  if (includeOportunidades) blocks.push(buildOportunidadesTable());

  const projectionInstruction = includeProjection
      ? '- Puedes analizar proyecciones únicamente cuando el objetivo lo solicite y estén incluidas en los datos enviados.'
      : '- No menciones proyecciones ni escenarios proyectados.';

  blocks.push(`
Formato obligatorio de respuesta:
1. Resumen ejecutivo en máximo 5 bullets.
2. Diagnóstico comercial de la situación actual.
3. Tabla de hallazgos relevantes con impacto, causa probable y acción sugerida.
4. Análisis de productos críticos, productos líderes y productos con oportunidad.
5. Riesgos comerciales, alertas tempranas y probabilidad de mora si existe información disponible.
6. Lectura de proyección financiera si existe información disponible.
7. Lectura de captaciones, maduración, LCF y cartera compartida si existe información disponible.
8. Recomendaciones accionables para gerencia comercial.

Importante:
- Cuando menciones periodos, usa formato yyyymm.
- Si necesitas explicar el rango, indica desde qué periodo hasta qué periodo se observa la serie histórica.
${projectionInstruction}
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
    includeTimeSeries: true,
    includeProjection: true,
    includePdRisk: true,
    includeCaptaciones: true,
    includeMaduracion: true,
    includeLcf: true,
    includeSharedPortfolio: true,
    includeOportunidades: true
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
objective: \`
Compara el desempeño de BNB contra cada banco competidor del sistema financiero usando la tabla detallada por banco y producto.

El análisis debe usar estos campos:
- Banco.
- Producto.
- Stock.
- Participación sobre el producto dentro del sistema financiero.
- Crecimiento monto.
- Crecimiento %.

Identifica:
- En qué productos BNB tiene mejor posición relativa.
- En qué productos otros bancos tienen mayor stock o mayor participación.
- Qué bancos están creciendo más que BNB por producto.
- Qué bancos representan mayor presión competitiva.
- Dónde BNB tiene oportunidad de capturar cuota de mercado.
- Dónde BNB debe defender posición.

No incluyas proyecciones ni escenarios proyectados.
Cuando analices periodos, usa formato yyyymm.
\`,
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
    includeTimeSeries: true,
    includeProjection: false,
    includePdRisk: true
  });

  sendChat(finalPrompt);
}

function triggerProjectionAnalysis() {
  const finalPrompt = buildAgentPrompt({
    title: 'Análisis de proyección financiera',
    objective: `
Analiza la proyección financiera del portafolio usando desembolsos, amortización y flujo neto.

El análisis debe:
- Separar datos históricos de datos proyectados.
- Identificar meses con mayor presión de amortización.
- Identificar meses con mejor flujo neto.
- Evaluar si el escenario actual favorece el crecimiento de cartera.
- Detectar productos con mayor oportunidad o riesgo según su comportamiento proyectado.
- Recomendar acciones comerciales y de seguimiento para sostener el cumplimiento.

Cuando analices periodos, usa formato yyyymm.
`,
    includeMarket: false,
    includeCompetitors: false,
    includeOfficials: false,
    includeTimeSeries: true,
    includeProjection: true,
    includePdRisk: false
  });

  sendChat(finalPrompt);
}

function triggerPdRiskAnalysis() {
  const finalPrompt = buildAgentPrompt({
    title: 'Análisis de probabilidad de mora',
    objective: `
Analiza las operaciones con probabilidad de caer en mora el siguiente mes.

El análisis debe:
- Explicar el volumen total evaluado.
- Priorizar operaciones de alta probabilidad.
- Identificar productos, sucursales y agencias más críticas.
- Separar riesgo alto, medio y bajo.
- Recomendar acciones preventivas para seguimiento comercial, cobranza temprana o gestión de cartera.
- Indicar dónde se concentra el riesgo y qué acciones debería revisar gerencia.

Cuando analices periodos, usa formato yyyymm.
`,
    includeMarket: false,
    includeCompetitors: false,
    includeOfficials: false,
    includeTimeSeries: false,
    includeProjection: false,
    includePdRisk: true
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
    includeTimeSeries: true,
    includeProjection: false,
    includePdRisk: true,
    includeCaptaciones: true,
    includeMaduracion: true,
    includeLcf: true,
    includeSharedPortfolio: true,
    includeOportunidades: true
  });

  sendChat(finalPrompt);
}


function triggerCaptacionesAnalysis() {
  const finalPrompt = buildAgentPrompt({
    title: 'Análisis de captaciones',
    objective: `
Analiza el desempeño de captaciones frente al presupuesto, separando vista, ahorros y DPF/plazo.
Identifica agencias con mejor desempeño, brechas y alertas según la categoría de captaciones disponible.
Recomienda acciones comerciales para proteger saldos y recuperar captaciones.
`,
    includeCaptaciones: true,
    includeTimeSeries: false,
    includeProjection: false
  });

  sendChat(finalPrompt);
}

function triggerOportunidadesAnalysis() {
  const finalPrompt = buildAgentPrompt({
    title: 'Análisis integrado de oportunidades',
    objective: `
Analiza oportunidades comerciales integrando maduración de créditos, LCF no utilizado y cartera compartida.
Aplica la regla de maduración: mayor maduración es peor y debe elevar la prioridad comercial, porque el crédito se está completando/venciendo.
Prioriza agencias y productos por potencial total, activación pendiente, compra de deuda, maduración crítica y oportunidad accionable.
Propón acciones concretas para convertir oportunidad en crecimiento de cartera.
`,
    includeOportunidades: true,
    includeMaduracion: true,
    includeLcf: true,
    includeSharedPortfolio: true,
    includeMarket: true
  });

  sendChat(finalPrompt);
}

function triggerMaduracionAnalysis() {
  const finalPrompt = buildAgentPrompt({
    title: 'Análisis de maduración de créditos',
    objective: `
Analiza la maduración de créditos usando stock vigente, monto desembolsado original y maduración ponderada.
Regla obligatoria: mayor maduración es peor; una maduración alta indica que el crédito se está completando/venciendo y requiere prioridad comercial.
Identifica agencias/productos con mayor maduración como los más críticos y recomienda acciones de recompra, renovación, retención, refinanciamiento, ampliación o seguimiento.
`,
    includeMaduracion: true,
    includeOportunidades: true
  });

  sendChat(finalPrompt);
}

function triggerLcfAnalysis() {
  const finalPrompt = buildAgentPrompt({
    title: 'Análisis de líneas de crédito familiar',
    objective: `
Analiza las líneas de crédito familiar, separando monto autorizado, saldo activado y cupo no utilizado.
Prioriza agencias donde exista mayor cupo pendiente de activar y recomienda acciones para acelerar utilización.
`,
    includeLcf: true,
    includeOportunidades: true
  });

  sendChat(finalPrompt);
}

function triggerCarteraCompartidaAnalysis() {
  const finalPrompt = buildAgentPrompt({
    title: 'Análisis de cartera compartida y compra de deuda',
    objective: `
Analiza la cartera compartida entre BNB y otros bancos.
Identifica agencias, segmentos y bancos con mayor potencial de compra de deuda, presión competitiva y oportunidad de captura.
`,
    includeSharedPortfolio: true,
    includeOportunidades: true,
    includeMarket: true,
    includeCompetitors: true
  });

  sendChat(finalPrompt);
}

const captacionesPeriod = computed(() => {
  const row = (captaciones.value || []).find((item) => item.fecha);
  return row?.fecha ? toPeriodYYYYMM(row.fecha) : 'N/D';
});

const captacionesTotals = computed(() => {
  const rows = captaciones.value || [];

  const ejecutadaCaptaciones = rows.reduce((acc, row) => acc + Number(row.ejecutadaCaptaciones || 0), 0);
  const presupuestadaCaptaciones = rows.reduce((acc, row) => acc + Number(row.presupuestadaCaptaciones || 0), 0);

  const ejecutadaVista = rows.reduce((acc, row) => acc + Number(row.ejecutadaVista || 0), 0);
  const presupuestadaVista = rows.reduce((acc, row) => acc + Number(row.presupuestadaVista || 0), 0);

  const ejecutadaAhorros = rows.reduce((acc, row) => acc + Number(row.ejecutadaAhorros || 0), 0);
  const presupuestadaAhorros = rows.reduce((acc, row) => acc + Number(row.presupuestadaAhorros || 0), 0);

  const ejecutadaPlazo = rows.reduce((acc, row) => acc + Number(row.ejecutadaPlazo || 0), 0);
  const presupuestadaPlazo = rows.reduce((acc, row) => acc + Number(row.presupuestadaPlazo || 0), 0);

  const brechaCaptaciones = ejecutadaCaptaciones - presupuestadaCaptaciones;

  return {
    ejecutadaCaptaciones,
    presupuestadaCaptaciones,
    brechaCaptaciones,
    cumplimientoCaptacionesPct:
        presupuestadaCaptaciones > 0 ? (ejecutadaCaptaciones / presupuestadaCaptaciones) * 100 : null,

    ejecutadaVista,
    presupuestadaVista,
    brechaVista: ejecutadaVista - presupuestadaVista,
    cumplimientoVistaPct:
        presupuestadaVista > 0 ? (ejecutadaVista / presupuestadaVista) * 100 : null,

    ejecutadaAhorros,
    presupuestadaAhorros,
    brechaAhorros: ejecutadaAhorros - presupuestadaAhorros,
    cumplimientoAhorrosPct:
        presupuestadaAhorros > 0 ? (ejecutadaAhorros / presupuestadaAhorros) * 100 : null,

    ejecutadaPlazo,
    presupuestadaPlazo,
    brechaPlazo: ejecutadaPlazo - presupuestadaPlazo,
    cumplimientoPlazoPct:
        presupuestadaPlazo > 0 ? (ejecutadaPlazo / presupuestadaPlazo) * 100 : null
  };
});

const captacionesBySucursal = computed(() => {
  const grouped = new Map();

  (captaciones.value || []).forEach((row) => {
    const sucursal = row.sucursal || 'Sin sucursal';

    if (!grouped.has(sucursal)) {
      grouped.set(sucursal, {
        sucursal,
        ejecutadaCaptaciones: 0,
        presupuestadaCaptaciones: 0,
        ejecutadaVista: 0,
        presupuestadaVista: 0,
        ejecutadaAhorros: 0,
        presupuestadaAhorros: 0,
        ejecutadaPlazo: 0,
        presupuestadaPlazo: 0,
        categorias: new Map()
      });
    }

    const item = grouped.get(sucursal);

    item.ejecutadaCaptaciones += Number(row.ejecutadaCaptaciones || 0);
    item.presupuestadaCaptaciones += Number(row.presupuestadaCaptaciones || 0);

    item.ejecutadaVista += Number(row.ejecutadaVista || 0);
    item.presupuestadaVista += Number(row.presupuestadaVista || 0);

    item.ejecutadaAhorros += Number(row.ejecutadaAhorros || 0);
    item.presupuestadaAhorros += Number(row.presupuestadaAhorros || 0);

    item.ejecutadaPlazo += Number(row.ejecutadaPlazo || 0);
    item.presupuestadaPlazo += Number(row.presupuestadaPlazo || 0);


    const categoria = row.categoriaTendencia || 'N/D';
    item.categorias.set(categoria, (item.categorias.get(categoria) || 0) + 1);
  });

  return Array.from(grouped.values())
      .map((item) => {
        const categoriaTendencia =
            Array.from(item.categorias.entries())
                .sort((a, b) => b[1] - a[1])?.[0]?.[0] || 'N/D';

        return {
          ...item,
          categoriaTendencia,
          brechaCaptaciones: item.ejecutadaCaptaciones - item.presupuestadaCaptaciones,
          cumplimientoCaptacionesPct:
              item.presupuestadaCaptaciones > 0
                  ? (item.ejecutadaCaptaciones / item.presupuestadaCaptaciones) * 100
                  : null,
          cumplimientoVistaPct:
              item.presupuestadaVista > 0
                  ? (item.ejecutadaVista / item.presupuestadaVista) * 100
                  : null,
          cumplimientoAhorrosPct:
              item.presupuestadaAhorros > 0
                  ? (item.ejecutadaAhorros / item.presupuestadaAhorros) * 100
                  : null,
          cumplimientoPlazoPct:
              item.presupuestadaPlazo > 0
                  ? (item.ejecutadaPlazo / item.presupuestadaPlazo) * 100
                  : null
        };
      })
      .sort((a, b) => Number(b.ejecutadaCaptaciones || 0) - Number(a.ejecutadaCaptaciones || 0));
});

const captacionesFugaRows = computed(() => {
  return captacionesByAgencia.value
      .map((row) => {
        const categoriaTendencia = row.categoriaTendencia || 'N/D';
        const nivelFuga = captacionFugaLevelFromCategory(categoriaTendencia);

        return {
          ...row,
          categoriaTendencia,
          nivelFuga,
          montoRiesgo: nivelFuga === 'Sin alerta' ? 0 : Number(row.ejecutadaCaptaciones || 0)
        };
      })
      .filter((row) => row.nivelFuga !== 'Sin alerta')
      .sort((a, b) => {
        const order = { Alta: 3, Media: 2, Baja: 1, 'Sin alerta': 0 };
        const levelCompare = Number(order[b.nivelFuga] || 0) - Number(order[a.nivelFuga] || 0);

        if (levelCompare !== 0) return levelCompare;

        return Number(b.montoRiesgo || 0) - Number(a.montoRiesgo || 0);
      });
});

const captacionesFugaTotals = computed(() => {
  const rows = captacionesFugaRows.value || [];

  const alta = rows.filter((row) => row.nivelFuga === 'Alta').length;
  const media = rows.filter((row) => row.nivelFuga === 'Media').length;
  const baja = rows.filter((row) => row.nivelFuga === 'Baja').length;
  const montoRiesgo = rows.reduce((acc, row) => acc + Number(row.montoRiesgo || 0), 0);

  return {
    alta,
    media,
    baja,
    totalAgencias: rows.length,
    montoRiesgo
  };
});

const captacionesFugaChart = computed(() => ({
  labels: ['Alta', 'Media', 'Baja'],
  datasets: [
    {
      label: 'Agencias en alerta',
      data: [
        captacionesFugaTotals.value.alta,
        captacionesFugaTotals.value.media,
        captacionesFugaTotals.value.baja
      ],
      backgroundColor: ['#e05252', '#f59e0b', '#26b460'],
      borderRadius: 8
    }
  ]
}));

const captacionesByAgencia = computed(() => {
  const grouped = new Map();

  (captaciones.value || []).forEach((row) => {
    const key = `${row.sucursal || 'Sin sucursal'}|${row.codAgencia || 'N/D'}|${row.nombreAgencia || 'N/D'}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        sucursal: row.sucursal || 'Sin sucursal',
        codAgencia: row.codAgencia || 'N/D',
        nombreAgencia: row.nombreAgencia || 'N/D',
        ejecutadaCaptaciones: 0,
        presupuestadaCaptaciones: 0,
        ejecutadaVista: 0,
        presupuestadaVista: 0,
        ejecutadaAhorros: 0,
        presupuestadaAhorros: 0,
        ejecutadaPlazo: 0,
        presupuestadaPlazo: 0,
        categorias: new Map()
      });
    }

    const item = grouped.get(key);

    item.ejecutadaCaptaciones += Number(row.ejecutadaCaptaciones || 0);
    item.presupuestadaCaptaciones += Number(row.presupuestadaCaptaciones || 0);

    item.ejecutadaVista += Number(row.ejecutadaVista || 0);
    item.presupuestadaVista += Number(row.presupuestadaVista || 0);

    item.ejecutadaAhorros += Number(row.ejecutadaAhorros || 0);
    item.presupuestadaAhorros += Number(row.presupuestadaAhorros || 0);

    item.ejecutadaPlazo += Number(row.ejecutadaPlazo || 0);
    item.presupuestadaPlazo += Number(row.presupuestadaPlazo || 0);


    const categoria = row.categoriaTendencia || 'N/D';
    item.categorias.set(categoria, (item.categorias.get(categoria) || 0) + 1);
  });

  return Array.from(grouped.values())
      .map((item) => {
        const categoriaTendencia =
            Array.from(item.categorias.entries())
                .sort((a, b) => b[1] - a[1])?.[0]?.[0] || 'N/D';

        return {
          ...item,
          categoriaTendencia,
          brechaCaptaciones: item.ejecutadaCaptaciones - item.presupuestadaCaptaciones,
          cumplimientoCaptacionesPct:
              item.presupuestadaCaptaciones > 0
                  ? (item.ejecutadaCaptaciones / item.presupuestadaCaptaciones) * 100
                  : null,
          cumplimientoVistaPct:
              item.presupuestadaVista > 0
                  ? (item.ejecutadaVista / item.presupuestadaVista) * 100
                  : null,
          cumplimientoAhorrosPct:
              item.presupuestadaAhorros > 0
                  ? (item.ejecutadaAhorros / item.presupuestadaAhorros) * 100
                  : null,
          cumplimientoPlazoPct:
              item.presupuestadaPlazo > 0
                  ? (item.ejecutadaPlazo / item.presupuestadaPlazo) * 100
                  : null
        };
      })
      .sort((a, b) => Number(b.ejecutadaCaptaciones || 0) - Number(a.ejecutadaCaptaciones || 0));
});

const captacionesTrendRows = computed(() => {
  const grouped = new Map();

  (captaciones.value || []).forEach((row) => {
    const categoria = row.categoriaTendencia || 'Sin categoría';

    if (!grouped.has(categoria)) {
      grouped.set(categoria, {
        categoria,
        cantidad: 0,
        monto: 0
      });
    }

    const item = grouped.get(categoria);

    item.cantidad += 1;
    item.monto += Number(row.ejecutadaCaptaciones || 0);
  });

  return Array.from(grouped.values())
      .sort((a, b) => Number(b.monto || 0) - Number(a.monto || 0));
});

const captacionesProductoChart = computed(() => ({
  labels: ['Vista', 'Ahorros', 'Plazo'],
  datasets: [
    {
      label: 'Ejecutado',
      data: [
        captacionesTotals.value.ejecutadaVista,
        captacionesTotals.value.ejecutadaAhorros,
        captacionesTotals.value.ejecutadaPlazo
      ],
      backgroundColor: '#26b460',
      borderRadius: 8
    },
    {
      label: 'Presupuestado',
      data: [
        captacionesTotals.value.presupuestadaVista,
        captacionesTotals.value.presupuestadaAhorros,
        captacionesTotals.value.presupuestadaPlazo
      ],
      backgroundColor: '#8b5cf6',
      borderRadius: 8
    }
  ]
}));

const captacionesSucursalChart = computed(() => {
  const rows = captacionesBySucursal.value.slice(0, 10);

  return {
    labels: rows.map((item) => item.sucursal),
    datasets: [
      {
        label: 'Captación ejecutada',
        data: rows.map((item) => item.ejecutadaCaptaciones),
        backgroundColor: '#26b460',
        borderRadius: 8,
        metaRows: rows
      }
    ]
  };
});

const captacionesTrendChart = computed(() => ({
  labels: captacionesTrendRows.value.map((item) => item.categoria),
  datasets: [
    {
      data: captacionesTrendRows.value.map((item) => item.cantidad),
      backgroundColor: ['#26b460', '#f59e0b', '#e05252', '#8b5cf6', '#64748b'],
      borderColor: '#ffffff',
      borderWidth: 3,
      hoverOffset: 8
    }
  ]
}));

const captacionesBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {mode: 'index', intersect: false},
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
          const value = Number(ctx.raw || 0);
          return ` ${ctx.dataset.label}: ${moneyFullNoDecimals(value)}`;
        }
      }
    }
  },
  scales: {
    x: {
      grid: {color: 'rgba(15,31,22,.04)', drawBorder: false},
      ticks: {color: '#6f8177', font: {size: 11, weight: '600'}}
    },
    y: {
      beginAtZero: true,
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        callback: (value) => moneyFullNoDecimals(value)
      }
    }
  }
};

const captacionesHorizontalOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: {display: false},
    tooltip: {
      ...tooltipBase,
      callbacks: {
        label: (ctx) => {
          const value = Number(ctx.raw || 0);
          return ` Captación ejecutada: ${moneyFullNoDecimals(value)}`;
        },
        afterBody: (items) => {
          const first = items?.[0];

          if (!first) return [];

          const row = first.dataset.metaRows?.[first.dataIndex];

          if (!row) return [];

          const total = Number(row.ejecutadaCaptaciones || 0);

          const vista = Number(row.ejecutadaVista || 0);
          const ahorros = Number(row.ejecutadaAhorros || 0);
          const plazo = Number(row.ejecutadaPlazo || 0);

          const pct = (value) => {
            if (total <= 0) return 'N/A';
            return `${((Number(value || 0) / total) * 100).toFixed(2)}%`;
          };

          return [
            '',
            'Composición:',
            `Vista: ${moneyFullNoDecimals(vista)} · ${pct(vista)}`,
            `Ahorros: ${moneyFullNoDecimals(ahorros)} · ${pct(ahorros)}`,
            `DPF / Plazo: ${moneyFullNoDecimals(plazo)} · ${pct(plazo)}`,
            '',
            `Presupuesto total: ${moneyFullNoDecimals(row.presupuestadaCaptaciones)}`,
            `Brecha: ${signedMoneyFullNoDecimals(row.brechaCaptaciones)}`,
            `Cumplimiento: ${
                row.cumplimientoCaptacionesPct === null || row.cumplimientoCaptacionesPct === undefined
                    ? 'N/A'
                    : `${Number(row.cumplimientoCaptacionesPct).toFixed(2)}%`
            }`
          ];
        }
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        callback: (value) => moneyFullNoDecimals(value)
      }
    },
    y: {
      grid: {display: false, drawBorder: false},
      ticks: {color: '#4a6355', font: {size: 11, weight: '600'}}
    }
  }
};
const captacionesStockBudgetRows = computed(() => {
  const rows = [
    {
      key: 'VISTA',
      producto: 'Vista',
      stock: captacionesTotals.value.ejecutadaVista,
      presupuesto: captacionesTotals.value.presupuestadaVista
    },
    {
      key: 'AHORROS',
      producto: 'Ahorros',
      stock: captacionesTotals.value.ejecutadaAhorros,
      presupuesto: captacionesTotals.value.presupuestadaAhorros
    },
    {
      key: 'PLAZO',
      producto: 'DPF / Plazo',
      stock: captacionesTotals.value.ejecutadaPlazo,
      presupuesto: captacionesTotals.value.presupuestadaPlazo
    }
  ];

  const filtered =
      captacionStockBudgetFilter.value === 'TODOS'
          ? rows
          : rows.filter((row) => row.key === captacionStockBudgetFilter.value);

  return filtered.map((row) => {
    const diferencia = Number(row.stock || 0) - Number(row.presupuesto || 0);
    const cumplimientoPct =
        Number(row.presupuesto || 0) > 0
            ? (Number(row.stock || 0) / Number(row.presupuesto || 0)) * 100
            : null;

    return {
      ...row,
      diferencia,
      cumplimientoPct
    };
  });
});

const captacionesStockBudgetChart = computed(() => {
  const rows = captacionesStockBudgetRows.value;

  return {
    labels: rows.map((row) => row.producto),
    datasets: [
      {
        type: 'bar',
        label: 'Stock actual',
        data: rows.map((row) => row.stock),
        backgroundColor: '#26b460',
        borderRadius: 10,
        yAxisID: 'y',
        metaRows: rows
      },
      {
        type: 'bar',
        label: 'Presupuesto',
        data: rows.map((row) => row.presupuesto),
        backgroundColor: '#8b5cf6',
        borderRadius: 10,
        yAxisID: 'y',
        metaRows: rows
      },
      {
        type: 'line',
        label: 'Cumplimiento %',
        data: rows.map((row) => row.cumplimientoPct),
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 8,
        yAxisID: 'y1',
        metaRows: rows
      }
    ]
  };
});
const captacionesStockBudgetOptions = {
  responsive: true,
  maintainAspectRatio: false,
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
          const row = ctx.dataset.metaRows?.[ctx.dataIndex];

          if (!row) return '';

          if (ctx.dataset.label === 'Cumplimiento %') {
            return ` Cumplimiento: ${
                row.cumplimientoPct === null || row.cumplimientoPct === undefined
                    ? 'N/A'
                    : `${Number(row.cumplimientoPct).toFixed(2)}%`
            }`;
          }

          return ` ${ctx.dataset.label}: ${moneyFullNoDecimals(ctx.raw)}`;
        },
        afterBody: (items) => {
          const first = items?.[0];

          if (!first) return [];

          const row = first.dataset.metaRows?.[first.dataIndex];

          if (!row) return [];

          return [
            '',
            `Diferencia: ${signedMoneyFullNoDecimals(row.diferencia)}`,
            `Cumplimiento monto: ${moneyFullNoDecimals(row.stock)} / ${moneyFullNoDecimals(row.presupuesto)}`,
            `Cumplimiento %: ${
                row.cumplimientoPct === null || row.cumplimientoPct === undefined
                    ? 'N/A'
                    : `${Number(row.cumplimientoPct).toFixed(2)}%`
            }`
          ];
        }
      }
    }
  },
  scales: {
    x: {
      grid: {color: 'rgba(15,31,22,.04)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        font: {size: 12, weight: '600'}
      }
    },
    y: {
      beginAtZero: true,
      position: 'left',
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        callback: (value) => moneyFullNoDecimals(value)
      }
    },
    y1: {
      beginAtZero: true,
      position: 'right',
      grid: {
        drawOnChartArea: false
      },
      ticks: {
        color: '#6f8177',
        callback: (value) => `${Number(value).toFixed(0)}%`
      }
    }
  }
};

const maduracionTotals = computed(() => {
  const rows = maduracion.value || [];

  const stock = rows.reduce((acc, row) => acc + Number(row.stock || 0), 0);
  const montoDesembolso = rows.reduce((acc, row) => acc + Number(row.montoDesembolso || 0), 0);
  const amortizadoEstimado = rows.reduce((acc, row) => acc + Number(row.amortizadoEstimado || 0), 0);

  const maduracionPonderadaPct =
      stock > 0
          ? rows.reduce((acc, row) => acc + Number(row.maduracionPct || 0) * Number(row.stock || 0), 0) / stock
          : null;

  return {
    stock,
    montoDesembolso,
    amortizadoEstimado,
    maduracionPonderadaPct,
    saldoSobreDesembolsoPct:
        montoDesembolso > 0 ? (stock * 100) / montoDesembolso : null
  };
});

const lcfTotals = computed(() => {
  const rows = lcf.value || [];

  const montoAutorizado = rows.reduce((acc, row) => acc + Number(row.montoAutorizado || 0), 0);

  // Regla vigente: los campos llegan invertidos desde la consulta.
  // saldoActivado visible = cupoNoUtilizado de la fuente.
  // cupoNoUtilizado visible = saldoActivado de la fuente.
  const saldoActivado = rows.reduce((acc, row) => acc + lcfSaldoActivadoValue(row), 0);
  const cupoNoUtilizado = rows.reduce((acc, row) => acc + lcfCupoNoUtilizadoValue(row), 0);

  return {
    montoAutorizado,
    saldoActivado,
    cupoNoUtilizado,
    activacionPct:
        montoAutorizado > 0 ? (saldoActivado * 100) / montoAutorizado : null,
    cupoNoUtilizadoPct:
        montoAutorizado > 0 ? (cupoNoUtilizado * 100) / montoAutorizado : null
  };
});


const maduracionByProduct = computed(() => {
  const grouped = new Map();

  (maduracion.value || []).forEach((row) => {
    const producto = opportunityProduct(row);

    if (!grouped.has(producto)) {
      grouped.set(producto, {
        producto,
        agencias: new Set(),
        stock: 0,
        montoDesembolso: 0,
        amortizadoEstimado: 0,
        maduracionWeighted: 0
      });
    }

    const item = grouped.get(producto);
    const stock = Number(row.stock || 0);

    item.agencias.add(row.codAgencia || row.nombreAgencia || 'N/D');
    item.stock += stock;
    item.montoDesembolso += Number(row.montoDesembolso || 0);
    item.amortizadoEstimado += Number(row.amortizadoEstimado || 0);
    item.maduracionWeighted += Number(row.maduracionPct || 0) * stock;
  });

  return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        agenciasCount: item.agencias.size,
        maduracionPct: item.stock > 0 ? item.maduracionWeighted / item.stock : null,
        saldoSobreDesembolsoPct:
            item.montoDesembolso > 0 ? (item.stock * 100) / item.montoDesembolso : null
      }))
      .sort((a, b) => {
        const riskCompare = maduracionRiskOrder(b.maduracionPct) - maduracionRiskOrder(a.maduracionPct);
        if (riskCompare !== 0) return riskCompare;
        return Number(b.maduracionPct ?? -999) - Number(a.maduracionPct ?? -999);
      });
});

const lcfByProduct = computed(() => {
  const grouped = new Map();

  (lcf.value || []).forEach((row) => {
    const producto = opportunityProduct(row);

    if (!grouped.has(producto)) {
      grouped.set(producto, {
        producto,
        agencias: new Set(),
        montoAutorizado: 0,
        saldoActivado: 0,
        cupoNoUtilizado: 0
      });
    }

    const item = grouped.get(producto);

    item.agencias.add(row.codAgencia || row.nombreAgencia || 'N/D');
    item.montoAutorizado += Number(row.montoAutorizado || 0);
    item.saldoActivado += lcfSaldoActivadoValue(row);
    item.cupoNoUtilizado += lcfCupoNoUtilizadoValue(row);
  });

  return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        agenciasCount: item.agencias.size,
        activacionPct:
            item.montoAutorizado > 0 ? (item.saldoActivado * 100) / item.montoAutorizado : null,
        cupoNoUtilizadoPct:
            item.montoAutorizado > 0 ? (item.cupoNoUtilizado * 100) / item.montoAutorizado : null
      }))
      .sort((a, b) => Number(b.cupoNoUtilizado || 0) - Number(a.cupoNoUtilizado || 0));
});


const maduracionByAgency = computed(() => {
  const grouped = new Map();

  (maduracion.value || []).forEach((row) => {
    const key = `${row.sucursal || 'Sin sucursal'}|${row.codAgencia || 'N/D'}|${row.nombreAgencia || 'N/D'}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        sucursal: row.sucursal || 'Sin sucursal',
        codAgencia: row.codAgencia || 'N/D',
        nombreAgencia: row.nombreAgencia || 'N/D',
        productos: new Set(),
        stock: 0,
        montoDesembolso: 0,
        amortizadoEstimado: 0,
        maduracionWeighted: 0
      });
    }

    const item = grouped.get(key);
    const stock = Number(row.stock || 0);

    item.productos.add(opportunityProduct(row));
    item.stock += stock;
    item.montoDesembolso += Number(row.montoDesembolso || 0);
    item.amortizadoEstimado += Number(row.amortizadoEstimado || 0);
    item.maduracionWeighted += Number(row.maduracionPct || 0) * stock;
  });

  return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        productosCount: item.productos.size,
        maduracionPct: item.stock > 0 ? item.maduracionWeighted / item.stock : null,
        saldoSobreDesembolsoPct:
            item.montoDesembolso > 0 ? (item.stock * 100) / item.montoDesembolso : null
      }))
      .sort((a, b) => {
        const riskCompare = maduracionRiskOrder(b.maduracionPct) - maduracionRiskOrder(a.maduracionPct);
        if (riskCompare !== 0) return riskCompare;
        return Number(b.maduracionPct ?? -999) - Number(a.maduracionPct ?? -999);
      });
});

const lcfByAgency = computed(() => {
  const grouped = new Map();

  (lcf.value || []).forEach((row) => {
    const key = `${row.sucursal || 'Sin sucursal'}|${row.codAgencia || 'N/D'}|${row.nombreAgencia || 'N/D'}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        sucursal: row.sucursal || 'Sin sucursal',
        codAgencia: row.codAgencia || 'N/D',
        nombreAgencia: row.nombreAgencia || 'N/D',
        productos: new Set(),
        montoAutorizado: 0,
        saldoActivado: 0,
        cupoNoUtilizado: 0
      });
    }

    const item = grouped.get(key);

    item.productos.add(opportunityProduct(row));
    item.montoAutorizado += Number(row.montoAutorizado || 0);
    item.saldoActivado += lcfSaldoActivadoValue(row);
    item.cupoNoUtilizado += lcfCupoNoUtilizadoValue(row);
  });

  return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        productosCount: item.productos.size,
        activacionPct:
            item.montoAutorizado > 0 ? (item.saldoActivado * 100) / item.montoAutorizado : null,
        cupoNoUtilizadoPct:
            item.montoAutorizado > 0 ? (item.cupoNoUtilizado * 100) / item.montoAutorizado : null
      }))
      .sort((a, b) => Number(b.cupoNoUtilizado || 0) - Number(a.cupoNoUtilizado || 0));
});


const lcfDetalleRows = computed(() =>
    [...(lcf.value || [])]
        .map((row) => {
          const montoAutorizado = Number(row.montoAutorizado || 0);
          const saldoActivado = lcfSaldoActivadoValue(row);
          const cupoNoUtilizado = lcfCupoNoUtilizadoValue(row);

          return {
            ...row,
            producto: opportunityProduct(row),
            montoAutorizado,
            saldoActivado,
            cupoNoUtilizado,
            activacionPct: montoAutorizado > 0 ? (saldoActivado * 100) / montoAutorizado : null,
            cupoNoUtilizadoPct: montoAutorizado > 0 ? (cupoNoUtilizado * 100) / montoAutorizado : null
          };
        })
        .sort((a, b) => Number(b.cupoNoUtilizado || 0) - Number(a.cupoNoUtilizado || 0))
);

const maduracionProductoChart = computed(() => {
  const rows = [...maduracionByProduct.value]
      .sort((a, b) => {
        const riskCompare = maduracionRiskOrder(b.maduracionPct) - maduracionRiskOrder(a.maduracionPct);
        if (riskCompare !== 0) return riskCompare;
        return Number(b.maduracionPct ?? -999) - Number(a.maduracionPct ?? -999);
      })
      .slice(0, 10);

  return {
    labels: rows.map((row) => row.producto),
    datasets: [
      {
        type: 'bar',
        label: 'Stock vigente',
        data: rows.map((row) => row.stock),
        backgroundColor: '#26b460',
        borderRadius: 10,
        yAxisID: 'y',
        metaRows: rows
      },
      {
        type: 'bar',
        label: 'Monto desembolsado',
        data: rows.map((row) => row.montoDesembolso),
        backgroundColor: '#8b5cf6',
        borderRadius: 10,
        yAxisID: 'y',
        metaRows: rows
      },
      {
        type: 'line',
        label: 'Maduración %',
        data: rows.map((row) => row.maduracionPct),
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 8,
        yAxisID: 'y1',
        metaRows: rows
      }
    ]
  };
});

const maduracionAgenciaChart = computed(() => {
  const rows = [...maduracionByAgency.value]
      .sort((a, b) => {
        const riskCompare = maduracionRiskOrder(b.maduracionPct) - maduracionRiskOrder(a.maduracionPct);
        if (riskCompare !== 0) return riskCompare;
        return Number(b.maduracionPct ?? -999) - Number(a.maduracionPct ?? -999);
      })
      .slice(0, 10);

  return {
    labels: rows.map((row) => row.nombreAgencia),
    datasets: [
      {
        type: 'bar',
        label: 'Stock vigente',
        data: rows.map((row) => row.stock),
        backgroundColor: '#26b460',
        borderRadius: 10,
        yAxisID: 'y',
        metaRows: rows
      },
      {
        type: 'line',
        label: 'Maduración %',
        data: rows.map((row) => row.maduracionPct),
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 8,
        yAxisID: 'y1',
        metaRows: rows
      }
    ]
  };
});

const maduracionBandRows = computed(() => {
  return maduracionByProduct.value
      .map((productRow) => {
        const sourceRows = (maduracion.value || []).filter((row) => opportunityProduct(row) === productRow.producto);

        const buckets = {
          normal: { creditos: 0, registros: 0, stock: 0 },
          alerta: { creditos: 0, registros: 0, stock: 0 },
          critico: { creditos: 0, registros: 0, stock: 0 }
        };

        let hasCreditCount = false;

        sourceRows.forEach((row) => {
          const explicitCreditCount = creditCountValue(row);
          const stock = Number(row.stock || 0);
          const level = maduracionAlertLevel(row.maduracionPct);
          const bucketKey = level === 'Crítico' ? 'critico' : level === 'Alerta' ? 'alerta' : 'normal';

          buckets[bucketKey].registros += 1;
          buckets[bucketKey].stock += stock;

          if (explicitCreditCount !== null) {
            hasCreditCount = true;
            buckets[bucketKey].creditos += explicitCreditCount;
          }
        });

        const totalCreditos = buckets.normal.creditos + buckets.alerta.creditos + buckets.critico.creditos;
        const totalRegistros = buckets.normal.registros + buckets.alerta.registros + buckets.critico.registros;
        const totalStock = buckets.normal.stock + buckets.alerta.stock + buckets.critico.stock;

        return {
          ...productRow,
          hasCreditCount,
          creditos: hasCreditCount ? totalCreditos : null,
          registrosFuente: totalRegistros,
          normalCreditos: hasCreditCount ? buckets.normal.creditos : null,
          alertaCreditos: hasCreditCount ? buckets.alerta.creditos : null,
          criticoCreditos: hasCreditCount ? buckets.critico.creditos : null,
          normalRegistros: buckets.normal.registros,
          alertaRegistros: buckets.alerta.registros,
          criticoRegistros: buckets.critico.registros,
          normalPct: totalStock > 0 ? (buckets.normal.stock * 100) / totalStock : 0,
          alertaPct: totalStock > 0 ? (buckets.alerta.stock * 100) / totalStock : 0,
          criticoPct: totalStock > 0 ? (buckets.critico.stock * 100) / totalStock : 0,
          normalStock: buckets.normal.stock,
          alertaStock: buckets.alerta.stock,
          criticoStock: buckets.critico.stock
        };
      })
      .sort((a, b) => Number(b.maduracionPct ?? -999) - Number(a.maduracionPct ?? -999));
});

const maduracionBandChart = computed(() => {
  const rows = maduracionBandRows.value.slice(0, 10);

  return {
    labels: rows.map((row) => row.producto),
    datasets: [
      {
        label: 'Normal <30%',
        data: rows.map((row) => row.normalPct),
        backgroundColor: '#26b460',
        borderRadius: 8,
        metaRows: rows
      },
      {
        label: 'Alerta 30–50%',
        data: rows.map((row) => row.alertaPct),
        backgroundColor: '#f59e0b',
        borderRadius: 8,
        metaRows: rows
      },
      {
        label: 'Crítico >50%',
        data: rows.map((row) => row.criticoPct),
        backgroundColor: '#e05252',
        borderRadius: 8,
        metaRows: rows
      }
    ]
  };
});

const maduracionSemaforoRows = computed(() => {
  return maduracionBandRows.value
      .map((row) => ({
        ...row,
        montoAlerta: Number(row.alertaStock || 0) + Number(row.criticoStock || 0),
        alertaTotalPct:
            Number(row.stock || 0) > 0
                ? ((Number(row.alertaStock || 0) + Number(row.criticoStock || 0)) * 100) / Number(row.stock || 0)
                : null
      }))
      .sort((a, b) => Number(b.montoAlerta || 0) - Number(a.montoAlerta || 0))
      .slice(0, 8);
});

const maduracionSucursalProductoRows = computed(() => {
  const grouped = new Map();

  (maduracion.value || []).forEach((row) => {
    const sucursal = row.sucursal || 'Sin sucursal';
    const producto = opportunityProduct(row);
    const key = `${sucursal}|${producto}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        sucursal,
        producto,
        creditos: 0,
        hasCreditCount: false,
        registrosFuente: 0,
        stock: 0,
        montoDesembolso: 0,
        maduracionWeighted: 0
      });
    }

    const item = grouped.get(key);
    const stock = Number(row.stock || 0);
    const creditos = creditCountValue(row);

    item.registrosFuente += 1;
    if (creditos !== null) {
      item.hasCreditCount = true;
      item.creditos += creditos;
    }
    item.stock += stock;
    item.montoDesembolso += Number(row.montoDesembolso || 0);
    item.maduracionWeighted += Number(row.maduracionPct || 0) * stock;
  });

  return Array.from(grouped.values())
      .map((item) => {
        const maduracionPct = item.stock > 0 ? item.maduracionWeighted / item.stock : null;

        return {
          ...item,
          creditos: item.hasCreditCount ? item.creditos : null,
          cantidadOrden: item.hasCreditCount ? item.creditos : item.registrosFuente,
          maduracionPct,
          alerta: maduracionAlertLevel(maduracionPct)
        };
      })
      .sort((a, b) => Number(b.maduracionPct ?? -999) - Number(a.maduracionPct ?? -999));
});

const maduracionDetalleAgenciaRows = computed(() => {
  return [...(maduracion.value || [])]
      .map((row) => ({
        ...row,
        producto: opportunityProduct(row),
        maduracionPct: Number.isFinite(Number(row.maduracionPct)) ? Number(row.maduracionPct) : null,
        stock: Number(row.stock || 0),
        montoDesembolso: Number(row.montoDesembolso || 0),
        saldoSobreDesembolsoPct: Number.isFinite(Number(row.saldoSobreDesembolsoPct)) ? Number(row.saldoSobreDesembolsoPct) : null
      }))
      .sort((a, b) => Number(b.maduracionPct ?? -999) - Number(a.maduracionPct ?? -999));
});

const maduracionBandChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
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
        label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw || 0).toFixed(2)}%`,
        afterBody: (items) => {
          const first = items?.[0];
          const row = first?.dataset?.metaRows?.[first.dataIndex];

          if (!row) return [];

          return [
            '',
            `Créditos / registros: ${row.creditos !== null && row.creditos !== undefined ? `${Number(row.creditos || 0).toLocaleString('en-US')} créditos` : `${Number(row.registrosFuente || 0).toLocaleString('en-US')} registros fuente`}`,
            `Stock total: ${moneyFullNoDecimals(row.stock)}`,
            `Crítico: ${moneyFullNoDecimals(row.criticoStock)}`,
            `Alerta: ${moneyFullNoDecimals(row.alertaStock)}`,
            `Normal: ${moneyFullNoDecimals(row.normalStock)}`
          ];
        }
      }
    }
  },
  scales: {
    x: {
      stacked: true,
      grid: { color: 'rgba(15,31,22,.04)', drawBorder: false },
      ticks: {
        color: '#6f8177',
        font: { size: 11, weight: '600' },
        maxRotation: 30,
        minRotation: 0
      }
    },
    y: {
      stacked: true,
      beginAtZero: true,
      max: 100,
      grid: { color: 'rgba(15,31,22,.05)', drawBorder: false },
      ticks: {
        color: '#6f8177',
        callback: (value) => `${Number(value).toFixed(0)}%`
      }
    }
  }
};

const lcfProductoChart = computed(() => {
  const rows = lcfByProduct.value.slice(0, 10);

  return {
    labels: rows.map((row) => row.producto),
    datasets: [
      {
        type: 'bar',
        label: 'Cupo no utilizado',
        data: rows.map((row) => row.cupoNoUtilizado),
        backgroundColor: '#26b460',
        borderRadius: 10,
        yAxisID: 'y',
        metaRows: rows
      },
      {
        type: 'bar',
        label: 'Saldo activado',
        data: rows.map((row) => row.saldoActivado),
        backgroundColor: '#8b5cf6',
        borderRadius: 10,
        yAxisID: 'y',
        metaRows: rows
      },
      {
        type: 'line',
        label: 'Activación %',
        data: rows.map((row) => row.activacionPct),
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 8,
        yAxisID: 'y1',
        metaRows: rows
      }
    ]
  };
});

const lcfAgenciaChart = computed(() => {
  const rows = lcfByAgency.value.slice(0, 10);

  return {
    labels: rows.map((row) => row.nombreAgencia),
    datasets: [
      {
        type: 'bar',
        label: 'Cupo no utilizado',
        data: rows.map((row) => row.cupoNoUtilizado),
        backgroundColor: '#26b460',
        borderRadius: 10,
        yAxisID: 'y',
        metaRows: rows
      },
      {
        type: 'line',
        label: 'Activación %',
        data: rows.map((row) => row.activacionPct),
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 8,
        yAxisID: 'y1',
        metaRows: rows
      }
    ]
  };
});

const opportunityMixedChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
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
          const value = Number(ctx.raw || 0);

          if (String(ctx.dataset.label || '').includes('%')) {
            return ` ${ctx.dataset.label}: ${Number(value).toFixed(2)}%`;
          }

          return ` ${ctx.dataset.label}: ${moneyFullNoDecimals(value)}`;
        }
      }
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(15,31,22,.04)', drawBorder: false },
      ticks: {
        color: '#6f8177',
        font: { size: 11, weight: '600' },
        autoSkip: false,
        maxRotation: 30,
        minRotation: 0
      }
    },
    y: {
      beginAtZero: true,
      position: 'left',
      grid: { color: 'rgba(15,31,22,.05)', drawBorder: false },
      ticks: {
        color: '#6f8177',
        callback: (value) => moneyFullNoDecimals(value)
      }
    },
    y1: {
      beginAtZero: true,
      position: 'right',
      grid: {
        drawOnChartArea: false
      },
      ticks: {
        color: '#6f8177',
        callback: (value) => `${Number(value).toFixed(0)}%`
      }
    }
  }
};

const oportunidadesTotals = computed(() => ({
  maduracionStock: maduracionTotals.value.stock,
  maduracionPct: maduracionTotals.value.maduracionPonderadaPct,
  lcfCupoNoUtilizado: lcfTotals.value.cupoNoUtilizado,
  lcfActivacionPct: lcfTotals.value.activacionPct,
  carteraCompartidaPotencial: sharedPortfolioTotals.value.otrosBancos,
  clientesCompartidos: sharedPortfolioTotals.value.clientesCompartidos,
  oportunidadTotal:
      Number(lcfTotals.value.cupoNoUtilizado || 0) +
      Number(sharedPortfolioTotals.value.otrosBancos || 0)
}));

const oportunidadesByAgencia = computed(() => {
  const grouped = new Map();

  function ensureAgency(row) {
    const key = `${row.sucursal || 'Sin sucursal'}|${row.codAgencia || 'N/D'}|${row.nombreAgencia || 'N/D'}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        sucursal: row.sucursal || 'Sin sucursal',
        codAgencia: row.codAgencia || 'N/D',
        nombreAgencia: row.nombreAgencia || 'N/D',

        stockMaduracion: 0,
        montoDesembolsoMaduracion: 0,
        maduracionWeighted: 0,

        montoAutorizadoLcf: 0,
        saldoActivadoLcf: 0,
        cupoNoUtilizadoLcf: 0,

        clientesCompartidos: 0,
        carteraBNBCompartida: 0,
        carteraOtrosBancos: 0,
        totalCompartido: 0
      });
    }

    return grouped.get(key);
  }

  (maduracion.value || []).forEach((row) => {
    const item = ensureAgency(row);
    const stock = Number(row.stock || 0);

    item.stockMaduracion += stock;
    item.montoDesembolsoMaduracion += Number(row.montoDesembolso || 0);
    item.maduracionWeighted += Number(row.maduracionPct || 0) * stock;
  });

  (lcf.value || []).forEach((row) => {
    const item = ensureAgency(row);

    item.montoAutorizadoLcf += Number(row.montoAutorizado || 0);
    item.saldoActivadoLcf += lcfSaldoActivadoValue(row);
    item.cupoNoUtilizadoLcf += lcfCupoNoUtilizadoValue(row);
  });

  (sharedPortfolio.value || []).forEach((row) => {
    const item = ensureAgency(row);

    item.clientesCompartidos += Number(row.clientesCompartidos || 0);
    item.carteraBNBCompartida += Number(row.bnb || 0);
    item.carteraOtrosBancos += Number(row.otrosBancos || 0);
    item.totalCompartido += Number(row.totalCompartido || 0);
  });

  return Array.from(grouped.values())
      .map((item) => {
        const maduracionPct =
            item.stockMaduracion > 0
                ? item.maduracionWeighted / item.stockMaduracion
                : null;

        const activacionLcfPct =
            item.montoAutorizadoLcf > 0
                ? (item.saldoActivadoLcf * 100) / item.montoAutorizadoLcf
                : null;

        const potencialTotal =
            Number(item.cupoNoUtilizadoLcf || 0) +
            Number(item.carteraOtrosBancos || 0);

        return {
          ...item,
          maduracionPct,
          activacionLcfPct,
          potencialTotal,
          participacionOtrosPct:
              item.totalCompartido > 0 ? (item.carteraOtrosBancos * 100) / item.totalCompartido : null,
          prioridad:
              potencialTotal >= 5_000_000 || Number(maduracionPct || 0) > 50 ? 'Alta' :
                  potencialTotal >= 1_000_000 || Number(maduracionPct || 0) >= 30 ? 'Media' : 'Baja'
        };
      })
      .sort((a, b) => Number(b.potencialTotal || 0) - Number(a.potencialTotal || 0));
});

const oportunidadesResumenChart = computed(() => ({
  labels: ['LCF no utilizado', 'Cartera otros bancos'],
  datasets: [
    {
      label: 'Potencial USD',
      data: [
        lcfTotals.value.cupoNoUtilizado,
        sharedPortfolioTotals.value.otrosBancos
      ],
      backgroundColor: ['#26b460', '#8b5cf6'],
      borderRadius: 10
    }
  ]
}));

const oportunidadesResumenOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {display: false},
    tooltip: {
      ...tooltipBase,
      callbacks: {
        label: (ctx) => {
          const value = Number(ctx.raw || 0);
          return ` ${ctx.label}: ${moneyFullNoDecimals(value)}`;
        }
      }
    }
  },
  scales: {
    x: {
      grid: {display: false, drawBorder: false},
      ticks: {color: '#4a6355', font: {size: 11, weight: '600'}}
    },
    y: {
      beginAtZero: true,
      grid: {color: 'rgba(15,31,22,.05)', drawBorder: false},
      ticks: {
        color: '#6f8177',
        callback: (value) => moneyFullNoDecimals(value)
      }
    }
  }
};


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
      kpisProdRes,
      timeseriesRes,
      projectionRes,
      benchmarkRes,
      marketRes,
      sharedPortfolioRes,
      oficialesRes,
      fuentesRes,
      pdRiskRes,
      pdRiskHistoryRes,
      captacionesRes,
      captacionesHistoricoRes,
      maduracionRes,
      lcfRes
    ] = await Promise.all([
      api.health().catch(() => ({mode: 'offline'})),
      api.catalogs(),
      api.summary(params),
      api.kpisByProduct(params),
      api.timeseries(params),
      fetchMergedProjection(params),
      api.benchmark(params),
      api.marketShare(params),
      api.sharedPortfolio(params).catch(() => ({data: []})),
      api.oficiales(params),
      api.fuentes(),
      api.pdRisk(params),
      api.pdRiskHistory(params).catch(() => ({data: []})),
      api.captaciones(params).catch(() => ({data: []})),
      api.captacionesHistorico({
        sucursal: filtersApplied.value.sucursal,
        agencia: filtersApplied.value.agencia
      }).catch(() => ({data: []})),
      api.maduracion(params).catch(() => ({data: []})),
      api.lcf(params).catch(() => ({data: []}))
    ]);

    dataMode.value = health.mode || summaryRes.mode || 'mock';
    catalogs.value = {...catalogRes.data, agencias: catalogRes.data.agencias || []};

    if (!filtersApplied.value.fecha && catalogRes.data.fechas?.[0]) {
      const f = catalogRes.data.fechas[0];
      filtersApplied.value.fecha = f;
      filtersDraft.value.fecha = f;
    }

    summary.value = summaryRes.data;
    kpisProductData.value = kpisProdRes.data;
    filteredTimeSeries.value = timeseriesRes.data;
    projection.value = projectionRes.data;
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
    const finalMessage = useMcp.value
        ? buildMessageForMcp(text)
        : buildMessageForNormalChat(text);
    const response = await api.agentQuery(finalMessage, useMcp.value);
    const answer = response.data.answer;

    chat.value.push({role: 'bot', text: answer});
    addToChatMemory('bot', answer);
  } catch (error) {
    const errorText = useMcp.value
        ? 'No pude conectar con el agente MCP. Revisa AnythingLLM, Ollama y la configuración del MCP.'
        : 'No pude conectar con el chat normal. Revisa AnythingLLM y Ollama.';

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


function trendClass(value) {
  if (value === null || value === undefined) return 'trend-neutral';
  return Number(value) >= 0 ? 'trend-up' : 'trend-down';
}



function moneyKFull(value) {
  const n = Number(value || 0);

  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function signedMoneyK(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';

  return `${sign}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
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
                :class="{ active: section.children?.some(child => child.id === active) }"
                @click="section.groupOnly ? null : setActive(section.id)"
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
              <span>Resumen integrado</span>
              <h3>Captaciones, maduración, LCF y cartera compartida</h3>
            </div>
            <Tag severity="info" value="Nuevas fuentes"/>
          </div>

          <div class="summary-kpi-grid">
            <Card
                v-for="item in portadaIntegratedSummaryCards"
                :key="item.label"
                class="summary-kpi-card"
                :class="`summary-tone-${item.tone}`"
            >
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

          <div class="system-grid portada-integrated-grid">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-amber">
                    <font-awesome-icon icon="triangle-exclamation"/>
                  </div>
                  <div>
                    <strong>Alertas y oportunidades ejecutivas</strong>
                    <small>Lectura rápida para priorización comercial</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="growth-leaders-grid growth-leaders-wide">
                  <div
                      v-for="alert in portadaExecutiveAlerts"
                      :key="alert.title"
                      class="growth-leader-card"
                  >
                    <div class="growth-leader-head">
                      <div class="growth-rank">
                        <font-awesome-icon :icon="alert.icon"/>
                      </div>
                      <Tag
                          :severity="alert.tone === 'danger' ? 'danger' : alert.tone === 'warning' ? 'warning' : alert.tone === 'success' ? 'success' : 'info'"
                          :value="alert.tone === 'danger' ? 'Alerta' : alert.tone === 'warning' ? 'Seguimiento' : 'Oportunidad'"
                      />
                    </div>
                    <div class="growth-leader-body">
                      <strong>{{ alert.title }}</strong>
                      <span class="growth-bank">{{ alert.detail }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-green">
                    <font-awesome-icon icon="lightbulb"/>
                  </div>
                  <div>
                    <strong>Top agencias por oportunidad total</strong>
                    <small>LCF no utilizado + cartera en otros bancos</small>
                  </div>
                </div>
              </template>
              <template #content>
                <DataTable
                    :value="portadaOpportunityAgencyTop"
                    responsive-layout="scroll"
                    showGridlines
                >
                  <Column field="nombreAgencia" header="Agencia"/>
                  <Column field="potencialTotal" header="Potencial">
                    <template #body="{ data }">
                      <strong>{{ moneyFull(data.potencialTotal) }}</strong>
                    </template>
                  </Column>
                  <Column field="cupoNoUtilizadoLcf" header="LCF">
                    <template #body="{ data }">{{ moneyFull(data.cupoNoUtilizadoLcf) }}</template>
                  </Column>
                  <Column field="carteraOtrosBancos" header="Otros bancos">
                    <template #body="{ data }">{{ moneyFull(data.carteraOtrosBancos) }}</template>
                  </Column>
                </DataTable>
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
                <div class="chart-box">
                  <Chart type="line" :data="flowChart" :options="portadaFlowChartOptions"
                         style="width: 100%; height: 100%;"/>
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
                    <strong>Cascada de brecha por producto</strong>
                    <small>Diferencia de stock actual contra meta presupuesto</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box chart-box-product-goal">
                  <Chart
                      type="bar"
                      :data="portadaProductGoalChart"
                      :options="portadaProductGoalOptions"
                      style="width: 100%; height: 100%;"
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
                    <small>
                      Banco con mayor crecimiento total por producto · Corte SF <strong>{{
                        portadaGrowthLeadersPeriod
                      }}</strong>
                    </small>
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

                      <div class="growth-head-tags">
                        <Tag severity="info" :value="item.banco"/>
                      </div>
                    </div>

                    <div class="growth-leader-body">
                      <strong>{{ item.producto }}</strong>
                      <span class="growth-bank">
      Líder: {{ item.banco }}
    </span>
                    </div>

                    <div class="growth-leader-metrics">
                      <div>
                        <small>Crecimiento líder</small>
                        <strong :class="trendClass(item.crecimientoTotal)">
                          {{ signedMoneyK(item.crecimientoTotal) }}
                        </strong>
                      </div>

                      <div>
                        <small>Crecimiento % líder</small>
                        <strong :class="trendClass(item.crecimientoPct)">
                          {{ item.crecimientoPct > 0 ? '+' : '' }}{{ percent(item.crecimientoPct) }}
                        </strong>
                      </div>

                      <div>
                        <small>Posición BNB</small>
                        <strong>
                          {{ item.bnbPosicion ? `#${item.bnbPosicion} de ${item.totalBancos}` : 'N/D' }}
                        </strong>
                      </div>

                      <div>
                        <small>Crecimiento BNB</small>
                        <strong :class="trendClass(item.bnbCrecimientoTotal)">
                          {{ item.bnbCrecimientoTotal === null ? 'N/D' : signedMoneyK(item.bnbCrecimientoTotal) }}
                        </strong>
                      </div>

                      <div>
                        <small>Crecimiento % BNB</small>
                        <strong :class="trendClass(item.bnbCrecimientoPct)">
                          {{
                            item.bnbCrecimientoPct === null || item.bnbCrecimientoPct === undefined
                                ? 'N/D'
                                : `${item.bnbCrecimientoPct > 0 ? '+' : ''}${percent(item.bnbCrecimientoPct)}`
                          }}
                        </strong>
                      </div>

                      <div>
                        <small>Crecimiento total sistema</small>
                        <strong :class="trendClass(item.crecimientoSistemaTotal)">
                          {{ signedMoneyK(item.crecimientoSistemaTotal) }}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </section>

        <!-- ═══ GOBERNANZA ════════════════════════════════════════════════════ -->
        <section v-show="active === 'gobernanza'" class="page-grid">
          <div class="section-header">
            <div>
              <span>Dominio comercial · Gestión de cartera</span>
              <h3>Marco de gobernanza</h3>
              <small>Fuente única de verdad, métricas oficiales y protocolo de validación del agente</small>
            </div>
            <Tag severity="success" value="Gobernanza"/>
          </div>

          <Card class="formula-card">
            <template #content>
              <span>Fuente única de verdad</span>
              <strong>Cartera Activa · Hub_CarteraBNB</strong>
              <p>
                Toda la información comercial de cartera debe interpretarse desde la fuente oficial disponible en el hub.
                La granularidad operativa se controla por fecha de corte, sucursal, agencia y producto. Ningún indicador
                debe redefinirse fuera de este marco.
              </p>
            </template>
          </Card>

          <div class="governance-grid">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-green">
                    <font-awesome-icon icon="ruler-combined"/>
                  </div>
                  <div>
                    <strong>Definiciones oficiales de métricas</strong>
                    <small>Campos base usados para construir indicadores ejecutivos</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="table-list">
                  <div>
                    <strong>Stock actual</strong>
                    <span>Saldo vigente de cartera al cierre del periodo · <code>SUM(stock)</code></span>
                  </div>
                  <div>
                    <strong>Desembolsos</strong>
                    <span>Producción comercial desembolsada en el periodo · <code>SUM(Desembolso)</code></span>
                  </div>
                  <div>
                    <strong>Amortización</strong>
                    <span>Recuperación o reducción de cartera registrada en el periodo · <code>SUM(amortizacion)</code></span>
                  </div>
                  <div>
                    <strong>Pendiente</strong>
                    <span>Pipeline aprobado o pendiente de desembolso · <code>SUM(pendiente)</code></span>
                  </div>
                  <div>
                    <strong>Presupuesto</strong>
                    <span>Meta comercial de stock o ejecución según corte · <code>SUM(presupuesto)</code></span>
                  </div>
                </div>
              </template>
            </Card>

            <div style="display:flex;flex-direction:column;gap:16px;">
              <Card class="elevated-card">
                <template #title>
                  <div class="card-title-rich">
                    <div class="card-title-icon bg-purple">
                      <font-awesome-icon icon="calculator"/>
                    </div>
                    <div>
                      <strong>Indicadores derivados</strong>
                      <small>Reglas obligatorias para reportes y respuestas del agente</small>
                    </div>
                  </div>
                </template>
                <template #content>
                  <ul class="rules-list">
                    <li>Crecimiento nominal = <code>StockActual - StockBase Dic-25</code>.</li>
                    <li>Crecimiento porcentual = <code>((StockActual / StockBase) - 1) * 100</code>.</li>
                    <li>Cumplimiento presupuesto = <code>StockActual / Presupuesto * 100</code>.</li>
                    <li>Brecha presupuesto = <code>StockActual - Presupuesto</code>.</li>
                    <li>Participación BNB en sistema financiero incluye BNB dentro del denominador total.</li>
                  </ul>
                </template>
              </Card>

              <Card class="elevated-card">
                <template #title>
                  <div class="card-title-rich">
                    <div class="card-title-icon bg-blue">
                      <font-awesome-icon icon="users-gear"/>
                    </div>
                    <div>
                      <strong>Roles y responsabilidades</strong>
                      <small>Modelo mínimo de gobierno del dato comercial</small>
                    </div>
                  </div>
                </template>
                <template #content>
                  <DataTable
                      :value="[
                        { rol: 'Data Owner', funcion: 'Define métricas, reglas de negocio y criterios de lectura comercial.' },
                        { rol: 'Data Steward', funcion: 'Controla calidad, consistencia, catálogos y cierres disponibles.' },
                        { rol: 'BI Analyst', funcion: 'Construye análisis y visuales bajo el marco aprobado.' },
                        { rol: 'Usuario final', funcion: 'Consume información validada y solicita aclaraciones cuando el dato no sea suficiente.' }
                      ]"
                      responsive-layout="scroll"
                      showGridlines
                  >
                    <Column field="rol" header="Rol">
                      <template #body="{ data }">
                        <Tag
                            :severity="data.rol === 'Data Owner' ? 'info' : data.rol === 'Data Steward' ? 'success' : data.rol === 'BI Analyst' ? 'warning' : 'secondary'"
                            :value="data.rol"
                        />
                      </template>
                    </Column>
                    <Column field="funcion" header="Función"/>
                  </DataTable>
                </template>
              </Card>
            </div>
          </div>

          <Card class="formula-card">
            <template #content>
              <span>Relación financiera del modelo</span>
              <strong>Stock(t) ≈ Stock(t-1) + Desembolsos(t) - Amortizaciones(t)</strong>
              <p>
                La relación es aproximada. Pueden existir ajustes contables, castigos, reclasificaciones,
                compras o ventas de cartera que expliquen diferencias entre saldos y flujos.
              </p>
            </template>
          </Card>

          <div class="section-header" style="margin-top:8px;">
            <div>
              <span>Self-correction</span>
              <h3>Protocolo de validación de resultados</h3>
              <small>El agente debe validar coherencia financiera, catálogos y fechas antes de responder</small>
            </div>
            <Tag severity="warning" value="Sección 7"/>
          </div>

          <div class="governance-grid">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-red">
                    <font-awesome-icon icon="chart-pie"/>
                  </div>
                  <div>
                    <strong>7.1 Coherencia financiera</strong>
                    <small>Validaciones antes de interpretar saldos y crecimiento</small>
                  </div>
                </div>
              </template>
              <template #content>
                <ul class="rules-list">
                  <li>Si <code>SUM(stock) &lt; 0</code>, reportar inconsistencia y no presentar el saldo como válido.</li>
                  <li>Si el crecimiento mensual supera 100%, añadir nota por posible base baja o carga masiva.</li>
                  <li>Si <code>StockBase</code> es cero o nulo, devolver <strong>N/A</strong> en crecimiento porcentual.</li>
                </ul>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-amber">
                    <font-awesome-icon icon="rotate"/>
                  </div>
                  <div>
                    <strong>7.2 Validación de flujos</strong>
                    <small>Check de continuidad entre stock, desembolsos y amortización</small>
                  </div>
                </div>
              </template>
              <template #content>
                <ul class="rules-list">
                  <li>Validar que <code>Stock(t) ≈ Stock(t-1) + Desembolso - Amortización</code>.</li>
                  <li>Si la diferencia supera 20%, advertir que pueden existir ajustes contables no detallados.</li>
                  <li>No atribuir automáticamente la diferencia a desempeño comercial sin evidencia.</li>
                </ul>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-blue">
                    <font-awesome-icon icon="folder-tree"/>
                  </div>
                  <div>
                    <strong>7.3 Coincidencia de catálogos</strong>
                    <small>Tratamiento de filtros vacíos y nombres ambiguos</small>
                  </div>
                </div>
              </template>
              <template #content>
                <ul class="rules-list">
                  <li>Si una consulta no retorna filas, revisar catálogo antes de concluir que no hay datos.</li>
                  <li>Si un nombre existe como sucursal y agencia, aplicar sucursal por defecto e informarlo.</li>
                  <li>Para productos homologados, usar las reglas de segmentación disponibles en el hub.</li>
                </ul>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-green">
                    <font-awesome-icon icon="calendar-check"/>
                  </div>
                  <div>
                    <strong>7.4 Integridad de fecha</strong>
                    <small>Uso obligatorio de cierres contables disponibles</small>
                  </div>
                </div>
              </template>
              <template #content>
                <ul class="rules-list">
                  <li>Cuando el usuario pida una fecha intermedia, responder con el cierre mensual más cercano disponible.</li>
                  <li>Mostrar periodos en formato <code>yyyymm</code> para análisis ejecutivo.</li>
                  <li>No inventar cortes futuros ni interpolar valores no presentes en la fuente.</li>
                </ul>
              </template>
            </Card>
          </div>

          <Card class="formula-card">
            <template #content>
              <span>Flujo de auto-corrección del agente</span>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;">
                <Tag severity="info" value="1. Recibir consulta"/>
                <font-awesome-icon icon="arrow-right"/>
                <Tag severity="danger" value="2. Validar saldos y flujos"/>
                <font-awesome-icon icon="arrow-right"/>
                <Tag severity="warning" value="3. Verificar catálogos"/>
                <font-awesome-icon icon="arrow-right"/>
                <Tag severity="info" value="4. Corregir fechas"/>
                <font-awesome-icon icon="arrow-right"/>
                <Tag severity="success" value="5. Entregar respuesta"/>
              </div>
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
                      <img :src="ronyImg" alt="Rony" class="org-avatar-img"/>
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
                        <img :src=member.img alt="Rony" class="org-avatar-img"/>
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
        <!-- ═══ OPORTUNIDADES ═══════════════════════════════════════════════════════ -->
        <section v-show="active === 'op-resumen'" class="page-grid">
          <div class="section-header">
            <div>
              <span>Oportunidades comerciales</span>
              <h3>Resumen integrado de oportunidades</h3>
              <small>Maduración de créditos, LCF y cartera compartida</small>
            </div>
            <Tag severity="success" value="Oportunidades"/>
          </div>

          <div class="projection-summary-grid">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Oportunidad total</span>
                  <strong class="projection-summary-value">
                    {{ moneyFull(oportunidadesTotals.oportunidadTotal) }}
                  </strong>
                  <small class="projection-summary-helper">LCF no utilizado + cartera otros bancos</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Cupo LCF no utilizado</span>
                  <strong class="projection-summary-value">
                    {{ moneyFull(lcfTotals.cupoNoUtilizado) }}
                  </strong>
                  <small class="projection-summary-helper">
                    {{ percent(lcfTotals.cupoNoUtilizadoPct) }} del monto autorizado
                  </small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Cartera en otros bancos</span>
                  <strong class="projection-summary-value">
                    {{ moneyFull(sharedPortfolioTotals.otrosBancos) }}
                  </strong>
                  <small class="projection-summary-helper">
                    {{ percent(sharedPortfolioTotals.participacionOtrosPct) }} del total compartido
                  </small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Maduración ponderada</span>
                  <strong class="projection-summary-value">
                    {{ percent(maduracionTotals.maduracionPonderadaPct) }}
                  </strong>
                  <small class="projection-summary-helper">Mayor % = mayor alerta · ponderada por stock vigente</small>
                </div>
              </template>
            </Card>
          </div>

          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-purple">
                  <font-awesome-icon icon="chart-simple"/>
                </div>
                <div>
                  <strong>Composición de oportunidad</strong>
                  <small>Potencial accionable por fuente</small>
                </div>
              </div>
            </template>

            <template #content>
              <div class="chart-box" style="height: 400px;">
                <Chart
                    type="bar"
                    :data="oportunidadesResumenChart"
                    :options="oportunidadesResumenOptions"
                    style="width: 100%; height: 100%;"
                />
              </div>
            </template>
          </Card>

          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-amber">
                  <font-awesome-icon icon="table-cells"/>
                </div>
                <div>
                  <strong>Matriz de oportunidades por agencia</strong>
                  <small>Combina maduración, LCF no utilizado y cartera compartida</small>
                </div>
              </div>
            </template>

            <template #content>
              <DataTable
                  :value="oportunidadesByAgencia"
                  responsive-layout="scroll"
                  showGridlines
                  sortField="potencialTotal"
                  :sortOrder="-1"
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
              >
                <Column field="nombreAgencia" header="Agencia"/>

                <Column field="potencialTotal" header="Potencial total">
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.potencialTotal) }}</strong>
                  </template>
                </Column>

                <Column field="cupoNoUtilizadoLcf" header="LCF no utilizado">
                  <template #body="{ data }">
                    {{ moneyFull(data.cupoNoUtilizadoLcf) }}
                  </template>
                </Column>

                <Column field="carteraOtrosBancos" header="Otros bancos">
                  <template #body="{ data }">
                    {{ moneyFull(data.carteraOtrosBancos) }}
                  </template>
                </Column>

                <Column field="maduracionPct" header="Maduración" sortable>
                  <template #body="{ data }">
                    <Tag
                        :severity="maduracionAlertSeverity(data.maduracionPct)"
                        :value="percent(data.maduracionPct)"
                    />
                  </template>
                </Column>

                <Column field="activacionLcfPct" header="Activación LCF">
                  <template #body="{ data }">
                    <Tag
                        :severity="Number(data.activacionLcfPct || 0) >= 70 ? 'success' : Number(data.activacionLcfPct || 0) >= 40 ? 'warning' : 'danger'"
                        :value="percent(data.activacionLcfPct)"
                    />
                  </template>
                </Column>

                <Column field="prioridad" header="Prioridad">
                  <template #body="{ data }">
                    <Tag
                        :severity="data.prioridad === 'Alta' ? 'danger' : data.prioridad === 'Media' ? 'warning' : 'success'"
                        :value="data.prioridad"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </section>
        <section v-show="active === 'op-maduracion'" class="page-grid">
          <div class="section-header">
            <div>
              <span>Oportunidades · Maduración</span>
              <h3>Maduración de cartera por producto</h3>
              <small>Alertas de refinanciamiento · mayor maduración implica mayor prioridad</small>
            </div>
            <Tag severity="warning" value="Oportunidades"/>
          </div>

          <div style="display:flex;align-items:center;gap:12px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:16px;padding:13px 18px;">
            <div style="width:38px;height:38px;border-radius:12px;background:#FEF3C7;color:#92600A;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <font-awesome-icon icon="bolt"/>
            </div>
            <div>
              <strong style="color:#92600A;font-size:13px;">Alerta de refinanciamiento activa</strong>
              <span style="font-size:12.5px;color:#92600A;">
                — Créditos con mayor porcentaje de maduración representan peor condición comercial y mayor prioridad para retención, refinanciamiento y ampliación de cartera.
              </span>
            </div>
          </div>

          <div class="projection-summary-grid projection-summary-grid-six">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Stock vigente</span>
                  <strong class="projection-summary-value">{{ moneyFull(maduracionTotals.stock) }}</strong>
                  <small class="projection-summary-helper">Saldo actual expuesto a maduración</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Monto desembolsado original</span>
                  <strong class="projection-summary-value">{{ moneyFull(maduracionTotals.montoDesembolso) }}</strong>
                  <small class="projection-summary-helper">Monto al desembolso inicial</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Maduración ponderada</span>
                  <strong class="projection-summary-value">{{ percent(maduracionTotals.maduracionPonderadaPct) }}</strong>
                  <small class="projection-summary-helper">Ponderada por stock vigente</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Créditos críticos</span>
                  <strong class="projection-summary-value">
                    {{ maduracionBandRows.reduce((acc, row) => acc + Number((row.criticoCreditos ?? row.criticoRegistros) || 0), 0).toLocaleString('en-US') }}
                  </strong>
                  <small class="projection-summary-helper">Créditos si existe conteo; si no, registros &lt;60%</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Monto crítico</span>
                  <strong class="projection-summary-value">
                    {{ moneyFull(maduracionBandRows.reduce((acc, row) => acc + Number(row.criticoStock || 0), 0)) }}
                  </strong>
                  <small class="projection-summary-helper">Stock con maduración crítica</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Productos en alerta</span>
                  <strong class="projection-summary-value">
                    {{ maduracionSemaforoRows.filter((row) => Number(row.montoAlerta || 0) > 0).length }}
                  </strong>
                  <small class="projection-summary-helper">Con tramo alerta o crítico</small>
                </div>
              </template>
            </Card>
          </div>

          <div class="capt-chart-grid capt-chart-grid-balanced">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-green">
                    <font-awesome-icon icon="chart-simple"/>
                  </div>
                  <div>
                    <strong>Distribución de maduración por producto</strong>
                    <small>% de créditos por tramo de maduración</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="maduracionBandChart"
                      :options="maduracionBandChartOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-amber">
                    <font-awesome-icon icon="traffic-light"/>
                  </div>
                  <div>
                    <strong>Semáforo de maduración</strong>
                    <small>Monto en cartera por nivel de alerta y producto</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div style="display:flex;flex-direction:column;gap:10px;">
                  <div
                      v-for="row in maduracionSemaforoRows"
                      :key="row.producto"
                      style="border:1px solid rgba(15,31,22,.08);border-radius:14px;padding:12px;background:#fff;"
                  >
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                      <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                        <font-awesome-icon
                            :icon="Number(row.criticoStock || 0) > 0 ? 'circle-exclamation' : Number(row.alertaStock || 0) > 0 ? 'triangle-exclamation' : 'circle-check'"
                            :class="Number(row.criticoStock || 0) > 0 ? 'text-danger' : Number(row.alertaStock || 0) > 0 ? 'text-warning' : 'text-green'"
                        />
                        <strong style="font-size:13px;color:#26382d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ row.producto }}</strong>
                      </div>
                      <Tag
                          :severity="Number(row.criticoStock || 0) > 0 ? 'danger' : Number(row.alertaStock || 0) > 0 ? 'warning' : 'success'"
                          :value="Number(row.criticoStock || 0) > 0 ? 'Crítico' : Number(row.alertaStock || 0) > 0 ? 'Alerta' : 'Normal'"
                      />
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px;">
                      <div style="background:#FDEAEA;border-radius:10px;padding:8px;">
                        <span style="color:#C0392B;font-weight:700;display:block;">Crítico >50%</span>
                        <strong>{{ moneyFull(row.criticoStock) }}</strong>
                      </div>
                      <div style="background:#FEF3C7;border-radius:10px;padding:8px;">
                        <span style="color:#92600A;font-weight:700;display:block;">Alerta 30–50%</span>
                        <strong>{{ moneyFull(row.alertaStock) }}</strong>
                      </div>
                      <div style="background:#E8F7EE;border-radius:10px;padding:8px;">
                        <span style="color:#1a8a49;font-weight:700;display:block;">Normal <30%</span>
                        <strong>{{ moneyFull(row.normalStock) }}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </Card>
          </div>

          <div class="capt-chart-grid capt-chart-grid-balanced">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-purple">
                    <font-awesome-icon icon="chart-line"/>
                  </div>
                  <div>
                    <strong>Maduración por producto</strong>
                    <small>Stock, desembolso original y maduración ponderada</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="maduracionProductoChart"
                      :options="opportunityMixedChartOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-blue">
                    <font-awesome-icon icon="building-columns"/>
                  </div>
                  <div>
                    <strong>Maduración por agencia</strong>
                    <small>Top agencias por stock vigente y maduración</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="maduracionAgenciaChart"
                      :options="opportunityMixedChartOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>
          </div>

          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-red">
                  <font-awesome-icon icon="table-cells"/>
                </div>
                <div>
                  <strong>Detalle por sucursal y producto</strong>
                  <small>Semáforo de refinanciamiento por tramo de maduración</small>
                </div>
              </div>
            </template>
            <template #content>
              <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;background:#FDEAEA;color:#C0392B;padding:2px 9px;border-radius:4px;font-weight:600">Crítico >50%</span>
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;background:#FEF3C7;color:#92600A;padding:2px 9px;border-radius:4px;font-weight:600">Alerta 30–50%</span>
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;background:#E8F7EE;color:#1a8a49;padding:2px 9px;border-radius:4px;font-weight:600">Normal <30%</span>
              </div>

              <DataTable
                  :value="maduracionSucursalProductoRows"
                  responsive-layout="scroll"
                  showGridlines
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
                  v-model:sortField="maduracionSucursalProductoSortField"
                  v-model:sortOrder="maduracionSucursalProductoSortOrder"
              >
                <Column field="sucursal" header="Sucursal" sortable/>
                <Column field="producto" header="Producto" sortable/>
                <Column field="maduracionPct" header="% Maduración prom." sortable>
                  <template #body="{ data }">
                    <Tag
                        :severity="maduracionAlertSeverity(data.maduracionPct)"
                        :value="percent(data.maduracionPct)"
                    />
                  </template>
                </Column>
                <Column field="stock" header="Monto USD" sortable>
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.stock) }}</strong>
                  </template>
                </Column>
                <Column field="alerta" header="Alerta" sortable>
                  <template #body="{ data }">
                    <Tag
                        :severity="maduracionAlertSeverity(data.maduracionPct)"
                        :value="data.alerta"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>

          <Card class="elevated-card">
            <template #title>Detalle por agencia</template>
            <template #content>
              <DataTable
                  :value="maduracionDetalleAgenciaRows"
                  responsive-layout="scroll"
                  showGridlines
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
                  v-model:sortField="maduracionDetalleSortField"
                  v-model:sortOrder="maduracionDetalleSortOrder"
              >
                <Column field="nombreAgencia" header="Agencia" sortable/>
                <Column field="producto" header="Producto" sortable>
                  <template #body="{ data }">
                    {{ data.producto }}
                  </template>
                </Column>

                <Column field="stock" header="Stock" sortable>
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.stock) }}</strong>
                  </template>
                </Column>

                <Column field="montoDesembolso" header="Monto desembolso" sortable>
                  <template #body="{ data }">
                    {{ moneyFull(data.montoDesembolso) }}
                  </template>
                </Column>

                <Column field="maduracionPct" header="Maduración" sortable>
                  <template #body="{ data }">
                    <Tag
                        :severity="maduracionAlertSeverity(data.maduracionPct)"
                        :value="percent(data.maduracionPct)"
                    />
                  </template>
                </Column>

                <Column field="saldoSobreDesembolsoPct" header="Saldo / desembolso" sortable>
                  <template #body="{ data }">
                    {{ percent(data.saldoSobreDesembolsoPct) }}
                  </template>
                </Column>
                <Column field="alerta" header="Alerta" sortable>
                  <template #body="{ data }">
                    <Tag
                        :severity="maduracionAlertSeverity(data.maduracionPct)"
                        :value="data.alerta"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </section>
        <section v-show="active === 'op-lcf'" class="page-grid">
          <div class="section-header">
            <div>
              <span>Oportunidades · LCF</span>
              <h3>Líneas de crédito familiar</h3>
              <small>Monto autorizado vs saldo activado</small>
            </div>
            <Tag severity="info" value="Hub_LCF"/>
          </div>

          <div class="projection-summary-grid">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Monto autorizado</span>
                  <strong class="projection-summary-value">{{ moneyFull(lcfTotals.montoAutorizado) }}</strong>
                  <small class="projection-summary-helper">Monto desembolsado/aprobado</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Saldo activado</span>
                  <strong class="projection-summary-value">{{ moneyFull(lcfTotals.saldoActivado) }}</strong>
                  <small class="projection-summary-helper">{{ percent(lcfTotals.activacionPct) }} de activación</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Cupo no utilizado</span>
                  <strong class="projection-summary-value">{{ moneyFull(lcfTotals.cupoNoUtilizado) }}</strong>
                  <small class="projection-summary-helper">{{ percent(lcfTotals.cupoNoUtilizadoPct) }} pendiente de activar</small>
                </div>
              </template>
            </Card>
          </div>

          <div class="capt-chart-grid capt-chart-grid-balanced">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-green">
                    <font-awesome-icon icon="chart-simple"/>
                  </div>
                  <div>
                    <strong>LCF por producto</strong>
                    <small>Cupo no utilizado, saldo activado y activación</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="lcfProductoChart"
                      :options="opportunityMixedChartOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-blue">
                    <font-awesome-icon icon="building-columns"/>
                  </div>
                  <div>
                    <strong>LCF por agencia</strong>
                    <small>Top agencias por cupo no utilizado y activación</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="lcfAgenciaChart"
                      :options="opportunityMixedChartOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>
          </div>

          <Card class="elevated-card">
            <template #title>Resumen por producto</template>
            <template #content>
              <DataTable
                  :value="lcfByProduct"
                  responsive-layout="scroll"
                  showGridlines
                  sortField="cupoNoUtilizado"
                  :sortOrder="-1"
              >
                <Column field="producto" header="Producto">
                  <template #body="{ data }">
                    <strong>{{ data.producto }}</strong>
                  </template>
                </Column>

                <Column field="agenciasCount" header="Agencias">
                  <template #body="{ data }">
                    {{ Number(data.agenciasCount || 0).toLocaleString('en-US') }}
                  </template>
                </Column>

                <Column field="montoAutorizado" header="Monto autorizado">
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.montoAutorizado) }}</strong>
                  </template>
                </Column>

                <Column field="saldoActivado" header="Saldo activado">
                  <template #body="{ data }">
                    {{ moneyFull(data.saldoActivado) }}
                  </template>
                </Column>

                <Column field="cupoNoUtilizado" header="Cupo no utilizado">
                  <template #body="{ data }">
                    <strong class="text-green">{{ moneyFull(data.cupoNoUtilizado) }}</strong>
                  </template>
                </Column>

                <Column field="activacionPct" header="% activación">
                  <template #body="{ data }">
                    <Tag
                        :severity="Number(data.activacionPct || 0) >= 70 ? 'success' : Number(data.activacionPct || 0) >= 40 ? 'warning' : 'danger'"
                        :value="percent(data.activacionPct)"
                    />
                  </template>
                </Column>

                <Column field="cupoNoUtilizadoPct" header="% no utilizado">
                  <template #body="{ data }">
                    {{ percent(data.cupoNoUtilizadoPct) }}
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>

          <Card class="elevated-card">
            <template #title>Detalle LCF por agencia</template>
            <template #content>
              <DataTable
                  :value="lcfDetalleRows"
                  responsive-layout="scroll"
                  showGridlines
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
                  sortField="cupoNoUtilizado"
                  :sortOrder="-1"
              >
                <Column field="nombreAgencia" header="Agencia"/>
                <Column header="Producto">
                  <template #body="{ data }">
                    {{ opportunityProduct(data) }}
                  </template>
                </Column>

                <Column field="montoAutorizado" header="Monto autorizado">
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.montoAutorizado) }}</strong>
                  </template>
                </Column>

                <Column field="saldoActivado" header="Saldo activado">
                  <template #body="{ data }">
                    {{ moneyFull(data.saldoActivado) }}
                  </template>
                </Column>

                <Column field="cupoNoUtilizado" header="Cupo no utilizado">
                  <template #body="{ data }">
                    <strong class="text-green">{{ moneyFull(data.cupoNoUtilizado) }}</strong>
                  </template>
                </Column>

                <Column field="activacionPct" header="% activación">
                  <template #body="{ data }">
                    <Tag
                        :severity="Number(data.activacionPct || 0) >= 70 ? 'success' : Number(data.activacionPct || 0) >= 40 ? 'warning' : 'danger'"
                        :value="percent(data.activacionPct)"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </section>
        <!-- ═══ KPIs ══════════════════════════════════════════════════════════ -->
        <section v-show="active === 'desempeno'" class="page-grid">
          <div class="section-header">
            <div>
              <span>Cartera · Desempeño comercial</span>
              <h3>Lectura ejecutiva del portafolio</h3>
            </div>
            <Tag severity="info" :value="dateIso(summary?.fechaCorte) || 'N/D'"/>
          </div>

          <div class="performance-hero">
            <Card class="performance-main-card" style="margin-bottom: 10px">
              <template #content>
                <div class="performance-main-top">
                  <div>
                    <span class="section-kicker">Resultado del portafolio</span>

                    <h2
                        class="performance-main-amount"
                        :class="Number(summary?.brechaPresupuesto || 0) >= 0 ? 'amount-positive' : 'amount-negative'"
                    >
                      {{ signedMoneyFull(summary?.brechaPresupuesto) }}
                    </h2>

                    <p>Brecha de stock actual contra presupuesto vigente.</p>

                    <div class="performance-main-metrics">
                      <div>
                        <span>Cumplimiento</span>
                        <strong :class="Number(summary?.cumplimientoPct || 0) >= 100 ? 'text-green' : 'text-danger'">
                          {{ percent(summary?.cumplimientoPct) }}
                        </strong>
                      </div>

                      <div>
                        <span>Crecimiento a diciembre</span>
                        <strong :class="trendClass(summary?.crecimientoNominal)">
                          {{ signedMoneyFull(summary?.crecimientoNominal) }}
                        </strong>
                        <small>
                          {{ summary?.crecimientoPct > 0 ? '+' : '' }}{{ percent(summary?.crecimientoPct) }}
                          contra base Dic-25
                        </small>
                      </div>
                    </div>
                  </div>

                  <div
                      class="performance-score"
                      :class="Number(summary?.cumplimientoPct || 0) >= 100 ? 'is-good' : 'is-risk'"
                  >
                    <font-awesome-icon
                        :icon="Number(summary?.cumplimientoPct || 0) >= 100 ? 'circle-check' : 'triangle-exclamation'"
                    />
                    <strong>{{ Number(summary?.cumplimientoPct || 0) >= 100 ? 'Meta alcanzada' : 'Bajo meta' }}</strong>
                  </div>
                </div>

                <div class="performance-progress">
                  <div class="performance-progress-track">
                    <div
                        class="performance-progress-fill"
                        :class="Number(summary?.cumplimientoPct || 0) >= 100 ? 'fill-good' : 'fill-risk'"
                        :style="{ width: Math.min(Math.max(Number(summary?.cumplimientoPct || 0), 0), 120) / 120 * 100 + '%' }"
                    ></div>
                    <span class="performance-progress-marker"></span>
                  </div>
                  <div class="performance-progress-labels">
                    <span>0%</span>
                    <strong>100% meta</strong>
                    <span>120%</span>
                  </div>
                </div>
              </template>
            </Card>

            <div class="performance-side-grid">
              <Card class="performance-mini-card">
                <template #content>
                  <div class="metric-card-stack">
                    <span class="metric-card-label">Stock actual</span>
                    <strong class="metric-card-value">{{ moneyFull(summary?.stockActual) }}</strong>
                    <small class="metric-card-helper">Cartera vigente al corte</small>
                  </div>
                </template>
              </Card>

              <Card class="performance-mini-card">
                <template #content>
                  <div class="metric-card-stack">
                    <span class="metric-card-label">Presupuesto</span>
                    <strong class="metric-card-value">{{ moneyFull(summary?.presupuesto) }}</strong>
                    <small class="metric-card-helper">Meta vigente de stock</small>
                  </div>
                </template>
              </Card>
            </div>
          </div>
          <div class="performance-diagnosis-grid">
            <Card class="diagnosis-card">
              <template #content>
                <div class="diagnosis-icon bg-green">
                  <font-awesome-icon icon="sack-dollar"/>
                </div>
                <div>
                  <span>Desembolsos acumulados</span>
                  <strong>{{ moneyFull(summary?.desembolsosAcum) }}</strong>
                  <small>Ritmo comercial acumulado del año</small>
                </div>
              </template>
            </Card>

            <Card class="diagnosis-card">
              <template #content>
                <div class="diagnosis-icon bg-amber">
                  <font-awesome-icon icon="rotate"/>
                </div>
                <div>
                  <span>Amortización acumulada</span>
                  <strong>{{ moneyFull(summary?.amortizacion) }}</strong>
                  <small>Salida acumulada de cartera</small>
                </div>
              </template>
            </Card>

            <Card class="diagnosis-card">
              <template #content>
                <div class="diagnosis-icon bg-purple">
                  <font-awesome-icon icon="chart-line"/>
                </div>
                <div>
                  <span>Crecimiento nominal</span>
                  <strong :class="trendClass(summary?.crecimientoNominal)">
                    {{ signedMoneyFull(summary?.crecimientoNominal) }}
                  </strong>
                  <small>Variación contra base Dic-25</small>
                </div>
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
                <Column field="producto" header="Producto" footer="">
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

                <Column field="crecimientoPct" header="%Crec. vs Dic">
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

                <Column field="crecimientoMonto" header="Crec. vs Dic">
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
                <Column field="diferenciaPresupuesto" header="Brecha">
                  <template #body="{ data }">
                    <strong
                        :class="Number(data.stock || 0) - Number(data.presupuesto || 0) >= 0 ? 'text-green' : 'text-danger'">
                      {{ signedMoneyFull(Number(data.stock || 0) - Number(data.presupuesto || 0)) }}
                    </strong>
                  </template>

                  <template #footer>
                    <strong
                        :class="Number(productTotals.stock || 0) - Number(productTotals.presupuesto || 0) >= 0 ? 'text-green' : 'text-danger'">
                      {{ signedMoneyFull(Number(productTotals.stock || 0) - Number(productTotals.presupuesto || 0)) }}
                    </strong>
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

        <!-- ═══ RIESGO PREDICTIVO ═══════════════════════════════════════════════ -->
        <section v-show="active === 'riesgo-pd'" class="page-grid">
          <div class="section-header">
            <div>
              <span>Cartera · Riesgo predictivo</span>
              <h3>Alertas tempranas de probabilidad de mora</h3>
            </div>
            <Tag severity="danger" :value="dateIso(pdRisk?.[0]?.fecha) || 'N/D'"/>
          </div>

          <div class="risk-story-hero">
            <Card class="risk-main-card">
              <template #content>
                <div class="risk-main-copy">
                  <span class="section-kicker">Lectura gerencial</span>
                  <h2>{{ pdRiskTotals.alto.toLocaleString('en-US') }}</h2>
                  <p>Operaciones con alta probabilidad de caer en mora el siguiente mes.</p>
                </div>

                <div class="risk-main-status">
                  <div>
                    <span>Participación alta</span>
                    <strong>{{ percent(pdRiskTotals.altoPct) }}</strong>
                  </div>
                  <div>
                    <span>Total evaluado</span>
                    <strong>{{ pdRiskTotals.total.toLocaleString('en-US') }}</strong>
                  </div>
                </div>
              </template>
            </Card>

            <Card class="risk-mini-card risk-high">
              <template #content>
                <span>Alta</span>
                <div style="display: flex;flex-direction: column"><strong>{{
                    pdRiskTotals.alto.toLocaleString('en-US')
                  }}</strong>
                  <small>{{ percent(pdRiskTotals.altoPct) }} del total</small></div>

              </template>
            </Card>

            <Card class="risk-mini-card risk-mid">
              <template #content>
                <span>Media</span>
                <div style="display: flex;flex-direction: column">
                  <strong>{{ pdRiskTotals.media.toLocaleString('en-US') }}</strong>
                  <small>{{ percent(pdRiskTotals.mediaPct) }} del total</small></div>
              </template>
            </Card>

            <Card class="risk-mini-card risk-low">
              <template #content>
                <span>Baja</span>
                <div style="display: flex;flex-direction: column">
                  <strong>{{ pdRiskTotals.baja.toLocaleString('en-US') }}</strong>
                  <small>{{ percent(pdRiskTotals.bajaPct) }} del total</small></div>
              </template>
            </Card>
          </div>
          <Card class="elevated-card risk-history-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-red">
                  <font-awesome-icon icon="chart-line"/>
                </div>
                <div>
                  <strong>Evolución histórica de riesgo operativo</strong>
                  <small>Alta y media probabilidad según histórico disponible</small>
                </div>
              </div>
            </template>

            <template #content>
              <div class="chart-box risk-history-chart">
                <Chart
                    type="line"
                    :data="pdRiskHistoryChart"
                    :options="pdRiskHistoryLineOptions"
                    style="width: 100%; height: 100%;"
                />
              </div>
            </template>
          </Card>
          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-red">
                  <font-awesome-icon icon="building-columns"/>
                </div>
                <div>
                  <strong>Sucursales con mayor concentración de riesgo alto</strong>
                  <small>Top 10 por cantidad de operaciones en alta probabilidad</small>
                </div>
              </div>
            </template>
            <template #content>
              <div class="chart-box chart-box-product-goal">
                <Chart type="bar" :data="pdRiskSucursalChart" :options="pdRiskBarOptions"
                       style="width: 100%; height: 100%;"/>
              </div>
            </template>
          </Card>

          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-purple">
                  <font-awesome-icon icon="table-cells"/>
                </div>
                <div>
                  <strong>Detalle crítico por agencia</strong>
                  <small>Priorizado por operaciones con alta probabilidad</small>
                </div>
              </div>
            </template>
            <template #content>
              <DataTable
                  :value="pdRiskCriticalAgencies"
                  responsive-layout="scroll"
                  showGridlines
                  sortField="alto"
                  :sortOrder="-1"
              >
                <Column field="sucursal" header="Sucursal"/>
                <Column field="nombreAgencia" header="Agencia"/>
                <Column field="producto" header="Producto"/>

                <Column field="alto" header="Alta">
                  <template #body="{ data }">
                    <strong class="text-danger">{{ Number(data.alto || 0).toLocaleString('en-US') }}</strong>
                  </template>
                </Column>

                <Column field="media" header="Media">
                  <template #body="{ data }">
                    <strong>{{ Number(data.media || 0).toLocaleString('en-US') }}</strong>
                  </template>
                </Column>

                <Column field="baja" header="Baja">
                  <template #body="{ data }">
                    {{ Number(data.baja || 0).toLocaleString('en-US') }}
                  </template>
                </Column>

                <Column field="totalOperaciones" header="Total">
                  <template #body="{ data }">
                    {{ Number(data.totalOperaciones || 0).toLocaleString('en-US') }}
                  </template>
                </Column>

                <Column field="altoPct" header="% Alta">
                  <template #body="{ data }">
                    <Tag
                        :severity="Number(data.altoPct || 0) >= 40 ? 'danger' : Number(data.altoPct || 0) >= 20 ? 'warning' : 'success'"
                        :value="percent(data.altoPct)"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </section>

        <!-- ═══ PROYECCIÓN ════════════════════════════════════════════════════ -->
        <section v-show="active === 'proyeccion'" class="page-grid">
          <div class="section-header">
            <div>
              <span>Escenarios</span>
              <h3>Proyección financiera 2026</h3>
            </div>
            <Tag severity="info" value="Escenarios independientes"/>
          </div>

          <div class="chart-filter-card" style="display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
              <label style="display: block; margin-bottom: 0.5rem;">Métrica del gráfico</label>
              <Dropdown
                  v-model="draftProjectionMetric"
                  :options="projectionMetrics"
                  append-to="body"
                  style="width: 100%;"
              />
            </div>

            <div class="proj-products" style="flex: 2; min-width: 300px;">
              <label style="display: block; margin-bottom: 0.5rem;">Desglose por producto</label>
              <MultiSelect
                  v-model="draftSelectedProjProducts"
                  :options="catalogs.productosBNB.filter((p) => p !== 'TODOS')"
                  placeholder="Seleccione productos"
                  :maxSelectedLabels="3"
                  display="chip"
                  append-to="body"
                  style="width: 100%;"
              />
            </div>
            <div style="flex: 1; min-width: 180px;">
              <label style="display: block; margin-bottom: 0.5rem;">Escenario desembolsos</label>
              <Dropdown
                  v-model="draftDesembolsoScenario"
                  :options="scenarios"
                  optionLabel="label"
                  optionValue="value"
                  append-to="body"
                  style="width: 100%;"
              />
            </div>

            <div style="flex: 1; min-width: 180px;">
              <label style="display: block; margin-bottom: 0.5rem;">Escenario amortización</label>
              <Dropdown
                  v-model="draftAmortizacionScenario"
                  :options="scenarios"
                  optionLabel="label"
                  optionValue="value"
                  append-to="body"
                  style="width: 100%;"
              />
            </div>
            <div>
              <Button
                  label="Aplicar"
                  icon="pi pi-check"
                  @click="applyProjectionFilters"
              />
            </div>
          </div>

          <Card>
            <template #content>
              <div class="chart-box" style="height: 500px;">
                <Chart
                    type="line"
                    :data="projectionChart"
                    :options="projectionChartOptions"
                    style="height: 100%; width: 100%;"
                />
              </div>
            </template>
          </Card>
          <div class="projection-summary-grid projection-summary-grid-six">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Stock actual</span>
                  <strong class="projection-summary-value">
                    {{ moneyFull(projectionYearSummary.stockActual) }}
                  </strong>
                  <small class="projection-summary-helper">Productos seleccionados</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Desembolsos 2026</span>
                  <strong class="projection-summary-value">
                    {{ moneyFull(projectionYearSummary.totalDesembolsoAnio) }}
                  </strong>

                  <div class="projection-summary-split">
                    <span>Real: <b>{{ moneyFull(projectionYearSummary.desembolsoReal) }}</b></span>
                    <span>Proy.: <b>{{ moneyFull(projectionYearSummary.desembolsoProyectado) }}</b></span>
                  </div>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Amortizaciones 2026</span>
                  <strong class="projection-summary-value">
                    {{ moneyFull(projectionYearSummary.totalAmortizacionAnio) }}
                  </strong>

                  <div class="projection-summary-split">
                    <span>Real: <b>{{ moneyFull(projectionYearSummary.amortizacionReal) }}</b></span>
                    <span>Proy.: <b>{{ moneyFull(projectionYearSummary.amortizacionProyectada) }}</b></span>
                  </div>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card projection-summary-main">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Stock estimado fin de año</span>
                  <strong class="projection-summary-value projection-summary-value-main">
                    {{ moneyFull(projectionYearSummary.stockFinAnio) }}
                  </strong>
                  <small class="projection-summary-helper">
                    Stock actual + desembolsos proyectados - amortizaciones proyectadas
                  </small>
                </div>
              </template>
            </Card>

            <Card
                class="projection-summary-card"
                :class="Number(projectionYearSummary.crecimientoVsDicMonto || 0) >= 0 ? 'is-good' : 'is-risk'"
            >
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Crecimiento vs Dic-25</span>

                  <strong
                      class="projection-summary-value"
                      :class="Number(projectionYearSummary.crecimientoVsDicMonto || 0) >= 0 ? 'text-green' : 'text-danger'"
                  >
                    {{ signedMoneyFull(projectionYearSummary.crecimientoVsDicMonto) }}
                  </strong>

                  <div class="projection-summary-split">
        <span>
          Crecimiento:
          <b>
            {{
              projectionYearSummary.crecimientoVsDicPct > 0 ? '+' : ''
            }}{{ percent(projectionYearSummary.crecimientoVsDicPct) }}
          </b>
        </span>
                    <span>
          Stock Dic-25:
          <b>{{ moneyFull(projectionYearSummary.stockBase) }}</b>
        </span>
                  </div>
                </div>
              </template>
            </Card>

            <Card
                class="projection-summary-card"
                :class="Number(projectionYearSummary.diferenciaVsPresupuesto || 0) >= 0 ? 'is-good' : 'is-risk'"
            >
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Resultado vs presupuesto</span>

                  <strong
                      class="projection-summary-value"
                      :class="Number(projectionYearSummary.diferenciaVsPresupuesto || 0) >= 0 ? 'text-green' : 'text-danger'"
                  >
                    {{ signedMoneyFull(projectionYearSummary.diferenciaVsPresupuesto) }}
                  </strong>

                  <div class="projection-summary-split">
        <span>
          Stock presupuesto:
          <b>{{ moneyFull(projectionYearSummary.presupuesto) }}</b>
        </span>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </section>

        <!-- ═══ SISTEMA FINANCIERO ════════════════════════════════════════════ -->
        <section v-show="active === 'sistema'" class="page-grid">
          <div class="section-header">
            <div><span>Benchmarking</span>
              <h3>Sistema financiero</h3></div>
            <Tag value="Denominador incluye BNB" severity="success"/>
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
          </div>
          <div class="section-header">
            <div>
              <span>Sistema financiero · Clientes compartidos</span>
              <h3>Cartera compartida con el sistema</h3>
            </div>
            <Tag severity="warning" value="Oportunidades"/>
          </div>
          <div class="shared-kpi-grid">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Clientes compartidos</span>
                  <strong class="projection-summary-value">{{
                      Number(sharedPortfolioTotals.clientesCompartidos || 0).toLocaleString('en-US')
                    }}</strong>
                  <small class="projection-summary-helper">Cantidad de clientes con cartera compartida</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Cartera BNB</span>
                  <strong class="projection-summary-value">{{ moneyFull(sharedPortfolioTotals.bnb) }}</strong>
                  <small class="projection-summary-helper">{{ percent(sharedPortfolioTotals.participacionBNBPct) }} del
                    total compartido</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Cartera otros bancos</span>
                  <strong class="projection-summary-value">{{ moneyFull(sharedPortfolioTotals.otrosBancos) }}</strong>
                  <small class="projection-summary-helper">{{ percent(sharedPortfolioTotals.participacionOtrosPct) }}
                    del total compartido</small>
                </div>
              </template>
            </Card>
          </div>
          <Card class="elevated-card shared-matrix-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-purple">
                  <font-awesome-icon icon="table-cells"/>
                </div>
                <div>
                  <strong>Matriz de cartera compartida por banco y segmento</strong>
                  <small>Potencial de compra de deuda cruzando banco competidor y producto</small>
                </div>
              </div>
            </template>

            <template #content>
              <div class="shared-matrix-wrapper">
                <table class="shared-matrix-table">
                  <thead>
                  <tr>
                    <th class="sticky-col">Banco</th>

                    <th
                        v-for="segment in sharedPortfolioMatrix.segments"
                        :key="segment"
                        class="segment-col"
                    >
                      {{ segment }}
                    </th>

                    <th class="total-col">Total banco</th>
                    <th class="total-col">Participación</th>
                  </tr>
                  </thead>

                  <tbody>
                  <tr
                      v-for="row in sharedPortfolioMatrix.rows"
                      :key="row.banco"
                  >
                    <td class="sticky-col bank-cell">
                      <div class="bank-name">
                        <span class="bank-dot"></span>
                        <strong>{{ row.banco }}</strong>
                      </div>
                    </td>

                    <td
                        v-for="segment in sharedPortfolioMatrix.segments"
                        :key="`${row.banco}-${segment}`"
                    >
                      <div
                          class="matrix-cell"
                          :class="matrixCellClass(row.segmentos[segment]?.monto)"
                      >
                        <strong>
                          {{ moneyFullNoDecimals(row.segmentos[segment]?.monto || 0) }}
                        </strong>

                        <small>
                          {{
                            row.segmentos[segment]?.participacionSegmentoPct === null ||
                            row.segmentos[segment]?.participacionSegmentoPct === undefined
                                ? 'N/A'
                                : `${Number(row.segmentos[segment]?.participacionSegmentoPct).toFixed(1)}% del segmento`
                          }}
                        </small>
                      </div>
                    </td>

                    <td class="total-col">
                      <strong>{{ moneyFullNoDecimals(row.totalBanco) }}</strong>
                    </td>

                    <td class="total-col">
                      <Tag
                          :severity="row.participacionTotalPct >= 25 ? 'danger' : row.participacionTotalPct >= 10 ? 'warning' : 'success'"
                          :value="`${Number(row.participacionTotalPct || 0).toFixed(1)}%`"
                      />
                    </td>
                  </tr>
                  </tbody>

                  <tfoot>
                  <tr>
                    <td class="sticky-col">
                      <strong>Total segmento</strong>
                    </td>

                    <td
                        v-for="segment in sharedPortfolioMatrix.segments"
                        :key="`total-${segment}`"
                    >
                      <strong>
                        {{ moneyFullNoDecimals(sharedPortfolioMatrix.segmentTotals[segment] || 0) }}
                      </strong>
                    </td>

                    <td class="total-col">
                      <strong>{{ moneyFullNoDecimals(sharedPortfolioMatrix.totalGeneral) }}</strong>
                    </td>

                    <td class="total-col">
                      <strong>100%</strong>
                    </td>
                  </tr>
                  </tfoot>
                </table>
              </div>
            </template>
          </Card>
          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-amber">
                  <font-awesome-icon icon="table-cells"/>
                </div>
                <div>
                  <strong>Potencial de compra de deuda por sucursal / agencia</strong>
                  <small>Priorización comercial por cartera compartida con otros bancos</small>
                </div>
              </div>
            </template>

            <template #content>
              <DataTable
                  :value="sharedPortfolioAgencyRows"
                  responsive-layout="scroll"
                  showGridlines
                  sortField="otrosBancos"
                  :sortOrder="-1"
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
              >
                <Column field="sucursal" header="Sucursal"/>
                <Column field="nombreAgencia" header="Agencia"/>
                <Column field="clientesCompartidos" header="Clientes compartidos">
                  <template #body="{ data }">
                    <strong>{{ Number(data.clientesCompartidos || 0).toLocaleString('en-US') }}</strong>
                  </template>
                </Column>

                <Column field="participacionBNBPct" header="% con BNB">
                  <template #body="{ data }">
                    <Tag severity="success" :value="percent(data.participacionBNBPct)"/>
                  </template>
                </Column>

                <Column field="participacionOtrosPct" header="% con otros">
                  <template #body="{ data }">
                    <Tag severity="warning" :value="percent(data.participacionOtrosPct)"/>
                  </template>
                </Column>

                <Column field="otrosBancos" header="Potencial compra">
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.otrosBancos) }}</strong>
                  </template>
                </Column>

                <Column field="prioridad" header="Prioridad">
                  <template #body="{ data }">
                    <Tag
                        :severity="data.prioridad === 'Alta' ? 'danger' : data.prioridad === 'Media' ? 'warning' : 'success'"
                        :value="data.prioridad"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
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
                <Button label="Plan comercial" outlined @click="triggerPlanComercialAnalysis()"/>
                <Button label="Explica la brecha" outlined @click="triggerBrechaAnalysis()"/>
                <Button label="BNB vs competencia" outlined @click="triggerCompetenciaAnalysis()"/>
                <Button label="Ranking oficiales" outlined @click="triggerOficialesAnalysis()"/>
                <Button label="Captaciones" outlined @click="triggerCaptacionesAnalysis()"/>
                <Button label="Fuga captaciones" outlined @click="triggerCaptacionesAnalysis()"/>
                <Button label="Oportunidades" outlined @click="triggerOportunidadesAnalysis()"/>
                <Button label="Maduración" outlined @click="triggerMaduracionAnalysis()"/>
                <Button label="LCF" outlined @click="triggerLcfAnalysis()"/>
                <Button label="Cartera compartida" outlined @click="triggerCarteraCompartidaAnalysis()"/>
                <Button label="Proyección financiera" outlined @click="triggerProjectionAnalysis()"/>
                <Button label="Probabilidad de mora" outlined @click="triggerPdRiskAnalysis()"/>
                <Button label="Riesgos comerciales" outlined @click="triggerRiesgoAnalysis()"/>
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
        <section v-show="active === 'capt-desempeno'" class="page-grid">
          <div class="section-header">
            <div>
              <span>Captaciones · Desempeño</span>
              <h3>Desempeño de captaciones por producto</h3>
              <small>Corte {{ captacionesPeriod }} · Cifras en USD</small>
            </div>
            <Tag severity="success" value="Captaciones"/>
          </div>

          <div class="projection-summary-grid">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Captación ejecutada</span>
                  <strong class="projection-summary-value">
                    {{ moneyFull(captacionesTotals.ejecutadaCaptaciones) }}
                  </strong>
                  <small class="projection-summary-helper">Total ejecutado al corte</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Presupuesto captaciones</span>
                  <strong class="projection-summary-value">
                    {{ moneyFull(captacionesTotals.presupuestadaCaptaciones) }}
                  </strong>
                  <small class="projection-summary-helper">Meta vigente al corte</small>
                </div>
              </template>
            </Card>

            <Card
                class="projection-summary-card"
                :class="Number(captacionesTotals.brechaCaptaciones || 0) >= 0 ? 'is-good' : 'is-risk'"
            >
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Brecha vs presupuesto</span>
                  <strong
                      class="projection-summary-value"
                      :class="Number(captacionesTotals.brechaCaptaciones || 0) >= 0 ? 'text-green' : 'text-danger'"
                  >
                    {{ signedMoneyFull(captacionesTotals.brechaCaptaciones) }}
                  </strong>
                  <small class="projection-summary-helper">
                    Cumplimiento {{ percent(captacionesTotals.cumplimientoCaptacionesPct) }}
                  </small>
                </div>
              </template>
            </Card>
          </div>

          <div class="capt-chart-grid capt-chart-grid-balanced">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-green">
                    <font-awesome-icon icon="chart-simple"/>
                  </div>
                  <div>
                    <strong>Ejecutado vs presupuesto por producto</strong>
                    <small>Vista, ahorros y plazo</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="captacionesProductoChart"
                      :options="captacionesBarOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>

            <Card class="elevated-card" style="height: 100%">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-blue">
                    <font-awesome-icon icon="building-columns"/>
                  </div>
                  <div>
                    <strong>Sucursales por captación ejecutada</strong>
                    <small>Ranking por monto ejecutado</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="captacionesSucursalChart"
                      :options="captacionesHorizontalOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>
          </div>
          <Card class="elevated-card capt-historico-card">
            <template #title>
              <div class="card-title-rich card-title-with-action">
                <div class="card-title-left">
                  <div class="card-title-icon bg-purple">
                    <font-awesome-icon icon="chart-line"/>
                  </div>
                  <div>
                    <strong>Histórico de captaciones: stock vs presupuesto</strong>
                    <small>Evolución mensual con cumplimiento en monto y porcentaje</small>
                  </div>
                </div>

                <Dropdown
                    v-model="captacionHistoricoProducto"
                    :options="captacionHistoricoProductoOptions"
                    optionLabel="label"
                    optionValue="value"
                    append-to="body"
                    class="capt-historico-filter"
                />
              </div>
            </template>

            <template #content>
              <div class="chart-box capt-historico-chart">
                <Chart
                    type="line"
                    :data="captacionesHistoricoChart"
                    :options="captacionesHistoricoLineOptions"
                    style="width: 100%; height: 100%;"
                />
              </div>
            </template>
          </Card>
          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-purple">
                  <font-awesome-icon icon="building-columns"/>
                </div>
                <div>
                  <strong>Detalle por agencia</strong>
                  <small>Vista, ahorros, plazo y cumplimiento total por agencia</small>
                </div>
              </div>
            </template>

            <template #content>
              <DataTable
                  :value="captacionesByAgencia"
                  responsive-layout="scroll"
                  showGridlines
                  sortField="ejecutadaCaptaciones"
                  :sortOrder="-1"
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
              >
                <Column field="nombreAgencia" header="Agencia"/>

                <Column field="ejecutadaVista" header="Vista">
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.ejecutadaVista) }}</strong>
                    <small class="table-subtext">{{ percent(data.cumplimientoVistaPct) }}</small>
                  </template>
                </Column>

                <Column field="ejecutadaAhorros" header="Ahorros">
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.ejecutadaAhorros) }}</strong>
                    <small class="table-subtext">{{ percent(data.cumplimientoAhorrosPct) }}</small>
                  </template>
                </Column>

                <Column field="ejecutadaPlazo" header="Plazo">
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.ejecutadaPlazo) }}</strong>
                    <small class="table-subtext">{{ percent(data.cumplimientoPlazoPct) }}</small>
                  </template>
                </Column>

                <Column field="ejecutadaCaptaciones" header="Total ejecutado">
                  <template #body="{ data }">
                    <strong>{{ moneyFull(data.ejecutadaCaptaciones) }}</strong>
                  </template>
                </Column>

                <Column field="presupuestadaCaptaciones" header="Presupuesto">
                  <template #body="{ data }">
                    {{ moneyFull(data.presupuestadaCaptaciones) }}
                  </template>
                </Column>

                <Column field="brechaCaptaciones" header="Brecha">
                  <template #body="{ data }">
                    <strong :class="Number(data.brechaCaptaciones || 0) >= 0 ? 'text-green' : 'text-danger'">
                      {{ signedMoneyFull(data.brechaCaptaciones) }}
                    </strong>
                  </template>
                </Column>

                <Column field="cumplimientoCaptacionesPct" header="Cumplimiento">
                  <template #body="{ data }">
                    <Tag
                        :severity="Number(data.cumplimientoCaptacionesPct || 0) >= 100 ? 'success' : 'danger'"
                        :value="percent(data.cumplimientoCaptacionesPct)"
                    />
                  </template>
                </Column>

                <Column field="categoriaTendencia" header="Tendencia">
                  <template #body="{ data }">
                    <Tag
                        :severity="captacionCategorySeverity(data.categoriaTendencia)"
                        :value="data.categoriaTendencia || 'N/D'"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </section>
        <section v-show="active === 'capt-tendencias'" class="page-grid">
          <div class="section-header">
            <div>
              <span>Captaciones · Tendencias</span>
              <h3>Tendencias de captaciones</h3>
              <small>Corte {{ captacionesPeriod }} · Clasificación por comportamiento</small>
            </div>
            <Tag severity="info" value="Tendencias"/>
          </div>
          <div class="">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-blue">
                    <font-awesome-icon icon="table-cells"/>
                  </div>
                  <div>
                    <strong>Detalle de tendencia por agencia</strong>
                    <small>Captación total, brecha y categoría por agencia</small>
                  </div>
                </div>
              </template>

              <template #content>
                <DataTable
                    :value="captacionesByAgencia"
                    responsive-layout="scroll"
                    showGridlines
                    sortField="categoriaTendencia"
                    :sortOrder="-1"
                    paginator
                    :rows="12"
                    :rowsPerPageOptions="[12, 24, 50, 100]"
                >
                  <Column field="nombreAgencia" header="Agencia"/>

                  <Column field="ejecutadaCaptaciones" header="Captación total">
                    <template #body="{ data }">
                      <strong>{{ moneyFull(data.ejecutadaCaptaciones) }}</strong>
                    </template>
                  </Column>

                  <Column field="brechaCaptaciones" header="Brecha vs presupuesto">
                    <template #body="{ data }">
                      <strong :class="Number(data.brechaCaptaciones || 0) >= 0 ? 'text-green' : 'text-danger'">
                        {{ signedMoneyFull(data.brechaCaptaciones) }}
                      </strong>
                    </template>
                  </Column>

                  <Column field="cumplimientoCaptacionesPct" header="Cumplimiento">
                    <template #body="{ data }">
                      <Tag
                          :severity="Number(data.cumplimientoCaptacionesPct || 0) >= 100 ? 'success' : 'danger'"
                          :value="percent(data.cumplimientoCaptacionesPct)"
                      />
                    </template>
                  </Column>

                  <Column field="categoriaTendencia" header="Categoría">
                    <template #body="{ data }">
                      <Tag
                          :severity="captacionCategorySeverity(data.categoriaTendencia)"
                          :value="data.categoriaTendencia || 'N/D'"
                      />
                    </template>
                  </Column>
                </DataTable>
              </template>
            </Card>
          </div>

        </section>
        <section v-show="active === 'capt-fuga'" class="page-grid">
          <div class="section-header">
            <div>
              <span>Captaciones · Fuga</span>
              <h3>Alertas de fuga de captaciones</h3>
              <small>Corte {{ captacionesPeriod }} · Señal basada en categoría de captaciones</small>
            </div>
            <Tag severity="danger" value="Riesgo"/>
          </div>

          <div class="projection-summary-grid">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Saldo en alerta</span>
                  <strong class="projection-summary-value text-danger">
                    {{ moneyFull(captacionesFugaTotals.montoRiesgo) }}
                  </strong>
                  <small class="projection-summary-helper">Agencias clasificadas con categoría de alerta</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Agencias con alerta</span>
                  <strong class="projection-summary-value">
                    {{ Number(captacionesFugaTotals.totalAgencias || 0).toLocaleString('en-US') }}
                  </strong>
                  <small class="projection-summary-helper">Agencias con categoría de alerta</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Alertas altas</span>
                  <strong class="projection-summary-value text-danger">
                    {{ Number(captacionesFugaTotals.alta || 0).toLocaleString('en-US') }}
                  </strong>
                  <small class="projection-summary-helper">Agencias con mayor presión</small>
                </div>
              </template>
            </Card>
          </div>

          <div class="capt-trend-layout">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-red">
                    <font-awesome-icon icon="triangle-exclamation"/>
                  </div>
                  <div>
                    <strong>Distribución de alertas de fuga</strong>
                    <small>Agencias clasificadas por nivel de riesgo</small>
                  </div>
                </div>
              </template>

              <template #content>
                <div class="chart-box compact">
                  <Chart
                      type="bar"
                      :data="captacionesFugaChart"
                      :options="captacionesBarOptions"
                  />
                </div>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-amber">
                    <font-awesome-icon icon="table-cells"/>
                  </div>
                  <div>
                    <strong>Top agencias con riesgo de fuga</strong>
                    <small>Priorizado por nivel de categoría y saldo observado</small>
                  </div>
                </div>
              </template>

              <template #content>
                <DataTable
                    :value="captacionesFugaRows"
                    responsive-layout="scroll"
                    showGridlines
                    sortField="montoRiesgo"
                    :sortOrder="-1"
                    paginator
                    :rows="12"
                    :rowsPerPageOptions="[12, 24, 50, 100]"
                >
                  <Column field="sucursal" header="Sucursal"/>
                  <Column field="nombreAgencia" header="Agencia"/>

                  <Column field="ejecutadaCaptaciones" header="Captación actual">
                    <template #body="{ data }">
                      <strong>{{ moneyFull(data.ejecutadaCaptaciones) }}</strong>
                    </template>
                  </Column>

                  <Column field="montoRiesgo" header="Saldo en alerta">
                    <template #body="{ data }">
                      <strong class="text-danger">{{ moneyFull(data.montoRiesgo) }}</strong>
                    </template>
                  </Column>

                  <Column field="nivelFuga" header="Nivel">
                    <template #body="{ data }">
                      <Tag
                          :severity="data.nivelFuga === 'Alta' ? 'danger' : data.nivelFuga === 'Media' ? 'warning' : 'success'"
                          :value="data.nivelFuga"
                      />
                    </template>
                  </Column>

                  <Column field="categoriaTendencia" header="Categoría tendencia">
                    <template #body="{ data }">
                      <Tag
                          :severity="captacionCategorySeverity(data.categoriaTendencia)"
                          :value="data.categoriaTendencia || 'N/D'"
                      />
                    </template>
                  </Column>
                </DataTable>
              </template>
            </Card>
          </div>
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
