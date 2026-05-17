<script setup>
import { useHubLogic } from '../../composables/useHubLogic.js';
import Card from 'primevue/card';
import Chart from 'primevue/chart';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';

const hub = useHubLogic();
</script>


<template>
  <section class="page-grid">
          <div class="section-header">
            <div>
              <span>Oportunidades comerciales</span>
              <h3>Resumen integrado de oportunidades</h3>
              <small>Maduración de créditos, LCF y cartera compartida</small>
            </div>
            <Tag severity="success" value="Oportunidades"/>
          </div>

          <div class="projection-summary-grid">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Oportunidad total</span>
                  <strong class="projection-summary-value">
                    {{ hub.moneyFull(hub.oportunidadesTotals.oportunidadTotal) }}
                  </strong>
                  <small class="projection-summary-helper">LCF no utilizado + cartera otros bancos</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Cupo LCF no utilizado</span>
                  <strong class="projection-summary-value">
                    {{ hub.moneyFull(hub.lcfTotals.cupoNoUtilizado) }}
                  </strong>
                  <small class="projection-summary-helper">
                    {{ hub.percent(hub.lcfTotals.cupoNoUtilizadoPct) }} del monto autorizado
                  </small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Cartera en otros bancos</span>
                  <strong class="projection-summary-value">
                    {{ hub.moneyFull(hub.sharedPortfolioTotals.otrosBancos) }}
                  </strong>
                  <small class="projection-summary-helper">
                    {{ hub.percent(hub.sharedPortfolioTotals.participacionOtrosPct) }} del total compartido
                  </small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Maduración ponderada</span>
                  <strong class="projection-summary-value">
                    {{ hub.percent(hub.maduracionTotals.maduracionPonderadaPct) }}
                  </strong>
                  <small class="projection-summary-helper">Mayor % = mayor alerta · ponderada por stock vigente</small>
                </div>
              </template>
            </Card>
          </div>

          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-purple">
                  <font-awesome-icon icon="chart-simple"/>
                </div>
                <div>
                  <strong>Composición de oportunidad</strong>
                  <small>Potencial accionable por fuente</small>
                </div>
              </div>
            </template>

            <template #content>
              <div class="chart-box" style="height: 400px;">
                <Chart
                    type="bar"
                    :data="hub.oportunidadesResumenChart"
                    :options="hub.oportunidadesResumenOptions"
                    style="width: 100%; height: 100%;"
                />
              </div>
            </template>
          </Card>

          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-amber">
                  <font-awesome-icon icon="table-cells"/>
                </div>
                <div>
                  <strong>Matriz de oportunidades por agencia</strong>
                  <small>Combina maduración, LCF no utilizado y cartera compartida</small>
                </div>
              </div>
            </template>

            <template #content>
              <DataTable
                  :value="hub.oportunidadesByAgencia"
                  responsive-layout="scroll"
                  showGridlines
                  sortField="potencialTotal"
                  :sortOrder="-1"
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
              >
                <Column field="nombreAgencia" header="Agencia"/>

                <Column field="potencialTotal" header="Potencial total">
                  <template #body="{ data }">
                    <strong>{{ hub.moneyFull(data.potencialTotal) }}</strong>
                  </template>
                </Column>

                <Column field="cupoNoUtilizadoLcf" header="LCF no utilizado">
                  <template #body="{ data }">
                    {{ hub.moneyFull(data.cupoNoUtilizadoLcf) }}
                  </template>
                </Column>

                <Column field="carteraOtrosBancos" header="Otros bancos">
                  <template #body="{ data }">
                    {{ hub.moneyFull(data.carteraOtrosBancos) }}
                  </template>
                </Column>

                <Column field="maduracionPct" header="Maduración" sortable>
                  <template #body="{ data }">
                    <Tag
                        :severity="hub.maduracionAlertSeverity(data.maduracionPct)"
                        :value="hub.percent(data.maduracionPct)"
                    />
                  </template>
                </Column>

                <Column field="activacionLcfPct" header="Activación LCF">
                  <template #body="{ data }">
                    <Tag
                        :severity="Number(data.activacionLcfPct || 0) >= 70 ? 'success' : Number(data.activacionLcfPct || 0) >= 40 ? 'warning' : 'danger'"
                        :value="hub.percent(data.activacionLcfPct)"
                    />
                  </template>
                </Column>

                <Column field="prioridad" header="Prioridad">
                  <template #body="{ data }">
                    <Tag
                        :severity="data.prioridad === 'Alta' ? 'danger' : data.prioridad === 'Media' ? 'warning' : 'success'"
                        :value="data.prioridad"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </section>
</template>
