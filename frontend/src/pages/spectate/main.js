import { createApp } from 'vue'
import { createPinia } from 'pinia'
import SpectatePage from './SpectatePage.vue'
import '../../styles/global.scss'

const app = createApp(SpectatePage)
app.use(createPinia())
app.mount('#app')
