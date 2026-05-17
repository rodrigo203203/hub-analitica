<script setup>
/**
 * OrgCard.vue — Tarjeta de miembro del organigrama.
 * Props: nombre, cargo, img (URL), icon (FA kebab-case), tone
 */
defineProps({
    nombre: { type: String, required: true },
    cargo: { type: String, default: '' },
    img: { type: String, default: null },
    icon: { type: String, default: 'user-tie' },
    tone: { type: String, default: 'analyst' }
});
</script>

<template>
    <div class="org-card" :class="`org-tone-${tone}`">
        <div class="org-avatar">
            <img v-if="img" :src="img" :alt="nombre" />
            <font-awesome-icon v-else :icon="icon" />
        </div>
        <div class="org-info">
            <strong>{{ nombre }}</strong>
            <span>{{ cargo }}</span>
        </div>
        <slot />
    </div>
</template>

<style scoped>
.org-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--white);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
}

.org-avatar {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: var(--bnb-green-soft);
    display: grid;
    place-items: center;
    overflow: hidden;
    flex-shrink: 0;
    color: var(--bnb-green-dark);
    font-size: 20px;
}

.org-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.org-tone-manager .org-avatar { background: linear-gradient(135deg, var(--bnb-green-dark), var(--bnb-green)); color: var(--white); }
.org-tone-agent .org-avatar { background: linear-gradient(135deg, var(--bnb-purple), #6d28d9); color: var(--white); }
.org-tone-data .org-avatar { background: linear-gradient(135deg, var(--bnb-blue), #1d4ed8); color: var(--white); }
.org-tone-senior .org-avatar { background: linear-gradient(135deg, var(--bnb-amber), #b45309); color: var(--white); }

.org-info {
    flex: 1;
    min-width: 0;
}

.org-info strong {
    display: block;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.org-info span {
    color: var(--muted);
    font-size: 12px;
}
</style>
