import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faArrowRight,
  faArrowTrendUp,
  faBars,
  faBolt,
  faBrain,
  faBuildingColumns,
  faBullseye,
  faChartLine,
  faChartPie,
  faChartSimple,
  faChevronDown,
  faCircleCheck,
  faClock,
  faDatabase,
  faGaugeHigh,
  faHouse,
  faLayerGroup,
  faMessage,
  faRotate,
  faSackDollar,
  faShieldHalved,
  faTableCells,
  faTriangleExclamation,
  faUserTie,
  faXmark
} from '@fortawesome/free-solid-svg-icons';
import App from './App.vue';
import './styles.css';

library.add(
  faArrowRight,
  faArrowTrendUp,
  faBars,
  faBolt,
  faBrain,
  faBuildingColumns,
  faBullseye,
  faChartLine,
  faChartPie,
  faChartSimple,
  faChevronDown,
  faCircleCheck,
  faClock,
  faDatabase,
  faGaugeHigh,
  faHouse,
  faLayerGroup,
  faMessage,
  faRotate,
  faSackDollar,
  faShieldHalved,
  faTableCells,
  faTriangleExclamation,
  faUserTie,
  faXmark
);

createApp(App)
  .use(PrimeVue, {
    theme: {
      preset: Aura,
      options: {
        prefix: 'p',
        darkModeSelector: '.dark-mode',
        cssLayer: false
      }
    },
    ripple: true
  })
  .component('FontAwesomeIcon', FontAwesomeIcon)
  .mount('#app');
