<script setup>
/**
 * OrganigramaView.vue — Organigrama del equipo de Analítica de Datos.
 */
import { ref } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';

// Imágenes del equipo
import ronyImg from '../img/rony.jpg';
import rodrigoImg from '../img/rodrigo.jpg';
import marceloImg from '../img/marcelo.jpg';
import luciaImg from '../img/lucia.jpg';
import fraijaImg from '../img/fraija.jpg';

const orgArea = ref({
    gerente: { nombre: 'Ronald Quisbert', cargo: 'Gerente de Analítica de Datos', img: ronyImg },
    equipo: [
        {
            nombre: 'Rodrigo Torrez',
            cargo: 'Analista Senior de Datos',
            img: rodrigoImg,
            tone: 'senior',
            agentes: []
        },
        {
            nombre: 'Marcelo Fraija',
            cargo: 'Analista de Datos',
            img: fraijaImg,
            tone: 'analyst',
            agentes: [
                { nombre: 'Agente Cartera', cargo: 'IA · Análisis de cartera', icon: 'brain' },
                { nombre: 'Agente Captaciones', cargo: 'IA · Análisis de captaciones', icon: 'robot' }
            ]
        },
        {
            nombre: 'Lucía Mamani',
            cargo: 'Analista de Datos',
            img: luciaImg,
            tone: 'analyst',
            agentes: []
        }
    ]
});
</script>

<template>
    <div class="page-grid">
        <div class="section-header">
            <div>
                <span>Estructura interna</span>
                <h3>Organigrama del área</h3>
            </div>
            <Tag severity="success" value="Analítica de Datos" />
        </div>

        <Card class="org-card">
            <template #content>
                <div class="org-wrapper">
                    <!-- Gerente -->
                    <div class="org-level org-level-manager">
                        <div class="org-node org-node-manager">
                            <div class="org-avatar">
                                <img :src="orgArea.gerente.img" :alt="orgArea.gerente.nombre" class="org-avatar-img" />
                            </div>
                            <div class="org-info">
                                <strong>{{ orgArea.gerente.nombre }}</strong>
                                <span>{{ orgArea.gerente.cargo }}</span>
                            </div>
                            <Tag value="Gerencia" severity="success" />
                        </div>
                    </div>

                    <div class="org-connector-main"></div>

                    <!-- Equipo -->
                    <div class="org-level org-level-team">
                        <div
                            v-for="member in orgArea.equipo"
                            :key="member.nombre"
                            class="org-branch"
                            :class="{ 'has-agents': member.agentes && member.agentes.length }"
                        >
                            <div class="org-connector-vertical"></div>
                            <div class="org-node org-node-member" :class="`org-tone-${member.tone}`">
                                <div class="org-avatar">
                                    <img :src="member.img" :alt="member.nombre" class="org-avatar-img" />
                                </div>
                                <div class="org-info">
                                    <strong>{{ member.nombre }}</strong>
                                    <span>{{ member.cargo }}</span>
                                </div>
                            </div>

                            <!-- Agentes IA -->
                            <div v-if="member.agentes && member.agentes.length" class="org-agents">
                                <div class="org-agents-connector"></div>
                                <div
                                    v-for="agent in member.agentes"
                                    :key="agent.nombre"
                                    class="org-node org-node-agent"
                                >
                                    <div class="org-avatar agent-avatar">
                                        <font-awesome-icon :icon="agent.icon" />
                                    </div>
                                    <div class="org-info">
                                        <strong>{{ agent.nombre }}</strong>
                                        <span>{{ agent.cargo }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </Card>
    </div>
</template>
