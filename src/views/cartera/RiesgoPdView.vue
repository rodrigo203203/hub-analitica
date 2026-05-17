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
              <span>Cartera · Riesgo predictivo</span>
              <h3>Alertas tempranas de probabilidad de mora</h3>
            </div>
            <Tag severity="danger" :value="hub.dateIso(hub.pdRisk?.[0]?.fecha) || 'N/D'"/>
          </div>

          <div class="risk-story-hero">
            <Card class="risk-main-card">
              <template #content>
                <div class="risk-main-copy">
                  <span class="section-kicker">Lectura gerencial</span>
                  <h2>{{ hub.pdRiskTotals.alto.toLocaleString('en-US') }}</h2>
                  <p>Operaciones con alta probabilidad de caer en mora el siguiente mes.</p>
                </div>

                <div class="risk-main-status">
                  <div>
                    <span>Participación alta</span>
                    <strong>{{ hub.percent(hub.pdRiskTotals.altoPct) }}</strong>
                  </div>
                  <div>
                    <span>Total evaluado</span>
                    <strong>{{ hub.pdRiskTotals.total.toLocaleString('en-US') }}</strong>
                  </div>
                </div>
              </template>
            </Card>

            <Card class="risk-mini-card risk-high">
              <template #content>
                <span>Alta</span>
                <div style="display: flex;flex-direction: column"><strong>{{ hub.pdRiskTotals.alto.toLocaleString('en-US')
                  }}</strong>
                  <small>{{ hub.percent(hub.pdRiskTotals.altoPct) }} del total</small></div>

              </template>
            </Card>

            <Card class="risk-mini-card risk-mid">
              <template #content>
                <span>Media</span>
                <div style="display: flex;flex-direction: column">
                  <strong>{{ hub.pdRiskTotals.media.toLocaleString('en-US') }}</strong>
                  <small>{{ hub.percent(hub.pdRiskTotals.mediaPct) }} del total</small></div>
              </template>
            </Card>

            <Card class="risk-mini-card risk-low">
              <template #content>
                <span>Baja</span>
                <div style="display: flex;flex-direction: column">
                  <strong>{{ hub.pdRiskTotals.baja.toLocaleString('en-US') }}</strong>
                  <small>{{ hub.percent(hub.pdRiskTotals.bajaPct) }} del total</small></div>
              </template>
            </Card>
          </div>
          <Card class="elevated-card risk-history-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-red">
                  <font-awesome-icon icon="chart-line"/>
                </div>
                <div>
                  <strong>Evolución histórica de riesgo operativo</strong>
                  <small>Alta y media probabilidad según histórico disponible</small>
                </div>
              </div>
            </template>

            <template #content>
              <div class="chart-box risk-history-chart">
                <Chart
                    type="line"
                    :data="hub.pdRiskHistoryChart"
                    :options="hub.pdRiskHistoryLineOptions"
                    style="width: 100%; height: 100%;"
                />
              </div>
            </template>
          </Card>
          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-red">
                  <font-awesome-icon icon="building-columns"/>
                </div>
                <div>
                  <strong>Sucursales con mayor concentración de riesgo alto</strong>
                  <small>Top 10 por cantidad de operaciones en alta probabilidad</small>
                </div>
              </div>
            </template>
            <template #content>
              <div class="chart-box chart-box-product-goal">
                <Chart type="bar" :data="hub.pdRiskSucursalChart" :options="hub.pdRiskBarOptions"
                       style="width: 100%; height: 100%;"/>
              </div>
            </template>
          </Card>

          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-purple">
                  <font-awesome-icon icon="table-cells"/>
                </div>
                <div>
                  <strong>Detalle crítico por agencia</strong>
                  <small>Priorizado por operaciones con alta probabilidad</small>
                </div>
              </div>
            </template>
            <template #content>
              <DataTable
                  :value="hub.pdRiskCriticalAgencies"
                  responsive-layout="scroll"
                  showGridlines
                  sortField="alto"
                  :sortOrder="-1"
              >
                <Column field="sucursal" header="Sucursal"/>
                <Column field="nombreAgencia" header="Agencia"/>
                <Column field="producto" header="Producto"/>

                <Column field="alto" header="Alta">
                  <template #body="{ data }">
                    <strong class="text-danger">{{ Number(data.alto || 0).toLocaleString('en-US') }}</strong>
                  </template>
                </Column>

                <Column field="media" header="Media">
                  <template #body="{ data }">
                    <strong>{{ Number(data.media || 0).toLocaleString('en-US') }}</strong>
                  </template>
                </Column>

                <Column field="baja" header="Baja">
                  <template #body="{ data }">
                    {{ Number(data.baja || 0).toLocaleString('en-US') }}
                  </template>
                </Column>

                <Column field="totalOperaciones" header="Total">
                  <template #body="{ data }">
                    {{ Number(data.totalOperaciones || 0).toLocaleString('en-US') }}
                  </template>
                </Column>

                <Column field="altoPct" header="% Alta">
                  <template #body="{ data }">
                    <Tag
                        :severity="Number(data.altoPct || 0) >= 40 ? 'danger' : Number(data.altoPct || 0) >= 20 ? 'warning' : 'success'"
                        :value="hub.percent(data.altoPct)"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </section>
</template>
