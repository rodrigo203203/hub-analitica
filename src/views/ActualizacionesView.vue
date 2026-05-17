<script setup>
/**
 * ActualizacionesView.vue — Estado de fuentes de datos.
 */
import { storeToRefs } from 'pinia';
import { useDataStore } from '../stores/useDataStore.js';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import DataSourceTag from '../components/DataSourceTag.vue';

const dataStore = useDataStore();
const { fuentes, dataMode } = storeToRefs(dataStore);

function fuenteSeverity(estado) {
    if (!estado) return 'secondary';
    const s = String(estado).toLowerCase();
    if (s.includes('ok') || s.includes('activo')) return 'success';
    if (s.includes('error') || s.includes('fallo')) return 'danger';
    if (s.includes('demo') || s.includes('mock')) return 'warning';
    return 'info';
}
</script>

<template>
    <div class="page-grid">
        <div class="section-header">
            <div>
                <span>Infraestructura de datos</span>
                <h3>Estado de fuentes</h3>
                <small>Última sincronización y estado de conectividad de cada fuente de datos</small>
            </div>
            <DataSourceTag :mode="dataMode" />
        </div>

        <Card>
            <template #content>
                <DataTable
                    :value="fuentes || []"
                    responsive-layout="scroll"
                    showGridlines
                    paginator
                    :rows="20"
                >
                    <Column field="nombre" header="Fuente" />
                    <Column field="descripcion" header="Descripción" />
                    <Column field="ultimaActualizacion" header="Última actualización" />
                    <Column field="estado" header="Estado">
                        <template #body="{ data }">
                            <Tag :severity="fuenteSeverity(data.estado)" :value="data.estado || 'N/D'" />
                        </template>
                    </Column>
                </DataTable>
            </template>
        </Card>
    </div>
</template>
