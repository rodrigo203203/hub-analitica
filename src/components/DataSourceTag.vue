<script setup>
/**
 * DataSourceTag.vue — Indicador En vivo / Demo según modo de datos.
 */
import Tag from 'primevue/tag';

defineProps({
    mode: { type: String, default: 'mock' }
});
</script>

<template>
    <Tag
        :severity="mode === 'sql-server' ? 'success' : 'warning'"
        :value="mode === 'sql-server' ? 'SQL Server' : 'Datos demo'"
    />
</template>
