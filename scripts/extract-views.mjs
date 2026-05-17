/**
 * Extrae secciones de template de App.vue y genera vistas.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const appPath = path.join(ROOT, 'src/App.vue');
const content = fs.readFileSync(appPath, 'utf8');
const templateMatch = content.match(/<template>([\s\S]*)<\/template>/);
if (!templateMatch) throw new Error('No template');
const template = templateMatch[1];

const sections = [
  { file: 'src/views/PortadaView.vue', start: "v-show=\"active === 'portada'\"", end: "v-show=\"active === 'gobernanza'\"" },
  { file: 'src/views/oportunidades/ResumenOpView.vue', start: "v-show=\"active === 'op-resumen'\"", end: "v-show=\"active === 'op-maduracion'\"" },
  { file: 'src/views/oportunidades/MaduracionView.vue', start: "v-show=\"active === 'op-maduracion'\"", end: "v-show=\"active === 'op-lcf'\"" },
  { file: 'src/views/oportunidades/LcfView.vue', start: "v-show=\"active === 'op-lcf'\"", end: "v-show=\"active === 'desempeno'\"" },
  { file: 'src/views/cartera/DesempenoView.vue', start: "v-show=\"active === 'desempeno'\"", end: "v-show=\"active === 'riesgo-pd'\"" },
  { file: 'src/views/cartera/RiesgoPdView.vue', start: "v-show=\"active === 'riesgo-pd'\"", end: "v-show=\"active === 'proyeccion'\"" },
  { file: 'src/views/cartera/ProyeccionView.vue', start: "v-show=\"active === 'proyeccion'\"", end: "v-show=\"active === 'sistema'\"" },
  { file: 'src/views/cartera/SistemaView.vue', start: "v-show=\"active === 'sistema'\"", end: "v-show=\"active === 'agente'\"" },
  { file: 'src/views/captaciones/DesempenoCaptView.vue', start: "v-show=\"active === 'capt-desempeno'\"", end: "v-show=\"active === 'capt-tendencias'\"" },
  { file: 'src/views/captaciones/TendenciasView.vue', start: "v-show=\"active === 'capt-tendencias'\"", end: "v-show=\"active === 'capt-fuga'\"" },
  { file: 'src/views/captaciones/FugaView.vue', start: "v-show=\"active === 'capt-fuga'\"", end: "v-show=\"active === 'actualizaciones'\"" }
];

function extractSection(startMarker, endMarker) {
  const startIdx = template.indexOf(startMarker);
  if (startIdx === -1) return null;
  const endIdx = endMarker ? template.indexOf(endMarker, startIdx + 1) : template.length;
  let block = template.slice(startIdx, endIdx);
  block = block.replace(/<section[^>]*v-show[^>]*>\s*/i, '');
  block = block.replace(/\s*<\/section>\s*$/i, '');
  return block.trim();
}

const viewScript = `<script setup>
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

`;

const depth = (file) => (file.match(/\//g) || []).length - 1;
const importPath = (file) => '../'.repeat(depth) + 'composables/useHubLogic.js';

for (const sec of sections) {
  const block = extractSection(sec.start, sec.end);
  if (!block) {
    console.warn('Skip', sec.file);
    continue;
  }
  const rel = path.relative(path.dirname(path.join(ROOT, sec.file)), path.join(ROOT, 'src/composables/useHubLogic.js'));
  const script = viewScript.replace('../composables/useHubLogic.js', rel.replace(/\\/g, '/'));
  const outPath = path.join(ROOT, sec.file);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // Prefix template bindings with hub. for common identifiers
  let tpl = block.replace(/\{\{ /g, '{{ hub.').replace(/:([\w]+)="/g, (m, p) => {
    const skip = ['class', 'style', 'type', 'key', 'for', 'if', 'show', 'else', 'model', 'slot', 'name', 'severity', 'value', 'icon', 'label', 'rows', 'options', 'data', 'field', 'header', 'sortField', 'sortOrder', 'rowsPerPageOptions', 'responsive', 'paginator', 'showGridlines', 'append', 'optionLabel', 'optionValue', 'autoResize', 'placeholder', 'maxSelectedLabels', 'display', 'loading', 'disabled', 'outlined', 'rounded', 'text', 'size'];
    if (skip.includes(p)) return m;
    return `:hub.${p}="`;
  });
  // Fix double hub.hub.
  tpl = tpl.replace(/hub\.hub\./g, 'hub.');
  // Fix v-model
  tpl = tpl.replace(/v-model="(?!hub\.)/g, 'v-model="hub.');
  const vue = `${script}\n<template>\n  <section class="page-grid">\n${tpl}\n  </section>\n</template>\n`;
  fs.writeFileSync(outPath, vue);
  console.log('Created', sec.file);
}
