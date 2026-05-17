<script setup>
/**
 * AppTopbar.vue — Barra superior del Hub Analítico.
 * Props: activeTitle
 * Emits: toggleSidebar
 */
import Button from 'primevue/button';

defineProps({
    activeTitle: { type: String, default: 'Hub Analítico' }
});

const emit = defineEmits(['toggleSidebar']);
</script>

<template>
    <header class="topbar">
        <Button
            class="sidebar-toggle"
            text
            rounded
            aria-label="Menú lateral"
            @click="emit('toggleSidebar')"
        >
            <font-awesome-icon icon="bars" />
        </Button>
        <div>
            <p>Banco Nacional de Bolivia</p>
            <h1>{{ activeTitle }}</h1>
        </div>
        <slot />
    </header>
</template>
