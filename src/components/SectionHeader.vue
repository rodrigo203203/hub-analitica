<script setup>
/**
 * SectionHeader.vue — Encabezado de sección reutilizable.
 * Props: kicker (texto superior), title, subtitle (opcional)
 */
defineProps({
    kicker: { type: String, default: '' },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' }
});
</script>

<template>
    <header class="section-header">
        <div>
            <span v-if="kicker" class="section-kicker">{{ kicker }}</span>
            <h3>{{ title }}</h3>
            <p v-if="subtitle" class="muted-copy">{{ subtitle }}</p>
        </div>
        <slot />
    </header>
</template>

<style scoped>
.section-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 14px;
    margin-bottom: 20px;
}

.section-kicker {
    color: var(--bnb-green-dark);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 11px;
    font-weight: 800;
    display: block;
    margin-bottom: 4px;
}

h3 {
    margin: 0;
    font-size: 22px;
    letter-spacing: -0.01em;
}

.muted-copy {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 14px;
}
</style>
