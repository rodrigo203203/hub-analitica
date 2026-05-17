<script setup>
import { useHubLogic } from '../composables/useHubLogic.js';
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
          <div class="hero-panel hero-panel-summary">
            <div class="hero-copy">
              <span class="section-kicker">Hub Analítico BNB · Resumen ejecutivo</span>
              <h2>Portada ejecutiva</h2>
              <p>
                Vista resumida del estado actual de cartera, productos, sistema financiero y desempeño comercial,
                construida únicamente con fuentes activas y datos reales disponibles.
              </p>

              <div class="hero-meta-list">
                <div class="hero-meta-item">
                  <font-awesome-icon icon="clock"/>
                  <span>Actualizado al {{ hub.portadaUpdatedAt }}</span>
                </div>
                <div class="hero-meta-item">
                  <font-awesome-icon icon="database"/>
                  <span>{{ hub.dataMode === 'sql-server' ? 'Datos en vivo desde SQL Server' : 'Modo demo / sin credenciales'
                    }}</span>
                </div>
                <div class="hero-meta-item">
                  <font-awesome-icon icon="table-cells"/>
                  <span>{{ hub.portadaTopProducts.length }} productos visibles en resumen</span>
                </div>
              </div>
            </div>
          </div>

          <div class="summary-kpi-grid">
            <Card v-for="item in hub.portadaKpiCards" :key="item.label" class="summary-kpi-card">
              <template #content>
                <div class="summary-kpi-top">
                  <span>{{ item.label }}</span>
                  <div class="summary-kpi-icon">
                    <font-awesome-icon :icon="item.icon"/>
                  </div>
                </div>
                <strong>{{ item.value }}</strong>
                <small>{{ item.helper }}</small>
              </template>
            </Card>
          </div>

          <div class="section-header">
            <div>
              <span>Resumen integrado</span>
              <h3>Captaciones, maduración, LCF y cartera compartida</h3>
            </div>
            <Tag severity="info" value="Nuevas fuentes"/>
          </div>

          <div class="summary-kpi-grid">
            <Card
                v-for="item in hub.portadaIntegratedSummaryCards"
                :key="item.label"
                class="summary-kpi-card"
                :class="`summary-tone-${item.tone}`"
            >
              <template #content>
                <div class="summary-kpi-top">
                  <span>{{ item.label }}</span>
                  <div class="summary-kpi-icon">
                    <font-awesome-icon :icon="item.icon"/>
                  </div>
                </div>
                <strong>{{ item.value }}</strong>
                <small>{{ item.helper }}</small>
              </template>
            </Card>
          </div>

          <div class="system-grid portada-integrated-grid">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-amber">
                    <font-awesome-icon icon="triangle-exclamation"/>
                  </div>
                  <div>
                    <strong>Alertas y oportunidades ejecutivas</strong>
                    <small>Lectura rápida para priorización comercial</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="growth-leaders-grid growth-leaders-wide">
                  <div
                      v-for="alert in hub.portadaExecutiveAlerts"
                      :key="alert.title"
                      class="growth-leader-card"
                  >
                    <div class="growth-leader-head">
                      <div class="growth-rank">
                        <font-awesome-icon :icon="alert.icon"/>
                      </div>
                      <Tag
                          :severity="alert.tone === 'danger' ? 'danger' : alert.tone === 'warning' ? 'warning' : alert.tone === 'success' ? 'success' : 'info'"
                          :value="alert.tone === 'danger' ? 'Alerta' : alert.tone === 'warning' ? 'Seguimiento' : 'Oportunidad'"
                      />
                    </div>
                    <div class="growth-leader-body">
                      <strong>{{ alert.title }}</strong>
                      <span class="growth-bank">{{ alert.detail }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </Card>

            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-green">
                    <font-awesome-icon icon="lightbulb"/>
                  </div>
                  <div>
                    <strong>Top agencias por oportunidad total</strong>
                    <small>LCF no utilizado + cartera en otros bancos</small>
                  </div>
                </div>
              </template>
              <template #content>
                <DataTable
                    :value="hub.portadaOpportunityAgencyTop"
                    responsive-layout="scroll"
                    showGridlines
                >
                  <Column field="nombreAgencia" header="Agencia"/>
                  <Column field="potencialTotal" header="Potencial">
                    <template #body="{ data }">
                      <strong>{{ hub.moneyFull(data.potencialTotal) }}</strong>
                    </template>
                  </Column>
                  <Column field="cupoNoUtilizadoLcf" header="LCF">
                    <template #body="{ data }">{{ hub.moneyFull(data.cupoNoUtilizadoLcf) }}</template>
                  </Column>
                  <Column field="carteraOtrosBancos" header="Otros bancos">
                    <template #body="{ data }">{{ hub.moneyFull(data.carteraOtrosBancos) }}</template>
                  </Column>
                </DataTable>
              </template>
            </Card>
          </div>

          <div class="section-header">
            <div>
              <span>Visuales clave</span>
              <h3>Resumen gráfico del estado actual</h3>
            </div>
            <Tag severity="success" value="Resumen real"/>
          </div>

          <div class="system-grid portada-stock-grid">
            <Card class="chart-flow-full elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-green">
                    <font-awesome-icon icon="chart-line"/>
                  </div>
                  <div>
                    <strong>Stock vs presupuesto</strong>
                    <small>Serie histórica con diferencia real vs meta</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box">
                  <Chart type="line" :data="hub.flowChart" :options="hub.portadaFlowChartOptions"
                         style="width: 100%; height: 100%;"/>
                </div>
              </template>
            </Card>
          </div>

          <div class="system-grid portada-product-goal-grid">
            <Card class="chart-flow-full elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-purple">
                    <font-awesome-icon icon="chart-simple"/>
                  </div>
                  <div>
                    <strong>Cascada de brecha por producto</strong>
                    <small>Diferencia de stock actual contra meta presupuesto</small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="chart-box chart-box-product-goal">
                  <Chart
                      type="bar"
                      :data="hub.portadaProductGoalChart"
                      :options="hub.portadaProductGoalOptions"
                      style="width: 100%; height: 100%;"
                  />
                </div>
              </template>
            </Card>
          </div>

          <div class="system-grid portada-growth-grid">
            <Card class="chart-flow-full elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-blue">
                    <font-awesome-icon icon="building-columns"/>
                  </div>
                  <div>
                    <strong>Líder en crecimiento por producto</strong>
                    <small>
                      Banco con mayor crecimiento total por producto · Corte SF <strong>{{ hub.portadaGrowthLeadersPeriod
                      }}</strong>
                    </small>
                  </div>
                </div>
              </template>
              <template #content>
                <div class="growth-leaders-grid growth-leaders-wide">
                  <div
                      v-for="(item, index) in hub.portadaGrowthLeaders"
                      :key="`${item.producto}-${item.banco}`"
                      class="growth-leader-card"
                  >
                    <div class="growth-leader-head">
                      <div class="growth-rank">
                        <i class="pi pi-trophy"></i>
                        <span>#{{ hub.index + 1 }}</span>
                      </div>

                      <div class="growth-head-tags">
                        <Tag severity="info" :value="item.banco"/>
                      </div>
                    </div>

                    <div class="growth-leader-body">
                      <strong>{{ item.producto }}</strong>
                      <span class="growth-bank">
      Líder: {{ item.banco }}
    </span>
                    </div>

                    <div class="growth-leader-metrics">
                      <div>
                        <small>Crecimiento líder</small>
                        <strong :class="hub.trendClass(item.crecimientoTotal)">
                          {{ hub.signedMoneyK(item.crecimientoTotal) }}
                        </strong>
                      </div>

                      <div>
                        <small>Crecimiento % líder</small>
                        <strong :class="hub.trendClass(item.crecimientoPct)">
                          {{ item.crecimientoPct > 0 ? '+' : '' }}{{ hub.percent(item.crecimientoPct) }}
                        </strong>
                      </div>

                      <div>
                        <small>Posición BNB</small>
                        <strong>
                          {{ item.bnbPosicion ? `#${item.bnbPosicion} de ${item.totalBancos}` : 'N/D' }}
                        </strong>
                      </div>

                      <div>
                        <small>Crecimiento BNB</small>
                        <strong :class="hub.trendClass(item.bnbCrecimientoTotal)">
                          {{ item.bnbCrecimientoTotal === null ? 'N/D' : hub.signedMoneyK(item.bnbCrecimientoTotal) }}
                        </strong>
                      </div>

                      <div>
                        <small>Crecimiento % BNB</small>
                        <strong :class="hub.trendClass(item.bnbCrecimientoPct)">
                          {{ item.bnbCrecimientoPct === null || item.bnbCrecimientoPct === undefined
                                ? 'N/D'
                                : `${item.bnbCrecimientoPct > 0 ? '+' : ''}${hub.percent(item.bnbCrecimientoPct)}`
                          }}
                        </strong>
                      </div>

                      <div>
                        <small>Crecimiento total sistema</small>
                        <strong :class="hub.trendClass(item.crecimientoSistemaTotal)">
                          {{ hub.signedMoneyK(item.crecimientoSistemaTotal) }}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </section>

        <!-- ═══ GOBERNANZA ════════════════════════════════════════════════════ -->
        <section
  </section>
</template>
