<script setup>
/**
 * KpiCard.vue — Tarjeta de KPI reutilizable.
 * Props: label, value, helper, icon (FA kebab-case), tone (success|danger|warning|info|default)
 */
defineProps({
    label: { type: String, required: true },
    value: { type: String, default: '—' },
    helper: { type: String, default: '' },
    icon: { type: String, default: 'chart-line' },
    tone: { type: String, default: 'default' }
});
</script>

<template>
    <div class="kpi-card" :class="`kpi-tone-${tone}`">
        <div class="kpi-icon">
            <font-awesome-icon :icon="icon" />
        </div>
        <span class="kpi-label">{{ label }}</span>
        <strong class="kpi-value">{{ value }}</strong>
        <small v-if="helper" class="kpi-helper">{{ helper }}</small>
    </div>
</template>

<style scoped>
.kpi-card {
    background: var(--white);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 18px 20px;
    display: grid;
    gap: 6px;
    box-shadow: var(--shadow);
    transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.kpi-card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
}

.kpi-icon {
    font-size: 20px;
    color: var(--bnb-green);
    margin-bottom: 2px;
}

.kpi-tone-danger .kpi-icon { color: var(--danger); }
.kpi-tone-warning .kpi-icon { color: var(--warning); }
.kpi-tone-info .kpi-icon { color: var(--bnb-blue); }
.kpi-tone-success .kpi-icon { color: var(--bnb-green); }

.kpi-label {
    color: var(--muted);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.kpi-value {
    font-size: 26px;
    letter-spacing: -0.02em;
    line-height: 1.1;
}

.kpi-helper {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
}
</style>
