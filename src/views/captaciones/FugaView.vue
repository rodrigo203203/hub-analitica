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
              <span>Captaciones · Fuga</span>
              <h3>Alertas de fuga de captaciones</h3>
              <small>Corte {{ hub.captacionesPeriod }} · Señal basada en categoría de captaciones</small>
            </div>
            <Tag severity="danger" value="Riesgo"/>
          </div>

          <div class="projection-summary-grid">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Saldo en alerta</span>
                  <strong class="projection-summary-value text-danger">
                    {{ hub.moneyFull(hub.captacionesFugaTotals.montoRiesgo) }}
                  </strong>
                  <small class="projection-summary-helper">Agencias clasificadas con categoría de alerta</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Agencias con alerta</span>
                  <strong class="projection-summary-value">
                    {{ Number(hub.captacionesFugaTotals.totalAgencias || 0).toLocaleString('en-US') }}
                  </strong>
                  <small class="projection-summary-helper">Agencias con categoría de alerta</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Alertas altas</span>
                  <strong class="projection-summary-value text-danger">
                    {{ Number(hub.captacionesFugaTotals.alta || 0).toLocaleString('en-US') }}
                  </strong>
                  <small class="projection-summary-helper">Agencias con mayor presión</small>
                </div>
              </template>
            </Card>
          </div>

          <div class="capt-trend-layout">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-red">
                    <font-awesome-icon icon="triangle-exclamation"/>
                  </div>
                  <div>
                    <strong>Distribución de alertas de fuga</strong>
                    <small>Agencias clasificadas por nivel de riesgo</small>
                  </div>
                </div>
              </template>

              <template #content>
                <div class="chart-box compact">
                  <Chart
                      type="bar"
                      :data="hub.captacionesFugaChart"
                      :options="hub.captacionesBarOptions"
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
                    <strong>Top agencias con riesgo de fuga</strong>
                    <small>Priorizado por nivel de categoría y saldo observado</small>
                  </div>
                </div>
              </template>

              <template #content>
                <DataTable
                    :value="hub.captacionesFugaRows"
                    responsive-layout="scroll"
                    showGridlines
                    sortField="montoRiesgo"
                    :sortOrder="-1"
                    paginator
                    :rows="12"
                    :rowsPerPageOptions="[12, 24, 50, 100]"
                >
                  <Column field="sucursal" header="Sucursal"/>
                  <Column field="nombreAgencia" header="Agencia"/>

                  <Column field="ejecutadaCaptaciones" header="Captación actual">
                    <template #body="{ data }">
                      <strong>{{ hub.moneyFull(data.ejecutadaCaptaciones) }}</strong>
                    </template>
                  </Column>

                  <Column field="montoRiesgo" header="Saldo en alerta">
                    <template #body="{ data }">
                      <strong class="text-danger">{{ hub.moneyFull(data.montoRiesgo) }}</strong>
                    </template>
                  </Column>

                  <Column field="nivelFuga" header="Nivel">
                    <template #body="{ data }">
                      <Tag
                          :severity="data.nivelFuga === 'Alta' ? 'danger' : data.nivelFuga === 'Media' ? 'warning' : 'success'"
                          :value="data.nivelFuga"
                      />
                    </template>
                  </Column>

                  <Column field="categoriaTendencia" header="Categoría tendencia">
                    <template #body="{ data }">
                      <Tag
                          :severity="hub.captacionCategorySeverity(data.categoriaTendencia)"
                          :value="data.categoriaTendencia || 'N/D'"
                      />
                    </template>
                  </Column>
                </DataTable>
              </template>
            </Card>
          </div>
        </section>
</template>
