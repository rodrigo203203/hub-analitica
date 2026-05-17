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
              <span>Captaciones · Tendencias</span>
              <h3>Tendencias de captaciones</h3>
              <small>Corte {{ hub.captacionesPeriod }} · Clasificación por comportamiento</small>
            </div>
            <Tag severity="info" value="Tendencias"/>
          </div>
          <div class="">
            <Card class="elevated-card">
              <template #title>
                <div class="card-title-rich">
                  <div class="card-title-icon bg-blue">
                    <font-awesome-icon icon="table-cells"/>
                  </div>
                  <div>
                    <strong>Detalle de tendencia por agencia</strong>
                    <small>Captación total, brecha y categoría por agencia</small>
                  </div>
                </div>
              </template>

              <template #content>
                <DataTable
                    :value="hub.captacionesByAgencia"
                    responsive-layout="scroll"
                    showGridlines
                    sortField="categoriaTendencia"
                    :sortOrder="-1"
                    paginator
                    :rows="12"
                    :rowsPerPageOptions="[12, 24, 50, 100]"
                >
                  <Column field="nombreAgencia" header="Agencia"/>

                  <Column field="ejecutadaCaptaciones" header="Captación total">
                    <template #body="{ data }">
                      <strong>{{ hub.moneyFull(data.ejecutadaCaptaciones) }}</strong>
                    </template>
                  </Column>

                  <Column field="brechaCaptaciones" header="Brecha vs presupuesto">
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

                  <Column field="categoriaTendencia" header="Categoría">
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
        <section
  </section>
</template>
