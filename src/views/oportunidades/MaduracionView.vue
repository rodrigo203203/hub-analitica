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
              <span>Oportunidades · Maduración</span>
              <h3>Maduración de cartera por producto</h3>
              <small>Alertas de refinanciamiento · mayor maduración implica mayor prioridad</small>
            </div>
            <Tag severity="warning" value="Oportunidades"/>
          </div>

          <div style="display:flex;align-items:center;gap:12px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:16px;padding:13px 18px;">
            <div style="width:38px;height:38px;border-radius:12px;background:#FEF3C7;color:#92600A;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <font-awesome-icon icon="bolt"/>
            </div>
            <div>
              <strong style="color:#92600A;font-size:13px;">Alerta de refinanciamiento activa</strong>
              <span style="font-size:12.5px;color:#92600A;">
                — Créditos con mayor porcentaje de maduración representan peor condición comercial y mayor prioridad para retención, refinanciamiento y ampliación de cartera.
              </span>
            </div>
          </div>

          <div class="projection-summary-grid projection-summary-grid-six">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Stock vigente</span>
                  <strong class="projection-summary-value">{{ hub.moneyFull(hub.maduracionTotals.stock) }}</strong>
                  <small class="projection-summary-helper">Saldo actual expuesto a maduración</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Monto desembolsado original</span>
                  <strong class="projection-summary-value">{{ hub.moneyFull(hub.maduracionTotals.montoDesembolso) }}</strong>
                  <small class="projection-summary-helper">Monto al desembolso inicial</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Maduración ponderada</span>
                  <strong class="projection-summary-value">{{ hub.percent(hub.maduracionTotals.maduracionPonderadaPct) }}</strong>
                  <small class="projection-summary-helper">Ponderada por stock vigente</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Créditos críticos</span>
                  <strong class="projection-summary-value">
                    {{ hub.maduracionBandRows.reduce((acc, row) => acc + Number((row.criticoCreditos ?? row.criticoRegistros) || 0), 0).toLocaleString('en-US') }}
                  </strong>
                  <small class="projection-summary-helper">Créditos si existe conteo; si no, registros &lt;60%</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Monto crítico</span>
                  <strong class="projection-summary-value">
                    {{ hub.moneyFull(maduracionBandRows.reduce((acc, row) => acc + Number(row.criticoStock || 0), 0)) }}
                  </strong>
                  <small class="projection-summary-helper">Stock con maduración crítica</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Productos en alerta</span>
                  <strong class="projection-summary-value">
                    {{ hub.maduracionSemaforoRows.filter((row) => Number(row.montoAlerta || 0) > 0).length }}
                  </strong>
                  <small class="projection-summary-helper">Con tramo alerta o crítico</small>
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
                    <strong>Distribución de maduración por producto</strong>
                    <small>% de créditos por tramo de maduración</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="hub.maduracionBandChart"
                      :options="hub.maduracionBandChartOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-amber">
                    <font-awesome-icon icon="traffic-light"/>
                  </div>
                  <div>
                    <strong>Semáforo de maduración</strong>
                    <small>Monto en cartera por nivel de alerta y producto</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div style="display:flex;flex-direction:column;gap:10px;">
                  <div
                      v-for="row in hub.maduracionSemaforoRows"
                      :key="row.producto"
                      style="border:1px solid rgba(15,31,22,.08);border-radius:14px;padding:12px;background:#fff;"
                  >
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                      <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                        <font-awesome-icon
                            :icon="Number(row.criticoStock || 0) > 0 ? 'circle-exclamation' : Number(row.alertaStock || 0) > 0 ? 'triangle-exclamation' : 'circle-check'"
                            :class="Number(row.criticoStock || 0) > 0 ? 'text-danger' : Number(row.alertaStock || 0) > 0 ? 'text-warning' : 'text-green'"
                        />
                        <strong style="font-size:13px;color:#26382d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ row.producto }}</strong>
                      </div>
                      <Tag
                          :severity="Number(row.criticoStock || 0) > 0 ? 'danger' : Number(row.alertaStock || 0) > 0 ? 'warning' : 'success'"
                          :value="Number(row.criticoStock || 0) > 0 ? 'Crítico' : Number(row.alertaStock || 0) > 0 ? 'Alerta' : 'Normal'"
                      />
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px;">
                      <div style="background:#FDEAEA;border-radius:10px;padding:8px;">
                        <span style="color:#C0392B;font-weight:700;display:block;">Crítico >50%</span>
                        <strong>{{ hub.moneyFull(row.criticoStock) }}</strong>
                      </div>
                      <div style="background:#FEF3C7;border-radius:10px;padding:8px;">
                        <span style="color:#92600A;font-weight:700;display:block;">Alerta 30–50%</span>
                        <strong>{{ hub.moneyFull(row.alertaStock) }}</strong>
                      </div>
                      <div style="background:#E8F7EE;border-radius:10px;padding:8px;">
                        <span style="color:#1a8a49;font-weight:700;display:block;">Normal <30%</span>
                        <strong>{{ hub.moneyFull(row.normalStock) }}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </Card>
          </div>

          <div class="capt-chart-grid capt-chart-grid-balanced">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-purple">
                    <font-awesome-icon icon="chart-line"/>
                  </div>
                  <div>
                    <strong>Maduración por producto</strong>
                    <small>Stock, desembolso original y maduración ponderada</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="hub.maduracionProductoChart"
                      :options="hub.opportunityMixedChartOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-blue">
                    <font-awesome-icon icon="building-columns"/>
                  </div>
                  <div>
                    <strong>Maduración por agencia</strong>
                    <small>Top agencias por stock vigente y maduración</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="hub.maduracionAgenciaChart"
                      :options="hub.opportunityMixedChartOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>
          </div>

          <Card class="elevated-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-red">
                  <font-awesome-icon icon="table-cells"/>
                </div>
                <div>
                  <strong>Detalle por sucursal y producto</strong>
                  <small>Semáforo de refinanciamiento por tramo de maduración</small>
                </div>
              </div>
            </template>
            <template #content>
              <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;background:#FDEAEA;color:#C0392B;padding:2px 9px;border-radius:4px;font-weight:600">Crítico >50%</span>
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;background:#FEF3C7;color:#92600A;padding:2px 9px;border-radius:4px;font-weight:600">Alerta 30–50%</span>
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;background:#E8F7EE;color:#1a8a49;padding:2px 9px;border-radius:4px;font-weight:600">Normal <30%</span>
              </div>

              <DataTable
                  :value="hub.maduracionSucursalProductoRows"
                  responsive-layout="scroll"
                  showGridlines
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
                  v-model:sortField="maduracionSucursalProductoSortField"
                  v-model:sortOrder="maduracionSucursalProductoSortOrder"
              >
                <Column field="sucursal" header="Sucursal" sortable/>
                <Column field="producto" header="Producto" sortable/>
                <Column field="maduracionPct" header="% Maduración prom." sortable>
                  <template #body="{ data }">
                    <Tag
                        :severity="hub.maduracionAlertSeverity(data.maduracionPct)"
                        :value="hub.percent(data.maduracionPct)"
                    />
                  </template>
                </Column>
                <Column field="stock" header="Monto USD" sortable>
                  <template #body="{ data }">
                    <strong>{{ hub.moneyFull(data.stock) }}</strong>
                  </template>
                </Column>
                <Column field="alerta" header="Alerta" sortable>
                  <template #body="{ data }">
                    <Tag
                        :severity="hub.maduracionAlertSeverity(data.maduracionPct)"
                        :value="data.alerta"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>

          <Card class="elevated-card">
            <template #title>Detalle por agencia</template>
            <template #content>
              <DataTable
                  :value="hub.maduracionDetalleAgenciaRows"
                  responsive-layout="scroll"
                  showGridlines
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
                  v-model:sortField="maduracionDetalleSortField"
                  v-model:sortOrder="maduracionDetalleSortOrder"
              >
                <Column field="nombreAgencia" header="Agencia" sortable/>
                <Column field="producto" header="Producto" sortable>
                  <template #body="{ data }">
                    {{ data.producto }}
                  </template>
                </Column>

                <Column field="stock" header="Stock" sortable>
                  <template #body="{ data }">
                    <strong>{{ hub.moneyFull(data.stock) }}</strong>
                  </template>
                </Column>

                <Column field="montoDesembolso" header="Monto desembolso" sortable>
                  <template #body="{ data }">
                    {{ hub.moneyFull(data.montoDesembolso) }}
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

                <Column field="saldoSobreDesembolsoPct" header="Saldo / desembolso" sortable>
                  <template #body="{ data }">
                    {{ hub.percent(data.saldoSobreDesembolsoPct) }}
                  </template>
                </Column>
                <Column field="alerta" header="Alerta" sortable>
                  <template #body="{ data }">
                    <Tag
                        :severity="hub.maduracionAlertSeverity(data.maduracionPct)"
                        :value="data.alerta"
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
