/**
 * stores/useAppStore.js — Estado de la UI (Pinia).
 *
 * Gestiona: sección activa (vía router), sidebar, menú, la lista de secciones
 * y el título de la barra superior.
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useAppStore = defineStore('app', () => {
    // ─── Estado ───────────────────────────────────────────────────────────────
    const hasEntered = ref(false);
    const menuOpen = ref(false);
    const sidebarCollapsed = ref(false);

    // ─── Estructura del menú ──────────────────────────────────────────────────
    const sections = [
        { id: 'portada', label: 'Portada', icon: 'house', path: '/' },
        { id: 'gobernanza', label: 'Gobernanza', icon: 'shield-halved', path: '/gobernanza' },
        { id: 'organigrama', label: 'Organigrama', icon: 'sitemap', path: '/organigrama' },
        {
            id: 'cartera',
            label: 'Cartera',
            icon: 'sack-dollar',
            groupOnly: true,
            children: [
                { id: 'desempeno', label: 'Desempeño comercial', icon: 'gauge-high', path: '/cartera/desempeno' },
                { id: 'proyeccion', label: 'Proyección', icon: 'arrow-trend-up', path: '/cartera/proyeccion' },
                { id: 'riesgo-pd', label: 'Riesgo predictivo', icon: 'triangle-exclamation', path: '/cartera/riesgo' },
                { id: 'sistema', label: 'Sistema financiero', icon: 'building-columns', path: '/cartera/sistema' }
            ]
        },
        {
            id: 'captaciones',
            label: 'Captaciones',
            icon: 'piggy-bank',
            groupOnly: true,
            children: [
                { id: 'capt-desempeno', label: 'Desempeño captaciones', icon: 'chart-simple', path: '/captaciones/desempeno' },
                { id: 'capt-tendencias', label: 'Tendencias', icon: 'chart-line', path: '/captaciones/tendencias' },
                { id: 'capt-fuga', label: 'Fuga de captaciones', icon: 'arrow-trend-down', path: '/captaciones/fuga' }
            ]
        },
        {
            id: 'oportunidades',
            label: 'Oportunidades',
            icon: 'lightbulb',
            groupOnly: true,
            children: [
                { id: 'op-resumen', label: 'Resumen', icon: 'chart-pie', path: '/oportunidades/resumen' },
                { id: 'op-maduracion', label: 'Maduración créditos', icon: 'hourglass-half', path: '/oportunidades/maduracion' },
                { id: 'op-lcf', label: 'Líneas LCF', icon: 'credit-card', path: '/oportunidades/lcf' }
            ]
        },
        { id: 'agente', label: 'Agente IA', icon: 'robot', path: '/agente' },
        { id: 'actualizaciones', label: 'Actualizaciones', icon: 'rotate', path: '/actualizaciones' }
    ];

    // ─── Título activo ────────────────────────────────────────────────────────
    function activeTitleFor(routeName) {
        for (const s of sections) {
            if (s.id === routeName) return s.label;
            if (s.children) {
                const child = s.children.find(c => c.id === routeName);
                if (child) return child.label;
            }
        }
        return 'Hub Analítico';
    }

    // ─── Acciones ─────────────────────────────────────────────────────────────
    function toggleSidebar() {
        if (typeof window !== 'undefined' && window.matchMedia('(max-width: 780px)').matches) {
            menuOpen.value = !menuOpen.value;
        } else {
            sidebarCollapsed.value = !sidebarCollapsed.value;
        }
    }

    function closeMobileMenu() {
        menuOpen.value = false;
    }

    return {
        hasEntered,
        menuOpen,
        sidebarCollapsed,
        sections,
        activeTitleFor,
        toggleSidebar,
        closeMobileMenu
    };
});
