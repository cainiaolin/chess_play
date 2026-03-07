import { createApp } from 'vue'
import { createPinia } from 'pinia'
import HomePage from './HomePage.vue'
import '../../styles/global.scss'

const app = createApp(HomePage)
app.use(createPinia())
app.mount('#app')
