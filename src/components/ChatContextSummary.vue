<script setup>
/**
 * ChatContextSummary.vue — Resumen visual y colapsable del contexto enviado al agente IA.
 *
 * Muestra el título del análisis, chips de secciones incluidas y un botón
 * para ver/ocultar el prompt completo (sin hacer scroll infinito en el chat).
 */
import { ref } from 'vue';
import Button from 'primevue/button';

const props = defineProps({
    title: { type: String, required: true },
    sections: { type: Array, default: () => [] },
    promptText: { type: String, default: '' }
});

const expanded = ref(false);

const SECTION_LABELS = {
    market: 'Participación mercado',
    competitors: 'Benchmark competitivo',
    officials: 'Ranking oficiales',
    timeSeries: 'Serie histórica',
    projection: 'Proyección financiera',
    pdRisk: 'Riesgo predictivo',
    captaciones: 'Captaciones',
    maduracion: 'Maduración',
    lcf: 'Líneas LCF',
    sharedPortfolio: 'Cartera compartida',
    products: 'Detalle productos',
    summary: 'Resumen ejecutivo'
};

const SECTION_ICONS = {
    market: 'chart-pie',
    competitors: 'building-columns',
    officials: 'user-tie',
    timeSeries: 'chart-line',
    projection: 'arrow-trend-up',
    pdRisk: 'triangle-exclamation',
    captaciones: 'piggy-bank',
    maduracion: 'hourglass-half',
    lcf: 'credit-card',
    sharedPortfolio: 'layer-group',
    products: 'table-cells',
    summary: 'gauge-high'
};
</script>

<template>
    <div class="ctx-summary">
        <div class="ctx-header">
            <div class="ctx-title-row">
                <div class="ctx-icon">
                    <font-awesome-icon icon="chart-line" />
                </div>
                <strong>{{ title }}</strong>
            </div>
            <Button
                class="ctx-toggle"
                text
                size="small"
                :label="expanded ? 'Ocultar contexto' : 'Ver contexto enviado'"
                :icon="expanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                @click="expanded = !expanded"
            />
        </div>

        <!-- Chips de secciones incluidas -->
        <div class="ctx-chips">
            <span
                v-for="section in sections"
                :key="section"
                class="ctx-chip"
            >
                <font-awesome-icon :icon="SECTION_ICONS[section] || 'database'" />
                {{ SECTION_LABELS[section] || section }}
            </span>
        </div>

        <!-- Prompt completo colapsable -->
        <Transition name="ctx-expand">
            <div v-if="expanded" class="ctx-prompt-wrap">
                <pre class="ctx-prompt">{{ promptText }}</pre>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.ctx-summary {
    width: 100%;
    background: rgba(38, 180, 96, 0.06);
    border: 1px solid rgba(38, 180, 96, 0.22);
    border-radius: 12px;
    padding: 14px 16px;
    display: grid;
    gap: 10px;
}

.ctx-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.ctx-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.ctx-icon {
    width: 32px;
    height: 32px;
    background: var(--bnb-green);
    border-radius: 8px;
    display: grid;
    place-items: center;
    color: white;
    font-size: 14px;
    flex-shrink: 0;
}

.ctx-title-row strong {
    font-size: 14px;
}

.ctx-toggle {
    font-size: 12px !important;
    padding: 4px 10px !important;
    color: var(--bnb-green-dark) !important;
}

.ctx-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.ctx-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--bnb-green-soft);
    color: var(--bnb-green-dark);
    border: 1px solid rgba(38, 180, 96, 0.2);
}

.ctx-prompt-wrap {
    border-top: 1px solid rgba(38, 180, 96, 0.15);
    padding-top: 12px;
}

.ctx-prompt {
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: var(--muted);
    background: rgba(15, 31, 22, 0.04);
    border-radius: 8px;
    padding: 12px;
    max-height: 300px;
    overflow-y: auto;
    margin: 0;
}

.ctx-expand-enter-active,
.ctx-expand-leave-active {
    transition: opacity 0.2s ease, max-height 0.3s ease;
    max-height: 400px;
    overflow: hidden;
}

.ctx-expand-enter-from,
.ctx-expand-leave-to {
    opacity: 0;
    max-height: 0;
}
</style>
