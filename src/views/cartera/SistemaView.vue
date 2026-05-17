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
            <div><span>Benchmarking</span>
              <h3>Sistema financiero</h3></div>
            <Tag value="Denominador incluye BNB" severity="success"/>
          </div>
          <div class="system-charts-stack">
            <Card>
              <template #title>
                <div class="card-title-row">
                  <span>Heatmap por banco — crecimiento total</span>
                </div>
              </template>
              <template #content>
                <table class="heat-table sf-matrix-table">
                  <thead>
                  <tr>
                    <th>Banco</th>
                    <th v-for="prod in hub.benchmarkMatrix.productos" :key="prod" style="text-align: center;">
                      {{ prod }}
                    </th>
                    <th style="text-align: center; width: 140px;">Participación</th>
                    <th style="text-align: center;">Crecimiento / Stock</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr v-for="row in hub.benchmarkMatrix.matrix" :key="row.banco">
                    <td>
                      <div class="bname">
                        <span class="bdot" :class="{ bnb: row.banco === 'BNB' }"></span>
                        <strong v-if="row.banco === 'BNB'">{{ row.banco }}</strong>
                        <span v-else>{{ row.banco }}</span>
                      </div>
                    </td>
                    <td v-for="prod in hub.benchmarkMatrix.productos" :key="prod"
                        style="text-align: center; vertical-align: middle;">
                      <div v-if="row[prod]" class="sf-cell">
                        <div
                            :class="hub.trendClass(row[prod].crecimientoTotal)"
                            style="font-weight: 700; font-size: 1.05em; margin-bottom: 4px;"
                        >
                          {{ hub.signedMoneyK(row[prod].crecimientoTotal) }}
                        </div>

                        <div class="sf-stock" style="font-size: 0.9em; color: #444; font-weight: 500;">
                          Stock: {{ hub.moneyKFull(row[prod].stock) }}
                        </div>
                      </div>
                      <div v-else class="heat-empty">--</div>
                    </td>
                    <td style="text-align: center; vertical-align: middle;">
                      <div class="mini-bar-container" v-if="row.rowStock > 0">
                        <div
                            v-for="(seg, si) in row.composition"
                            :key="si"
                            class="mini-bar-segment"
                            :style="{
        width: seg.value + '%',
        backgroundColor: seg.color
      }"
                            :title="seg.label + ': ' + seg.value.toFixed(1) + '%'"
                        ></div>
                      </div>

                      <small class="participation-label" v-if="row.rowStock > 0">
                        {{ row.composition.length }} productos
                      </small>
                    </td>
                    <td style="text-align: center; vertical-align: middle;">
                      <strong
                          :class="hub.trendClass(row.rowGrowth)"
                          style="font-size: 1.1em; display: block;"
                      >
                        {{ hub.signedMoneyK(row.rowGrowth) }}
                      </strong>
                      <small style="display: block; margin-top: 4px; color: #64748b;">
                        Stock: {{ hub.moneyKFull(row.rowStock) }}
                      </small>
                    </td>
                  </tr>
                  </tbody>
                </table>
              </template>
            </Card>
          </div>
          <div class="section-header">
            <div>
              <span>Sistema financiero · Clientes compartidos</span>
              <h3>Cartera compartida con el sistema</h3>
            </div>
            <Tag severity="warning" value="Oportunidades"/>
          </div>
          <div class="shared-kpi-grid">
            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Clientes compartidos</span>
                  <strong class="projection-summary-value">{{ Number(hub.sharedPortfolioTotals.clientesCompartidos || 0).toLocaleString('en-US')
                    }}</strong>
                  <small class="projection-summary-helper">Cantidad de clientes con cartera compartida</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Cartera BNB</span>
                  <strong class="projection-summary-value">{{ hub.moneyFull(hub.sharedPortfolioTotals.bnb) }}</strong>
                  <small class="projection-summary-helper">{{ hub.percent(hub.sharedPortfolioTotals.participacionBNBPct) }} del
                    total compartido</small>
                </div>
              </template>
            </Card>

            <Card class="projection-summary-card">
              <template #content>
                <div class="projection-summary-stack">
                  <span class="projection-summary-label">Cartera otros bancos</span>
                  <strong class="projection-summary-value">{{ hub.moneyFull(hub.sharedPortfolioTotals.otrosBancos) }}</strong>
                  <small class="projection-summary-helper">{{ hub.percent(hub.sharedPortfolioTotals.participacionOtrosPct) }}
                    del total compartido</small>
                </div>
              </template>
            </Card>
          </div>
          <Card class="elevated-card shared-matrix-card">
            <template #title>
              <div class="card-title-rich">
                <div class="card-title-icon bg-purple">
                  <font-awesome-icon icon="table-cells"/>
                </div>
                <div>
                  <strong>Matriz de cartera compartida por banco y segmento</strong>
                  <small>Potencial de compra de deuda cruzando banco competidor y producto</small>
                </div>
              </div>
            </template>

            <template #content>
              <div class="shared-matrix-wrapper">
                <table class="shared-matrix-table">
                  <thead>
                  <tr>
                    <th class="sticky-col">Banco</th>

                    <th
                        v-for="segment in hub.sharedPortfolioMatrix.segments"
                        :key="segment"
                        class="segment-col"
                    >
                      {{ segment }}
                    </th>

                    <th class="total-col">Total banco</th>
                    <th class="total-col">Participación</th>
                  </tr>
                  </thead>

                  <tbody>
                  <tr
                      v-for="row in hub.sharedPortfolioMatrix.rows"
                      :key="row.banco"
                  >
                    <td class="sticky-col bank-cell">
                      <div class="bank-name">
                        <span class="bank-dot"></span>
                        <strong>{{ row.banco }}</strong>
                      </div>
                    </td>

                    <td
                        v-for="segment in hub.sharedPortfolioMatrix.segments"
                        :key="`${row.banco}-${segment}`"
                    >
                      <div
                          class="matrix-cell"
                          :class="hub.matrixCellClass(row.segmentos[segment]?.monto)"
                      >
                        <strong>
                          {{ hub.moneyFullNoDecimals(row.segmentos[segment]?.monto || 0) }}
                        </strong>

                        <small>
                          {{ row.segmentos[segment]?.participacionSegmentoPct === null ||
                            row.segmentos[segment]?.participacionSegmentoPct === undefined
                                ? 'N/A'
                                : `${Number(row.segmentos[segment]?.participacionSegmentoPct).toFixed(1)}% del segmento`
                          }}
                        </small>
                      </div>
                    </td>

                    <td class="total-col">
                      <strong>{{ hub.moneyFullNoDecimals(row.totalBanco) }}</strong>
                    </td>

                    <td class="total-col">
                      <Tag
                          :severity="row.participacionTotalPct >= 25 ? 'danger' : row.participacionTotalPct >= 10 ? 'warning' : 'success'"
                          :value="`${Number(row.participacionTotalPct || 0).toFixed(1)}%`"
                      />
                    </td>
                  </tr>
                  </tbody>

                  <tfoot>
                  <tr>
                    <td class="sticky-col">
                      <strong>Total segmento</strong>
                    </td>

                    <td
                        v-for="segment in hub.sharedPortfolioMatrix.segments"
                        :key="`total-${segment}`"
                    >
                      <strong>
                        {{ hub.moneyFullNoDecimals(hub.sharedPortfolioMatrix.segmentTotals[segment] || 0) }}
                      </strong>
                    </td>

                    <td class="total-col">
                      <strong>{{ hub.moneyFullNoDecimals(hub.sharedPortfolioMatrix.totalGeneral) }}</strong>
                    </td>

                    <td class="total-col">
                      <strong>100%</strong>
                    </td>
                  </tr>
                  </tfoot>
                </table>
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
                  <strong>Potencial de compra de deuda por sucursal / agencia</strong>
                  <small>Priorización comercial por cartera compartida con otros bancos</small>
                </div>
              </div>
            </template>

            <template #content>
              <DataTable
                  :value="hub.sharedPortfolioAgencyRows"
                  responsive-layout="scroll"
                  showGridlines
                  sortField="otrosBancos"
                  :sortOrder="-1"
                  paginator
                  :rows="12"
                  :rowsPerPageOptions="[12, 24, 50, 100]"
              >
                <Column field="sucursal" header="Sucursal"/>
                <Column field="nombreAgencia" header="Agencia"/>
                <Column field="clientesCompartidos" header="Clientes compartidos">
                  <template #body="{ data }">
                    <strong>{{ Number(data.clientesCompartidos || 0).toLocaleString('en-US') }}</strong>
                  </template>
                </Column>

                <Column field="participacionBNBPct" header="% con BNB">
                  <template #body="{ data }">
                    <Tag severity="success" :value="hub.percent(data.participacionBNBPct)"/>
                  </template>
                </Column>

                <Column field="participacionOtrosPct" header="% con otros">
                  <template #body="{ data }">
                    <Tag severity="warning" :value="hub.percent(data.participacionOtrosPct)"/>
                  </template>
                </Column>

                <Column field="otrosBancos" header="Potencial compra">
                  <template #body="{ data }">
                    <strong>{{ hub.moneyFull(data.otrosBancos) }}</strong>
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

        <!-- ═══ AGENTE IA ══════════════════════════════════════════════════════ -->
        <section
  </section>
</template>
