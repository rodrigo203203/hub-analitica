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
              <span>Escenarios</span>
              <h3>Proyección financiera 2026</h3>
            </div>
            <Tag severity="info" value="Escenarios independientes"/>
          </div>

          <div class="chart-filter-card" style="display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
              <label style="display: block; margin-bottom: 0.5rem;">Métrica del gráfico</label>
              <Dropdown
                  v-model="hub.draftProjectionMetric"
                  :options="hub.projectionMetrics"
                  append-to="body"
                  style="width: 100%;"
              />
            </div>

            <div class="proj-products" style="flex: 2; min-width: 300px;">
              <label style="display: block; margin-bottom: 0.5rem;">Desglose por producto</label>
              <MultiSelect
                  v-model="hub.draftSelectedProjProducts"
                  :options="hub.catalogs.productosBNB.filter((p) => p !== 'TODOS')"
                  placeholder="Seleccione productos"
                  :maxSelectedLabels="3"
                  display="chip"
                  append-to="body"
                  style="width: 100%;"
              />
            </div>
            <div style="flex: 1; min-width: 180px;">
              <label style="display: block; margin-bottom: 0.5rem;">Escenario desembolsos</label>
              <Dropdown
                  v-model="hub.draftDesembolsoScenario"
                  :options="hub.scenarios"
                  optionLabel="label"
                  optionValue="value"
                  append-to="body"
                  style="width: 100%;"
              />
            </div>

            <div style="flex: 1; min-width: 180px;">
              <label style="display: block; margin-bottom: 0.5rem;">Escenario amortización</label>
              <Dropdown
                  v-model="hub.draftAmortizacionScenario"
                  :options="hub.scenarios"
                  optionLabel="label"
                  optionValue="value"
                  append-to="body"
                  style="width: 100%;"
              />
            </div>
            <div>
              <Button
                  label="Aplicar"
                  icon="pi pi-check"
                  @click="hub.applyProjectionFilters"
              />
            </div>
          </div>

          <Card>
            <template #content>
              <div class="chart-box" style="height: 500px;">
                <Chart
                    type="line"
                    :data="hub.projectionChart"
                    :options="hub.projectionChartOptions"
                    style="height: 100%; width: 100%;"
                />
              </div>
            </template>
          </Card>
          <div class="projection-summary-grid projection-summary-grid-six">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Stock actual</span>
                  <strong class="projection-summary-value">
                    {{ hub.moneyFull(projectionYearSummary.stockActual) }}
                  </strong>
                  <small class="projection-summary-helper">Productos seleccionados</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Desembolsos 2026</span>
                  <strong class="projection-summary-value">
                    {{ hub.moneyFull(projectionYearSummary.totalDesembolsoAnio) }}
                  </strong>

                  <div class="projection-summary-split">
                    <span>Real: <b>{{ hub.moneyFull(projectionYearSummary.desembolsoReal) }}</b></span>
                    <span>Proy.: <b>{{ hub.moneyFull(projectionYearSummary.desembolsoProyectado) }}</b></span>
                  </div>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Amortizaciones 2026</span>
                  <strong class="projection-summary-value">
                    {{ hub.moneyFull(projectionYearSummary.totalAmortizacionAnio) }}
                  </strong>

                  <div class="projection-summary-split">
                    <span>Real: <b>{{ hub.moneyFull(projectionYearSummary.amortizacionReal) }}</b></span>
                    <span>Proy.: <b>{{ hub.moneyFull(projectionYearSummary.amortizacionProyectada) }}</b></span>
                  </div>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card projection-summary-main">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Stock estimado fin de año</span>
                  <strong class="projection-summary-value projection-summary-value-main">
                    {{ hub.moneyFull(projectionYearSummary.stockFinAnio) }}
                  </strong>
                  <small class="projection-summary-helper">
                    Stock actual + desembolsos proyectados - amortizaciones proyectadas
                  </small>
                </div>
              </template>
            </Card>

            <Card
                class="projection-summary-card"
                :class="Number(projectionYearSummary.crecimientoVsDicMonto || 0) >= 0 ? 'is-good' : 'is-risk'"
            >
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Crecimiento vs Dic-25</span>

                  <strong
                      class="projection-summary-value"
                      :class="Number(projectionYearSummary.crecimientoVsDicMonto || 0) >= 0 ? 'text-green' : 'text-danger'"
                  >
                    {{ hub.signedMoneyFull(projectionYearSummary.crecimientoVsDicMonto) }}
                  </strong>

                  <div class="projection-summary-split">
        <span>
          Crecimiento:
          <b>
            {{ hub.projectionYearSummary.crecimientoVsDicPct > 0 ? '+' : ''
            }}{{ hub.percent(projectionYearSummary.crecimientoVsDicPct) }}
          </b>
        </span>
                    <span>
          Stock Dic-25:
          <b>{{ hub.moneyFull(projectionYearSummary.stockBase) }}</b>
        </span>
                  </div>
                </div>
              </template>
            </Card>

            <Card
                class="projection-summary-card"
                :class="Number(projectionYearSummary.diferenciaVsPresupuesto || 0) >= 0 ? 'is-good' : 'is-risk'"
            >
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Resultado vs presupuesto</span>

                  <strong
                      class="projection-summary-value"
                      :class="Number(projectionYearSummary.diferenciaVsPresupuesto || 0) >= 0 ? 'text-green' : 'text-danger'"
                  >
                    {{ hub.signedMoneyFull(projectionYearSummary.diferenciaVsPresupuesto) }}
                  </strong>

                  <div class="projection-summary-split">
        <span>
          Stock presupuesto:
          <b>{{ hub.moneyFull(projectionYearSummary.presupuesto) }}</b>
        </span>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </section>

        <!-- ═══ SISTEMA FINANCIERO ════════════════════════════════════════════ -->
        <section
  </section>
</template>
