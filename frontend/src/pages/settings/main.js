import { createApp } from 'vue'
import { createPinia } from 'pinia'
import SettingsPage from './SettingsPage.vue'
import '../../styles/global.scss'

const app = createApp(SettingsPage)
app.use(createPinia())
app.mount('#app')
