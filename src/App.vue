<script setup>
/**
 * App.vue — Shell del Hub Analítico BNB.
 * Layout: entrada, sidebar, topbar, filtros globales y RouterView.
 */
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAppStore } from './stores/useAppStore.js';
import { useDataStore } from './stores/useDataStore.js';
import { useFiltersStore } from './stores/useFiltersStore.js';
import AppSidebar from './components/AppSidebar.vue';
import AppTopbar from './components/AppTopbar.vue';
import FilterBar from './components/FilterBar.vue';
import LoadingSkeletons from './components/LoadingSkeletons.vue';
import Button from 'primevue/button';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const dataStore = useDataStore();
const filtersStore = useFiltersStore();

const { hasEntered, menuOpen, sidebarCollapsed } = storeToRefs(appStore);
const { loading, dataMode } = storeToRefs(dataStore);
const { filtersDraft, catalogs } = storeToRefs(filtersStore);

const activeTitle = computed(() => appStore.activeTitleFor(route.name));
const showFilters = computed(() => filtersStore.showFiltersFor(route.name));
const productOptions = computed(() => filtersStore.productOptionsFor(route.name));
const dateOptions = computed(() => filtersStore.dateOptionsFor(route.name));
const showBankFilter = computed(() => filtersStore.showBankFilterFor(route.name));

async function reloadData() {
    try {
        await dataStore.loadAll(filtersStore.getAppliedParams(), {
            onCatalogsLoaded: (data) => {
                catalogs.value = { ...data, agencias: data.agencias || [] };
                filtersStore.setInitialDate(data.fechas);
            }
        });
    } catch (err) {
        console.error('Error cargando datos del hub:', err);
    }
}

function onApplyFilters() {
    filtersStore.applyFilters(() => reloadData());
}

function onResetFilters() {
    filtersStore.resetFilters(() => reloadData());
}

function onNavigate(sectionId) {
    const findPath = (items) => {
        for (const s of items) {
            if (s.id === sectionId && s.path) return s.path;
            if (s.children) {
                const child = s.children.find((c) => c.id === sectionId);
                if (child?.path) return child.path;
            }
        }
        return null;
    };
    const path = findPath(appStore.sections);
    if (path) {
        router.push(path);
        appStore.closeMobileMenu();
    }
}

onMounted(() => reloadData());
</script>

<template>
    <section v-if="!hasEntered" class="entry-screen">
        <div class="entry-grid" />
        <div class="entry-content">
            <div class="entry-brand">
                <div class="brand-mark large">BNB</div>
                <span>Gerencia de Analitica de Datos</span>
            </div>
            <h1>Hub Analitica</h1>
            <p>
                Inteligencia comercial para cartera, cumplimiento, mercado y seguimiento ejecutivo del Banco Nacional de Bolivia.
            </p>
            <Button class="entry-button" @click="hasEntered = true">
                <span>Comenzar</span>
                <font-awesome-icon icon="arrow-right" />
            </Button>
            <small>Generado y desarrollado por el equipo de Gerencia de Analitica de Datos.</small>
        </div>
    </section>

    <div v-else class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed, 'menu-open': menuOpen }">
        <AppSidebar
            :sections="appStore.sections"
            :active="route.name || 'portada'"
            :data-mode="dataMode"
            @navigate="onNavigate"
        />

        <div v-if="menuOpen" class="scrim" @click="appStore.closeMobileMenu()" />

        <main class="workspace">
            <AppTopbar :active-title="activeTitle" @toggle-sidebar="appStore.toggleSidebar()" />

            <FilterBar
                v-if="showFilters"
                :filters-draft="filtersDraft"
                :catalogs="catalogs"
                :product-options="productOptions"
                :date-options="dateOptions"
                :show-bank-filter="showBankFilter"
                @apply="onApplyFilters"
                @reset="onResetFilters"
            />

            <div class="page-content">
                <LoadingSkeletons v-if="loading" class="page-loading-overlay" />
                <RouterView :key="route.fullPath" />
            </div>
        </main>
    </div>
</template>
