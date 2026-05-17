<script setup>
/**
 * AppSidebar.vue — Sidebar de navegación del Hub Analítico.
 * Props: sections, active, dataMode
 * Emits: navigate(id)
 */
defineProps({
    sections: { type: Array, required: true },
    active: { type: String, required: true },
    dataMode: { type: String, default: 'mock' }
});

const emit = defineEmits(['navigate']);
</script>

<template>
    <aside class="sidebar">
        <div class="brand">
            <div class="brand-mark">BNB</div>
            <div>
                <strong>Hub Analitico</strong>
            </div>
        </div>

        <nav class="nav-list">
            <template v-for="section in sections" :key="section.id">
                <!-- Ítem sin hijos -->
                <button
                    v-if="!section.children"
                    class="nav-item"
                    :class="{ active: active === section.id }"
                    @click="emit('navigate', section.id)"
                >
                    <font-awesome-icon :icon="section.icon" />
                    <span>{{ section.label }}</span>
                </button>

                <!-- Grupo con subítems -->
                <div v-else class="nav-group">
                    <button
                        class="nav-group-title"
                        :class="{ active: section.children?.some(c => c.id === active) }"
                    >
                        <font-awesome-icon :icon="section.icon" />
                        <span>{{ section.label }}</span>
                        <font-awesome-icon icon="chevron-down" />
                    </button>
                    <button
                        v-for="child in section.children"
                        :key="child.id"
                        class="nav-subitem"
                        :class="{ active: active === child.id }"
                        @click="emit('navigate', child.id)"
                    >
                        <font-awesome-icon :icon="child.icon" />
                        <span>{{ child.label }}</span>
                    </button>
                </div>
            </template>
        </nav>

        <div class="sidebar-status">
            <span class="pulse" />
            <div>
                <strong>{{ dataMode === 'sql-server' ? 'SQL Server' : 'Datos demo' }}</strong>
                <span>{{ dataMode === 'sql-server' ? 'Conexión activa' : 'Modo sin credenciales' }}</span>
            </div>
        </div>

        <div class="sidebar-credit">
            Desarrollado por<br />
            <strong>Gerencia de Analítica de Datos</strong>
        </div>
    </aside>
</template>
