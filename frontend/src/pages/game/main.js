import { createApp } from 'vue'
import { createPinia } from 'pinia'
import GamePage from './GamePage.vue'
import '../../styles/global.scss'

const app = createApp(GamePage)
app.use(createPinia())
app.mount('#app')
