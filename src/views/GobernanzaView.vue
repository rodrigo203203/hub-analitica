<script setup>
/**
 * GobernanzaView.vue — Sección de gobernanza del dato y marco de métricas.
 * Sin lógica de negocio: solo contenido estático.
 */
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';

const ROLES = [
    { rol: 'Data Owner', funcion: 'Define métricas, reglas de negocio y criterios de lectura comercial.' },
    { rol: 'Data Steward', funcion: 'Controla calidad, consistencia, catálogos y cierres disponibles.' },
    { rol: 'BI Analyst', funcion: 'Construye análisis y visuales bajo el marco aprobado.' },
    { rol: 'Usuario final', funcion: 'Consume información validada y solicita aclaraciones cuando el dato no sea suficiente.' }
];

function rolSeverity(rol) {
    const m = { 'Data Owner': 'info', 'Data Steward': 'success', 'BI Analyst': 'warning' };
    return m[rol] || 'secondary';
}
</script>

<template>
    <div class="page-grid">
        <div class="section-header">
            <div>
                <span>Dominio comercial · Gestión de cartera</span>
                <h3>Marco de gobernanza</h3>
                <small>Fuente única de verdad, métricas oficiales y protocolo de validación del agente</small>
            </div>
            <Tag severity="success" value="Gobernanza" />
        </div>

        <Card class="formula-card">
            <template #content>
                <span>Fuente única de verdad</span>
                <strong>Cartera Activa · Hub_CarteraBNB</strong>
                <p>
                    Toda la información comercial de cartera debe interpretarse desde la fuente oficial disponible en el hub.
                    La granularidad operativa se controla por fecha de corte, sucursal, agencia y producto.
                    Ningún indicador debe redefinirse fuera de este marco.
                </p>
            </template>
        </Card>

        <div class="governance-grid">
            <Card class="elevated-card">
                <template #title>
                    <div class="card-title-rich">
                        <div class="card-title-icon bg-green"><font-awesome-icon icon="ruler-combined" /></div>
                        <div>
                            <strong>Definiciones oficiales de métricas</strong>
                            <small>Campos base usados para construir indicadores ejecutivos</small>
                        </div>
                    </div>
                </template>
                <template #content>
                    <div class="table-list">
                        <div><strong>Stock actual</strong><span>Saldo vigente de cartera al cierre del periodo · <code>SUM(stock)</code></span></div>
                        <div><strong>Desembolsos</strong><span>Producción comercial desembolsada en el periodo · <code>SUM(Desembolso)</code></span></div>
                        <div><strong>Amortización</strong><span>Recuperación o reducción de cartera registrada en el periodo · <code>SUM(amortizacion)</code></span></div>
                        <div><strong>Pendiente</strong><span>Pipeline aprobado o pendiente de desembolso · <code>SUM(pendiente)</code></span></div>
                        <div><strong>Presupuesto</strong><span>Meta comercial de stock o ejecución según corte · <code>SUM(presupuesto)</code></span></div>
                    </div>
                </template>
            </Card>

            <div style="display:flex;flex-direction:column;gap:16px;">
                <Card class="elevated-card">
                    <template #title>
                        <div class="card-title-rich">
                            <div class="card-title-icon bg-purple"><font-awesome-icon icon="calculator" /></div>
                            <div>
                                <strong>Indicadores derivados</strong>
                                <small>Reglas obligatorias para reportes y respuestas del agente</small>
                            </div>
                        </div>
                    </template>
                    <template #content>
                        <ul class="rules-list">
                            <li>Crecimiento nominal = <code>StockActual - StockBase Dic-25</code>.</li>
                            <li>Crecimiento porcentual = <code>((StockActual / StockBase) - 1) * 100</code>.</li>
                            <li>Cumplimiento presupuesto = <code>StockActual / Presupuesto * 100</code>.</li>
                            <li>Brecha presupuesto = <code>StockActual - Presupuesto</code>.</li>
                            <li>Participación BNB en sistema financiero incluye BNB dentro del denominador total.</li>
                        </ul>
                    </template>
                </Card>

                <Card class="elevated-card">
                    <template #title>
                        <div class="card-title-rich">
                            <div class="card-title-icon bg-blue"><font-awesome-icon icon="users-gear" /></div>
                            <div>
                                <strong>Roles y responsabilidades</strong>
                                <small>Modelo mínimo de gobierno del dato comercial</small>
                            </div>
                        </div>
                    </template>
                    <template #content>
                        <DataTable :value="ROLES" responsive-layout="scroll" showGridlines>
                            <Column field="rol" header="Rol">
                                <template #body="{ data }">
                                    <Tag :severity="rolSeverity(data.rol)" :value="data.rol" />
                                </template>
                            </Column>
                            <Column field="funcion" header="Función" />
                        </DataTable>
                    </template>
                </Card>
            </div>
        </div>

        <Card class="formula-card">
            <template #content>
                <span>Relación financiera del modelo</span>
                <strong>Stock(t) ≈ Stock(t-1) + Desembolsos(t) - Amortizaciones(t)</strong>
                <p>
                    La relación es aproximada. Pueden existir ajustes contables, castigos, reclasificaciones,
                    compras o ventas de cartera que expliquen diferencias entre saldos y flujos.
                </p>
            </template>
        </Card>

        <div class="section-header" style="margin-top:8px;">
            <div>
                <span>Self-correction</span>
                <h3>Protocolo de validación de resultados</h3>
                <small>El agente debe validar coherencia financiera, catálogos y fechas antes de responder</small>
            </div>
            <Tag severity="warning" value="Sección 7" />
        </div>

        <Card class="formula-card">
            <template #content>
                <span>Flujo de auto-corrección del agente</span>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;">
                    <Tag severity="info" value="1. Recibir consulta" />
                    <font-awesome-icon icon="arrow-right" />
                    <Tag severity="danger" value="2. Validar saldos y flujos" />
                    <font-awesome-icon icon="arrow-right" />
                    <Tag severity="warning" value="3. Verificar catálogos" />
                    <font-awesome-icon icon="arrow-right" />
                    <Tag severity="info" value="4. Corregir fechas" />
                    <font-awesome-icon icon="arrow-right" />
                    <Tag severity="success" value="5. Entregar respuesta" />
                </div>
            </template>
        </Card>
    </div>
</template>
