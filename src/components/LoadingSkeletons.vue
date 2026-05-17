<script setup>
/**
 * LoadingSkeletons.vue — Estado de carga con tarjetas skeleton.
 * Props: count (número de skeletons a mostrar)
 */
import Skeleton from 'primevue/skeleton';

defineProps({
    count: { type: Number, default: 6 },
    message: { type: String, default: 'Cargando datos...' }
});
</script>

<template>
    <div class="loading-wrapper">
        <p class="loading-msg">
            <font-awesome-icon icon="rotate" spin />
            {{ message }}
        </p>
        <div class="loading-skeletons">
            <div v-for="i in count" :key="i" class="loading-skel-card">
                <Skeleton height="80px" border-radius="14px" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.loading-wrapper {
    display: grid;
    gap: 14px;
}

.loading-msg {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-size: 14px;
    margin: 0;
}

.loading-skeletons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 14px;
}
</style>
