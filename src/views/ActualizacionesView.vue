<script setup>
/**
 * ActualizacionesView.vue — Estado de fuentes de datos.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useDataStore } from '../stores/useDataStore.js';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import DataSourceTag from '../components/DataSourceTag.vue';

const dataStore = useDataStore();
const { fuentes, dataMode } = storeToRefs(dataStore);

const rows = computed(() => fuentes.value || []);

const statsSummary = computed(() => {
    const r = rows.value;
    return {
        total: r.length,
        vigentes: r.filter(f => estadoGroup(f.estado) === 'ok').length,
        alertas: r.filter(f => estadoGroup(f.estado) === 'warn').length,
        errores: r.filter(f => estadoGroup(f.estado) === 'error').length,
    };
});

function estadoGroup(estado) {
    if (!estado) return 'warn';
    const s = String(estado).toLowerCase();
    if (s.includes('error') || s.includes('fallo')) return 'error';
    if (s.includes('demo') || s.includes('mock') || s.includes('pendiente')) return 'warn';
    return 'ok';
}

function estadoSeverity(estado) {
    const g = estadoGroup(estado);
    if (g === 'error') return 'danger';
    if (g === 'warn') return 'warning';
    return 'success';
}

function estadoIcon(estado) {
    const g = estadoGroup(estado);
    if (g === 'error') return 'circle-exclamation';
    if (g === 'warn') return 'hourglass-half';
    return 'circle-check';
}

function tipoIcon(tipo) {
    if (!tipo) return 'database';
    const t = String(tipo).toLowerCase();
    if (t.includes('sql')) return 'database';
    if (t.includes('dim')) return 'layer-group';
    return 'database';
}

function formatDate(d) {
    if (!d) return 'No disponible';
    try {
        return new Date(d).toLocaleDateString('es-BO', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    } catch {
        return String(d);
    }
}
</script>

<template>
    <div class="page-grid">
        <!-- Header -->
        <div class="section-header">
            <div>
                <span>Infraestructura de datos</span>
                <h3>Estado de fuentes</h3>
                <small>Conectividad y última sincronización por cada fuente de datos del Hub</small>
            </div>
            <DataSourceTag :mode="dataMode" />
        </div>

        <!-- KPIs rápidos -->
        <div class="act-kpi-row">
            <div class="act-kpi-card act-kpi-total">
                <font-awesome-icon icon="database" />
                <div>
                    <strong>{{ statsSummary.total }}</strong>
                    <span>Fuentes registradas</span>
                </div>
            </div>
            <div class="act-kpi-card act-kpi-ok">
                <font-awesome-icon icon="circle-check" />
                <div>
                    <strong>{{ statsSummary.vigentes }}</strong>
                    <span>Vigentes / activas</span>
                </div>
            </div>
            <div class="act-kpi-card act-kpi-warn">
                <font-awesome-icon icon="hourglass-half" />
                <div>
                    <strong>{{ statsSummary.alertas }}</strong>
                    <span>Demo / pendientes</span>
                </div>
            </div>
            <div class="act-kpi-card act-kpi-error">
                <font-awesome-icon icon="circle-exclamation" />
                <div>
                    <strong>{{ statsSummary.errores }}</strong>
                    <span>Con error</span>
                </div>
            </div>
        </div>

        <!-- Cards por fuente -->
        <div class="act-sources-grid" v-if="rows.length > 0">
            <Card
                v-for="f in rows"
                :key="f.fuente"
                class="act-source-card"
                :class="`act-source-${estadoGroup(f.estado)}`"
            >
                <template #content>
                    <div class="act-source-header">
                        <div class="act-source-icon">
                            <font-awesome-icon :icon="tipoIcon(f.tipo)" />
                        </div>
                        <div class="act-source-title">
                            <strong>{{ f.fuente }}</strong>
                            <span>{{ f.tipo }}</span>
                        </div>
                        <Tag
                            :severity="estadoSeverity(f.estado)"
                            class="act-source-badge"
                        >
                            <template #default>
                                <font-awesome-icon :icon="estadoIcon(f.estado)" style="margin-right:4px;font-size:11px;" />
                                {{ f.estado || 'N/D' }}
                            </template>
                        </Tag>
                    </div>
                    <div class="act-source-body">
                        <div class="act-source-row">
                            <span class="act-source-label">Tabla</span>
                            <code class="act-source-value">{{ f.tabla || '—' }}</code>
                        </div>
                        <div class="act-source-row">
                            <span class="act-source-label">Fecha corte</span>
                            <strong class="act-source-value">{{ formatDate(f.fechaCorte) }}</strong>
                        </div>
                    </div>
                </template>
            </Card>
        </div>

        <!-- Tabla detalle -->
        <Card>
            <template #title>
                <div class="card-title-rich">
                    <div class="card-title-icon bg-blue">
                        <font-awesome-icon icon="table-cells" />
                    </div>
                    <div>
                        <strong>Detalle de fuentes</strong>
                        <small>Vista tabular de estado y fechas</small>
                    </div>
                </div>
            </template>
            <template #content>
                <DataTable
                    :value="rows"
                    responsive-layout="scroll"
                    showGridlines
                    :rows="20"
                    :emptyMessage="'No hay datos de fuentes disponibles en este momento.'"
                >
                    <Column field="fuente" header="Fuente">
                        <template #body="{ data }">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <font-awesome-icon :icon="tipoIcon(data.tipo)" style="color:var(--muted);font-size:13px;" />
                                <strong>{{ data.fuente }}</strong>
                            </div>
                        </template>
                    </Column>
                    <Column field="tipo" header="Tipo" />
                    <Column field="tabla" header="Tabla">
                        <template #body="{ data }">
                            <code style="font-size:12px;background:rgba(0,0,0,0.04);padding:2px 6px;border-radius:4px;">{{ data.tabla || '—' }}</code>
                        </template>
                    </Column>
                    <Column field="fechaCorte" header="Fecha de corte">
                        <template #body="{ data }">
                            {{ formatDate(data.fechaCorte) }}
                        </template>
                    </Column>
                    <Column field="estado" header="Estado">
                        <template #body="{ data }">
                            <Tag :severity="estadoSeverity(data.estado)">
                                <template #default>
                                    <font-awesome-icon :icon="estadoIcon(data.estado)" style="margin-right:4px;font-size:11px;" />
                                    {{ data.estado || 'N/D' }}
                                </template>
                            </Tag>
                        </template>
                    </Column>
                </DataTable>
            </template>
        </Card>
    </div>
</template>

<style scoped>
.act-kpi-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
}

@media (max-width: 900px) {
    .act-kpi-row { grid-template-columns: repeat(2, 1fr); }
}

.act-kpi-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: var(--white);
}

.act-kpi-card svg {
    font-size: 24px;
    flex-shrink: 0;
}

.act-kpi-card div {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.act-kpi-card strong {
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
}

.act-kpi-card span {
    font-size: 12px;
    color: var(--muted);
}

.act-kpi-ok  { border-left: 4px solid #22c55e; }
.act-kpi-ok svg { color: #22c55e; }
.act-kpi-warn { border-left: 4px solid #f59e0b; }
.act-kpi-warn svg { color: #f59e0b; }
.act-kpi-error { border-left: 4px solid #ef4444; }
.act-kpi-error svg { color: #ef4444; }
.act-kpi-total { border-left: 4px solid var(--bnb-green); }
.act-kpi-total svg { color: var(--bnb-green); }

/* Grid de cards */
.act-sources-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
}

.act-source-card {
    border-radius: 14px;
    border: 1px solid var(--line);
    transition: box-shadow 0.2s;
}

.act-source-card:hover {
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.act-source-ok  { border-top: 3px solid #22c55e; }
.act-source-warn { border-top: 3px solid #f59e0b; }
.act-source-error { border-top: 3px solid #ef4444; }

.act-source-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
}

.act-source-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(38,180,96,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--bnb-green);
    flex-shrink: 0;
    font-size: 15px;
}

.act-source-title {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.act-source-title strong {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.act-source-title span {
    font-size: 11px;
    color: var(--muted);
}

.act-source-badge {
    flex-shrink: 0;
    font-size: 11px !important;
}

.act-source-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.act-source-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.act-source-label {
    font-size: 12px;
    color: var(--muted);
    flex-shrink: 0;
}

.act-source-value {
    font-size: 12px;
    text-align: right;
}
</style>
