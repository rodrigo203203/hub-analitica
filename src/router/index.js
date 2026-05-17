/**
 * router/index.js — Vue Router del Hub Analítico BNB.
 *
 * Cada sección del menú tiene su propia ruta. Se usa hash history
 * para no requerir configuración de servidor.
 */

import { createRouter, createWebHashHistory } from 'vue-router';

// ─── Vistas ───────────────────────────────────────────────────────────────────

const PortadaView = () => import('../views/PortadaView.vue');
const GobernanzaView = () => import('../views/GobernanzaView.vue');
const OrganigramaView = () => import('../views/OrganigramaView.vue');
const AgenteView = () => import('../views/AgenteView.vue');
const ActualizacionesView = () => import('../views/ActualizacionesView.vue');

// Cartera
const DesempenoView = () => import('../views/cartera/DesempenoView.vue');
const RiesgoPdView = () => import('../views/cartera/RiesgoPdView.vue');
const ProyeccionView = () => import('../views/cartera/ProyeccionView.vue');
const SistemaView = () => import('../views/cartera/SistemaView.vue');

// Oportunidades
const ResumenOpView = () => import('../views/oportunidades/ResumenOpView.vue');
const MaduracionView = () => import('../views/oportunidades/MaduracionView.vue');
const LcfView = () => import('../views/oportunidades/LcfView.vue');

// Captaciones
const DesempenoCaptView = () => import('../views/captaciones/DesempenoCaptView.vue');
const TendenciasView = () => import('../views/captaciones/TendenciasView.vue');
const FugaView = () => import('../views/captaciones/FugaView.vue');

// ─── Rutas ────────────────────────────────────────────────────────────────────

const routes = [
    { path: '/', name: 'portada', component: PortadaView },
    { path: '/gobernanza', name: 'gobernanza', component: GobernanzaView },
    { path: '/organigrama', name: 'organigrama', component: OrganigramaView },
    { path: '/agente', name: 'agente', component: AgenteView },
    { path: '/actualizaciones', name: 'actualizaciones', component: ActualizacionesView },

    // Cartera
    { path: '/cartera/desempeno', name: 'desempeno', component: DesempenoView },
    { path: '/cartera/riesgo', name: 'riesgo-pd', component: RiesgoPdView },
    { path: '/cartera/proyeccion', name: 'proyeccion', component: ProyeccionView },
    { path: '/cartera/sistema', name: 'sistema', component: SistemaView },

    // Oportunidades
    { path: '/oportunidades/resumen', name: 'op-resumen', component: ResumenOpView },
    { path: '/oportunidades/maduracion', name: 'op-maduracion', component: MaduracionView },
    { path: '/oportunidades/lcf', name: 'op-lcf', component: LcfView },

    // Captaciones
    { path: '/captaciones/desempeno', name: 'capt-desempeno', component: DesempenoCaptView },
    { path: '/captaciones/tendencias', name: 'capt-tendencias', component: TendenciasView },
    { path: '/captaciones/fuga', name: 'capt-fuga', component: FugaView },

    // Fallback
    { path: '/:pathMatch(.*)*', redirect: '/' }
];

// ─── Router ───────────────────────────────────────────────────────────────────

export const router = createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior() {
        return { top: 0, behavior: 'smooth' };
    }
});
