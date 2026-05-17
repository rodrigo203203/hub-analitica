<script setup>
/**
 * AlertItem.vue — Fila de alerta ejecutiva.
 * Props: title, detail, tone (danger|warning|success|info), icon (FA kebab-case)
 */
defineProps({
    title: { type: String, required: true },
    detail: { type: String, default: '' },
    tone: { type: String, default: 'info' },
    icon: { type: String, default: 'circle-exclamation' }
});
</script>

<template>
    <div class="alert-item" :class="`alert-tone-${tone}`">
        <div class="alert-icon">
            <font-awesome-icon :icon="icon" />
        </div>
        <div class="alert-body">
            <strong>{{ title }}</strong>
            <p v-if="detail">{{ detail }}</p>
        </div>
    </div>
</template>

<style scoped>
.alert-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 16px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--soft);
}

.alert-icon {
    font-size: 18px;
    margin-top: 2px;
    flex-shrink: 0;
}

.alert-tone-danger { border-left: 4px solid var(--danger); }
.alert-tone-danger .alert-icon { color: var(--danger); }

.alert-tone-warning { border-left: 4px solid var(--warning); }
.alert-tone-warning .alert-icon { color: var(--warning); }

.alert-tone-success { border-left: 4px solid var(--bnb-green); }
.alert-tone-success .alert-icon { color: var(--bnb-green); }

.alert-tone-info { border-left: 4px solid var(--bnb-blue); }
.alert-tone-info .alert-icon { color: var(--bnb-blue); }

.alert-body strong {
    display: block;
    font-size: 14px;
    margin-bottom: 4px;
}

.alert-body p {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.5;
}
</style>
