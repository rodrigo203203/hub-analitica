import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';
import { router } from './router/index.js';
import {library} from '@fortawesome/fontawesome-svg-core';
import {FontAwesomeIcon} from '@fortawesome/vue-fontawesome';
import {
    faArrowRight,
    faArrowTrendDown,
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
    faCircleExclamation,
    faCircleQuestion,
    faClock,
    faCreditCard,
    faDatabase,
    faGaugeHigh,
    faHourglass,
    faHourglassHalf,
    faHouse,
    faLayerGroup,
    faLightbulb,
    faMessage,
    faPiggyBank,
    faRankingStar,
    faRobot,
    faRotate,
    faSackDollar,
    faShieldHalved,
    faSitemap,
    faTableCells,
    faTriangleExclamation,
    faUserTie,
    faXmark
} from '@fortawesome/free-solid-svg-icons';
import App from './App.vue';
import './styles.css';

library.add(
    faArrowRight,
    faArrowTrendDown,
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
    faCircleExclamation,
    faCircleQuestion,
    faClock,
    faCreditCard,
    faDatabase,
    faGaugeHigh,
    faHourglass,
    faHourglassHalf,
    faHouse,
    faLayerGroup,
    faLightbulb,
    faMessage,
    faPiggyBank,
    faRankingStar,
    faRobot,
    faRotate,
    faSackDollar,
    faShieldHalved,
    faSitemap,
    faTableCells,
    faTriangleExclamation,
    faUserTie,
    faXmark
);

createApp(App)
    .use(createPinia())
    .use(router)
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