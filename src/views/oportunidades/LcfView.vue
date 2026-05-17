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
              <span>Oportunidades · LCF</span>
              <h3>Líneas de crédito familiar</h3>
              <small>Monto autorizado vs saldo activado</small>
            </div>
            <Tag severity="info" value="Hub_LCF"/>
          </div>

          <div class="projection-summary-grid">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Monto autorizado</span>
                  <strong class="projection-summary-value">{{ hub.moneyFull(hub.lcfTotals.montoAutorizado) }}</strong>
                  <small class="projection-summary-helper">Monto desembolsado/aprobado</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Saldo activado</span>
                  <strong class="projection-summary-value">{{ hub.moneyFull(hub.lcfTotals.saldoActivado) }}</strong>
                  <small class="projection-summary-helper">{{ hub.percent(hub.lcfTotals.activacionPct) }} de activación</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Cupo no utilizado</span>
                  <strong class="projection-summary-value">{{ hub.moneyFull(hub.lcfTotals.cupoNoUtilizado) }}</strong>
                  <small class="projection-summary-helper">{{ hub.percent(hub.lcfTotals.cupoNoUtilizadoPct) }} pendiente de activar</small>
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
                    <strong>LCF por producto</strong>
                    <small>Cupo no utilizado, saldo activado y activación</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="hub.lcfProductoChart"
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
                    <strong>LCF por agencia</strong>
                    <small>Top agencias por cupo no utilizado y activación</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box capt-chart-box">
                  <Chart
                      type="bar"
                      :data="hub.lcfAgenciaChart"
                      :options="hub.opportunityMixedChartOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>
          </div>

          <Card class="elevated-card">
            <template #title>Resumen por producto</template>
            <template #content>
              <DataTable
                  :value="hub.lcfByProduct"
                  responsive-layout="scroll"
                  showGridlines
                  sortField="cupoNoUtilizado"
                  :sortOrder="-1"
              >
                <Column field="producto" header="Producto">
                  <template #body="{ data }">
                    <strong>{{ data.producto }}</strong>
                  </template>
                </Column>

                <Column field="agenciasCount" header="Agencias">
                  <template #body="{ data }">
                    {{ Number(data.agenciasCount || 0).toLocaleString('en-US') }}
                  </template>
                </Column>

                <Column field="montoAutorizado" header="Monto autorizado">
                  <template #body="{ data }">
                    <strong>{{ hub.moneyFull(data.montoAutorizado) }}</strong>
                  </template>
                </Column>

                <Column field="saldoActivado" header="Saldo activado">
                  <template #body="{ data }">
                    {{ hub.moneyFull(data.saldoActivado) }}
                  </template>
                </Column>

                <Column field="cupoNoUtilizado" header="Cupo no utilizado">
                  <template #body="{ data }">
                    <strong class="text-green">{{ hub.moneyFull(data.cupoNoUtilizado) }}</strong>
                  </template>
                </Column>

                <Column field="activacionPct" header="% activación">
                  <template #body="{ data }">
                    <Tag
                        :severity="Number(data.activacionPct || 0) >= 70 ? 'success' : Number(data.activacionPct || 0) >= 40 ? 'warning' : 'danger'"
                        :value="hub.percent(data.activacionPct)"
                    />
                  </template>
                </Column>

                <Column field="cupoNoUtilizadoPct" header="% no utilizado">
                  <template #body="{ data }">
                    {{ hub.percent(data.cupoNoUtilizadoPct) }}
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>

          <Card class="elevated-card">
            <template #title>Detalle LCF por agencia</template>
            <template #content>
              <DataTable
                  :value="hub.lcfDetalleRows"
                  responsive-layout="scroll"
                  showGridlines
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
                  sortField="cupoNoUtilizado"
                  :sortOrder="-1"
              >
                <Column field="nombreAgencia" header="Agencia"/>
                <Column header="Producto">
                  <template #body="{ data }">
                    {{ hub.opportunityProduct(data) }}
                  </template>
                </Column>

                <Column field="montoAutorizado" header="Monto autorizado">
                  <template #body="{ data }">
                    <strong>{{ hub.moneyFull(data.montoAutorizado) }}</strong>
                  </template>
                </Column>

                <Column field="saldoActivado" header="Saldo activado">
                  <template #body="{ data }">
                    {{ hub.moneyFull(data.saldoActivado) }}
                  </template>
                </Column>

                <Column field="cupoNoUtilizado" header="Cupo no utilizado">
                  <template #body="{ data }">
                    <strong class="text-green">{{ hub.moneyFull(data.cupoNoUtilizado) }}</strong>
                  </template>
                </Column>

                <Column field="activacionPct" header="% activación">
                  <template #body="{ data }">
                    <Tag
                        :severity="Number(data.activacionPct || 0) >= 70 ? 'success' : Number(data.activacionPct || 0) >= 40 ? 'warning' : 'danger'"
                        :value="hub.percent(data.activacionPct)"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </section>
        <!-- ═══ KPIs ══════════════════════════════════════════════════════════ -->
        <section
  </section>
</template>
