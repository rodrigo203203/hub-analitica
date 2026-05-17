<script setup>
import { ref } from 'vue';
import { useHubLogic } from '../../composables/useHubLogic.js';

const oficialesFirst = ref(0);
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
              <span>Cartera · Desempeño comercial</span>
              <h3>Lectura ejecutiva del portafolio</h3>
            </div>
            <Tag severity="info" :value="hub.dateIso(hub.summary?.fechaCorte) || 'N/D'"/>
          </div>

          <div class="performance-hero">
            <Card class="performance-main-card" style="margin-bottom: 10px">
              <template #content>
                <div class="performance-main-top">
                  <div>
                    <span class="section-kicker">Resultado del portafolio</span>

                    <h2
                        class="performance-main-amount"
                        :class="Number(hub.summary?.brechaPresupuesto || 0) >= 0 ? 'amount-positive' : 'amount-negative'"
                    >
                      {{ hub.signedMoneyFull(hub.summary?.brechaPresupuesto) }}
                    </h2>

                    <p>Brecha de stock actual contra presupuesto vigente.</p>

                    <div class="performance-main-metrics">
                      <div>
                        <span>Cumplimiento</span>
                        <strong :class="Number(hub.summary?.cumplimientoPct || 0) >= 100 ? 'text-green' : 'text-danger'">
                          {{ hub.percent(hub.summary?.cumplimientoPct) }}
                        </strong>
                      </div>

                      <div>
                        <span>Crecimiento a diciembre</span>
                        <strong :class="hub.trendClass(hub.summary?.crecimientoNominal)">
                          {{ hub.signedMoneyFull(hub.summary?.crecimientoNominal) }}
                        </strong>
                        <small>
                          {{ hub.summary?.crecimientoPct > 0 ? '+' : '' }}{{ hub.percent(hub.summary?.crecimientoPct) }}
                          contra base Dic-25
                        </small>
                      </div>
                    </div>
                  </div>

                  <div
                      class="performance-score"
                      :class="Number(hub.summary?.cumplimientoPct || 0) >= 100 ? 'is-good' : 'is-risk'"
                  >
                    <font-awesome-icon
                        :icon="Number(hub.summary?.cumplimientoPct || 0) >= 100 ? 'circle-check' : 'triangle-exclamation'"
                    />
                    <strong>{{ Number(hub.summary?.cumplimientoPct || 0) >= 100 ? 'Meta alcanzada' : 'Bajo meta' }}</strong>
                  </div>
                </div>

                <div class="performance-progress">
                  <div class="performance-progress-track">
                    <div
                        class="performance-progress-fill"
                        :class="Number(hub.summary?.cumplimientoPct || 0) >= 100 ? 'fill-good' : 'fill-risk'"
                        :style="{ width: Math.min(Math.max(Number(hub.summary?.cumplimientoPct || 0), 0), 120) / 120 * 100 + '%' }"
                    ></div>
                    <span class="performance-progress-marker"></span>
                  </div>
                  <div class="performance-progress-labels">
                    <span>0%</span>
                    <strong>100% meta</strong>
                    <span>120%</span>
                  </div>
                </div>
              </template>
            </Card>

            <div class="performance-side-grid">
              <Card class="performance-mini-card">
                <template #content>
                  <div class="metric-card-stack">
                    <span class="metric-card-label">Stock actual</span>
                    <strong class="metric-card-value">{{ hub.moneyFull(hub.summary?.stockActual) }}</strong>
                    <small class="metric-card-helper">Cartera vigente al corte</small>
                  </div>
                </template>
              </Card>

              <Card class="performance-mini-card">
                <template #content>
                  <div class="metric-card-stack">
                    <span class="metric-card-label">Presupuesto</span>
                    <strong class="metric-card-value">{{ hub.moneyFull(hub.summary?.presupuesto) }}</strong>
                    <small class="metric-card-helper">Meta vigente de stock</small>
                  </div>
                </template>
              </Card>
            </div>
          </div>
          <div class="performance-diagnosis-grid">
            <Card class="diagnosis-card">
              <template #content>
                <div class="diagnosis-icon bg-green">
                  <font-awesome-icon icon="sack-dollar"/>
                </div>
                <div>
                  <span>Desembolsos acumulados</span>
                  <strong>{{ hub.moneyFull(hub.summary?.desembolsosAcum) }}</strong>
                  <small>Ritmo comercial acumulado del año</small>
                </div>
              </template>
            </Card>

            <Card class="diagnosis-card">
              <template #content>
                <div class="diagnosis-icon bg-amber">
                  <font-awesome-icon icon="rotate"/>
                </div>
                <div>
                  <span>Amortización acumulada</span>
                  <strong>{{ hub.moneyFull(hub.summary?.amortizacion) }}</strong>
                  <small>Salida acumulada de cartera</small>
                </div>
              </template>
            </Card>

            <Card class="diagnosis-card">
              <template #content>
                <div class="diagnosis-icon bg-purple">
                  <font-awesome-icon icon="chart-line"/>
                </div>
                <div>
                  <span>Crecimiento nominal</span>
                  <strong :class="hub.trendClass(hub.summary?.crecimientoNominal)">
                    {{ hub.signedMoneyFull(hub.summary?.crecimientoNominal) }}
                  </strong>
                  <small>Variación contra base Dic-25</small>
                </div>
              </template>
            </Card>
          </div>
          <Card class="mt-4">
            <template #title>Detalle por producto</template>
            <template #content>
              <DataTable
                  :value="hub.kpisProductData"
                  responsive-layout="scroll"
                  class="product-kpi-table"
                  sortField="stock"
                  :sortOrder="-1"
                  showGridlines
              >
                <Column field="producto" header="Producto" footer="">
                  <template #body="{ data }">
                    <strong>{{ data.producto }}</strong>
                  </template>
                  <template #footer>
                    <strong>Totales</strong>
                  </template>
                </Column>

                <Column field="stock" header="Stock Actual">
                  <template #body="{ data }">
                    <strong>{{ hub.moneyFull(data.stock) }}</strong>
                  </template>
                  <template #footer>
                    <strong>{{ hub.moneyFull(hub.productTotals.stock) }}</strong>
                  </template>
                </Column>

                <Column field="crecimientoPct" header="%Crec. vs Dic">
                  <template #body="{ data }">
      <span :class="hub.trendClass(data.crecimientoPct)">
        {{ data.crecimientoPct > 0 ? '+' : '' }}{{ hub.percent(data.crecimientoPct) }}
      </span>
                  </template>
                  <template #footer>
                    <strong :class="hub.trendClass(hub.productTotals.crecimientoPct)">
                      {{ hub.productTotals.crecimientoPct > 0 ? '+' : '' }}{{ hub.percent(hub.productTotals.crecimientoPct) }}
                    </strong>
                  </template>
                </Column>

                <Column field="crecimientoMonto" header="Crec. vs Dic">
                  <template #body="{ data }">
    <span :class="hub.trendClass(hub.productGrowthAmount(data))">
      {{ hub.signedMoneyFull(hub.productGrowthAmount(data)) }}
    </span>
                  </template>

                  <template #footer>
                    <strong :class="hub.trendClass(hub.productTotals.crecimientoMonto)">
                      {{ hub.signedMoneyFull(hub.productTotals.crecimientoMonto) }}
                    </strong>
                  </template>
                </Column>

                <Column field="desembolsos" header="Desembolsos">
                  <template #body="{ data }">
                    {{ hub.moneyFull(data.desembolsos) }}
                  </template>
                  <template #footer>
                    <strong>{{ hub.moneyFull(hub.productTotals.desembolsos) }}</strong>
                  </template>
                </Column>

                <Column field="amortizacion" header="Amortización">
                  <template #body="{ data }">
                    {{ hub.moneyFull(data.amortizacion) }}
                  </template>
                  <template #footer>
                    <strong>{{ hub.moneyFull(hub.productTotals.amortizacion) }}</strong>
                  </template>
                </Column>

                <Column field="presupuesto" header="Presupuesto">
                  <template #body="{ data }">
                    {{ hub.moneyFull(data.presupuesto) }}
                  </template>
                  <template #footer>
                    <strong>{{ hub.moneyFull(hub.productTotals.presupuesto) }}</strong>
                  </template>
                </Column>
                <Column field="diferenciaPresupuesto" header="Brecha">
                  <template #body="{ data }">
                    <strong
                        :class="Number(data.stock || 0) - Number(data.presupuesto || 0) >= 0 ? 'text-green' : 'text-danger'">
                      {{ hub.signedMoneyFull(Number(data.stock || 0) - Number(data.presupuesto || 0)) }}
                    </strong>
                  </template>

                  <template #footer>
                    <strong
                        :class="Number(hub.productTotals.stock || 0) - Number(hub.productTotals.presupuesto || 0) >= 0 ? 'text-green' : 'text-danger'">
                      {{ hub.signedMoneyFull(Number(hub.productTotals.stock || 0) - Number(hub.productTotals.presupuesto || 0)) }}
                    </strong>
                  </template>
                </Column>
                <Column field="cumplimientoPct" header="Cumplimiento">
                  <template #body="{ data }">
                    <div class="compliance-cell">
                      <div class="compliance-head">
                        <strong :class="Number(data.cumplimientoPct || 0) >= 100 ? 'text-green' : 'text-danger'">
                          {{ hub.percent(data.cumplimientoPct) }}
                        </strong>
                        <span
                            class="compliance-status"
                            :class="Number(data.cumplimientoPct || 0) >= 100 ? 'is-good' : 'is-risk'"
                        >
            {{ Number(data.cumplimientoPct || 0) >= 100 ? 'Meta alcanzada' : 'Bajo meta' }}
          </span>
                      </div>

                      <div class="compliance-bar-wrap">
                        <div class="compliance-bar-track">
                          <div class="compliance-bar-marker"></div>
                          <div
                              class="compliance-bar-fill"
                              :class="Number(data.cumplimientoPct || 0) >= 100 ? 'fill-good' : 'fill-risk'"
                              :style="{ width: Math.min(Math.max(Number(data.cumplimientoPct || 0), 0), 100) + '%' }"
                          ></div>
                        </div>

                        <small v-if="Number(data.cumplimientoPct || 0) > 100" class="compliance-extra good">
                          +{{ (Number(data.cumplimientoPct || 0) - 100).toFixed(2) }} pp sobre meta
                        </small>
                        <small v-else-if="Number(data.cumplimientoPct || 0) < 100" class="compliance-extra risk">
                          -{{ (100 - Number(data.cumplimientoPct || 0)).toFixed(2) }} pp para meta
                        </small>
                        <small v-else class="compliance-extra neutral">
                          Meta exacta
                        </small>
                      </div>
                    </div>
                  </template>

                  <template #footer>
                    <div class="compliance-footer-total">
                      <strong :class="Number(hub.productTotals.cumplimientoPct || 0) >= 100 ? 'text-green' : 'text-danger'">
                        {{ hub.percent(hub.productTotals.cumplimientoPct) }}
                      </strong>
                    </div>
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>

          <Card>
            <template #title>Ranking por oficial de negocios</template>
            <template #content>
              <DataTable
                  :value="hub.oficiales"
                  v-model:first="oficialesFirst"
                  responsive-layout="scroll"
                  paginator
                  :rows="15"
                  :rowsPerPageOptions="[15, 30, 50, 100]"
                  sortField="desembolso"
                  :sortOrder="-1"
              >
                <Column header="#" style="width:42px;text-align:center">
                  <template #body="{ index }"><span class="rank-badge">{{ oficialesFirst + index + 1 }}</span>
                  </template>
                </Column>
                <Column field="oficial" header="Oficial"/>
                <Column field="nombreAgencia" header="Agencia"/>
                <Column field="sucursal" header="Sucursal"/>
                <Column header="Desembolso USD" sortable sort-field="desembolso">
                  <template #body="{ data }">
                    <strong>{{ hub.formatDesembolsoMiles(data.desembolso) }}</strong>
                  </template>
                </Column>
                <Column header="% aporte" sortable sort-field="participacionAportePct">
                  <template #body="{ data }">
                    <div class="rank-bar-wrap">
                      <div
                          class="rank-bar"
                          :style="{
            width: Math.min(Number(data.participacionAportePct) || 0, 100).toFixed(1) + '%'
          }"
                      ></div>
                      <span>{{ hub.percent(data.participacionAportePct) }}</span>
                    </div>
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </section>
</template>
