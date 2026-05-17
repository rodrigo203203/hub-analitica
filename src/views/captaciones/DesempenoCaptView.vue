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
              <span>Captaciones · Desempeño</span>
              <h3>Desempeño de captaciones por producto</h3>
              <small>Corte {{ hub.captacionesPeriod }} · Cifras en USD</small>
            </div>
            <Tag severity="success" value="Captaciones"/>
          </div>

          <div class="projection-summary-grid">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Captación ejecutada</span>
                  <strong class="projection-summary-value">
                    {{ hub.moneyFull(captacionesTotals.ejecutadaCaptaciones) }}
                  </strong>
                  <small class="projection-summary-helper">Total ejecutado al corte</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Presupuesto captaciones</span>
                  <strong class="projection-summary-value">
                    {{ hub.moneyFull(captacionesTotals.presupuestadaCaptaciones) }}
                  </strong>
                  <small class="projection-summary-helper">Meta vigente al corte</small>
                </div>
              </template>
            </Card>

            <Card
                class="projection-summary-card"
                :class="Number(captacionesTotals.brechaCaptaciones || 0) >= 0 ? 'is-good' : 'is-risk'"
            >
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Brecha vs presupuesto</span>
                  <strong
                      class="projection-summary-value"
                      :class="Number(captacionesTotals.brechaCaptaciones || 0) >= 0 ? 'text-green' : 'text-danger'"
                  >
                    {{ hub.signedMoneyFull(captacionesTotals.brechaCaptaciones) }}
                  </strong>
                  <small class="projection-summary-helper">
                    Cumplimiento {{ hub.percent(captacionesTotals.cumplimientoCaptacionesPct) }}
                  </small>
                </div>
              </template>
            </Card>
          </div>

          <div class="capt-chart-grid capt-chart-grid-balanced">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-green">
                    <font-awesome-icon icon="chart-simple"/>
                  </div>
                  <div>
                    <strong>Ejecutado vs presupuesto por producto</strong>
                    <small>Vista, ahorros y plazo</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="hub.captacionesProductoChart"
                      :options="hub.captacionesBarOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>

            <Card class="elevated-card" style="height: 100%">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-blue">
                    <font-awesome-icon icon="building-columns"/>
                  </div>
                  <div>
                    <strong>Sucursales por captación ejecutada</strong>
                    <small>Ranking por monto ejecutado</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="hub.captacionesSucursalChart"
                      :options="hub.captacionesHorizontalOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>
          </div>
          <Card class="elevated-card capt-historico-card">
            <template #title>
              <div class="card-title-rich card-title-with-action">
                <div class="card-title-left">
                  <div class="card-title-icon bg-purple">
                    <font-awesome-icon icon="chart-line"/>
                  </div>
                  <div>
                    <strong>Histórico de captaciones: stock vs presupuesto</strong>
                    <small>Evolución mensual con cumplimiento en monto y porcentaje</small>
                  </div>
                </div>

                <Dropdown
                    v-model="hub.captacionHistoricoProducto"
                    :options="hub.captacionHistoricoProductoOptions"
                    optionLabel="label"
                    optionValue="value"
                    append-to="body"
                    class="capt-historico-filter"
                />
              </div>
            </template>

            <template #content>
              <div class="chart-box capt-historico-chart">
                <Chart
                    type="line"
                    :data="hub.captacionesHistoricoChart"
                    :options="hub.captacionesHistoricoLineOptions"
                    style="width: 100%; height: 100%;"
                />
              </div>
            </template>
          </Card>
          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-purple">
                  <font-awesome-icon icon="building-columns"/>
                </div>
                <div>
                  <strong>Detalle por agencia</strong>
                  <small>Vista, ahorros, plazo y cumplimiento total por agencia</small>
                </div>
              </div>
            </template>

            <template #content>
              <DataTable
                  :value="hub.captacionesByAgencia"
                  responsive-layout="scroll"
                  showGridlines
                  sortField="ejecutadaCaptaciones"
                  :sortOrder="-1"
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
              >
                <Column field="nombreAgencia" header="Agencia"/>

                <Column field="ejecutadaVista" header="Vista">
                  <template #body="{ data }">
                    <strong>{{ hub.moneyFull(data.ejecutadaVista) }}</strong>
                    <small class="table-subtext">{{ hub.percent(data.cumplimientoVistaPct) }}</small>
                  </template>
                </Column>

                <Column field="ejecutadaAhorros" header="Ahorros">
                  <template #body="{ data }">
                    <strong>{{ hub.moneyFull(data.ejecutadaAhorros) }}</strong>
                    <small class="table-subtext">{{ hub.percent(data.cumplimientoAhorrosPct) }}</small>
                  </template>
                </Column>

                <Column field="ejecutadaPlazo" header="Plazo">
                  <template #body="{ data }">
                    <strong>{{ hub.moneyFull(data.ejecutadaPlazo) }}</strong>
                    <small class="table-subtext">{{ hub.percent(data.cumplimientoPlazoPct) }}</small>
                  </template>
                </Column>

                <Column field="ejecutadaCaptaciones" header="Total ejecutado">
                  <template #body="{ data }">
                    <strong>{{ hub.moneyFull(data.ejecutadaCaptaciones) }}</strong>
                  </template>
                </Column>

                <Column field="presupuestadaCaptaciones" header="Presupuesto">
                  <template #body="{ data }">
                    {{ hub.moneyFull(data.presupuestadaCaptaciones) }}
                  </template>
                </Column>

                <Column field="brechaCaptaciones" header="Brecha">
                  <template #body="{ data }">
                    <strong :class="Number(data.brechaCaptaciones || 0) >= 0 ? 'text-green' : 'text-danger'">
                      {{ hub.signedMoneyFull(data.brechaCaptaciones) }}
                    </strong>
                  </template>
                </Column>

                <Column field="cumplimientoCaptacionesPct" header="Cumplimiento">
                  <template #body="{ data }">
                    <Tag
                        :severity="Number(data.cumplimientoCaptacionesPct || 0) >= 100 ? 'success' : 'danger'"
                        :value="hub.percent(data.cumplimientoCaptacionesPct)"
                    />
                  </template>
                </Column>

                <Column field="categoriaTendencia" header="Tendencia">
                  <template #body="{ data }">
                    <Tag
                        :severity="captacionCategorySeverity(data.categoriaTendencia)"
                        :value="hub.data.categoriaTendencia || 'N/D'"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </section>
        <section
  </section>
</template>
