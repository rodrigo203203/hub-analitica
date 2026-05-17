<script setup>
/**
 * FilterBar.vue — Barra de filtros global del Hub Analítico.
 * Emite: apply, reset
 */
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import Button from 'primevue/button';

const props = defineProps({
    filtersDraft: { type: Object, required: true },
    catalogs: { type: Object, required: true },
    productOptions: { type: Array, default: () => [] },
    dateOptions: { type: Array, default: () => [] },
    showBankFilter: { type: Boolean, default: false }
});

const emit = defineEmits(['apply', 'reset']);
</script>

<template>
    <section class="filter-bar">
        <div class="filter-field">
            <label>Fecha corte</label>
            <Dropdown
                v-model="props.filtersDraft.fecha"
                :options="dateOptions"
                placeholder="yyyy-mm-dd"
                append-to="body"
            />
        </div>
        <div class="filter-field">
            <label>Sucursal</label>
            <MultiSelect
                v-model="props.filtersDraft.sucursal"
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
                v-model="props.filtersDraft.agencia"
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
                v-model="props.filtersDraft.producto"
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
            <Dropdown
                v-model="props.filtersDraft.banco"
                :options="catalogs.bancos"
                append-to="body"
            />
        </div>
        <div class="filter-actions">
            <Button label="Aplicar" @click="emit('apply')" />
            <Button label="Limpiar" outlined @click="emit('reset')" />
        </div>
    </section>
</template>
