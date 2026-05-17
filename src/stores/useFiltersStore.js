/**
 * stores/useFiltersStore.js — Estado de filtros y catálogos (Pinia).
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const DEFAULT_PRODUCTOS = [
    'CONSUMO', 'VIVIENDA', 'VIVIENDA SOCIAL',
    'TARJETAS DE CREDITO', 'VEHICULAR', 'MICROCREDITO'
];

function cloneFilters(src) {
    return JSON.parse(JSON.stringify(src));
}

function initialFilterState() {
    return {
        fecha: null,
        sucursal: ['TODAS'],
        producto: [...DEFAULT_PRODUCTOS],
        agencia: ['TODAS'],
        banco: 'TODOS'
    };
}

export const useFiltersStore = defineStore('filters', () => {
    const catalogs = ref({
        fechas: [],
        fechasSF: [],
        sucursales: ['TODAS'],
        productosBNB: ['TODOS'],
        productosSF: ['TODOS'],
        bancos: ['TODOS'],
        agencias: []
    });

    const filtersDraft = ref(initialFilterState());
    const filtersApplied = ref(cloneFilters(initialFilterState()));

    function productOptionsFor(routeName) {
        const sfRoutes = ['sistema', 'capt-desempeno', 'capt-tendencias', 'capt-fuga'];
        return sfRoutes.includes(routeName)
            ? catalogs.value.productosSF
            : catalogs.value.productosBNB;
    }

    function dateOptionsFor(routeName) {
        return routeName === 'sistema'
            ? (catalogs.value.fechasSF || catalogs.value.fechas)
            : catalogs.value.fechas;
    }

    function showBankFilterFor(routeName) {
        return routeName === 'sistema';
    }

    function showFiltersFor(routeName) {
        const noFilter = ['gobernanza', 'organigrama', 'actualizaciones', 'cartera', 'agente'];
        return !noFilter.includes(routeName);
    }

    function setInitialDate(fechas) {
        if (!filtersApplied.value.fecha && fechas?.[0]) {
            const f = fechas[0];
            filtersApplied.value.fecha = f;
            filtersDraft.value.fecha = f;
        }
    }

    function getAppliedParams() {
        return {
            fecha: filtersApplied.value.fecha,
            sucursal: filtersApplied.value.sucursal,
            producto: filtersApplied.value.producto,
            agencia: filtersApplied.value.agencia,
            banco: filtersApplied.value.banco
        };
    }

    function applyFilters(onApply) {
        filtersApplied.value = cloneFilters(filtersDraft.value);
        onApply?.();
    }

    function resetFilters(onReset) {
        const next = {
            fecha: catalogs.value.fechas?.[0] || null,
            sucursal: ['TODAS'],
            producto: [...DEFAULT_PRODUCTOS],
            agencia: ['TODAS'],
            banco: 'TODOS'
        };
        filtersDraft.value = next;
        filtersApplied.value = cloneFilters(next);
        onReset?.();
    }

    return {
        catalogs,
        filtersDraft,
        filtersApplied,
        DEFAULT_PRODUCTOS,
        productOptionsFor,
        dateOptionsFor,
        showBankFilterFor,
        showFiltersFor,
        setInitialDate,
        getAppliedParams,
        applyFilters,
        resetFilters
    };
});
