import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: '/',
    plugins: [
      vue(),
      AutoImport({ resolvers: [ElementPlusResolver()] }),
      Components({ resolvers: [ElementPlusResolver()] })
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') }
    },
    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:3000',
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      target: 'esnext',
      // 长缓存拆分：框架/UI 库变动频率低，单独分包后业务更新不必重新下载整个主包
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('echarts') || id.includes('zrender')) return 'echarts'
            if (id.includes('element-plus') || id.includes('@element-plus')) return 'element-plus'
            if (id.includes('@vue') || id.includes('vue-router') || id.includes('vue-i18n') || id.includes('pinia') || id.includes('/vue/')) return 'vue-vendor'
            if (id.includes('axios')) return 'axios'
            return 'vendor'
          }
        }
      }
    },
    optimizeDeps: {
      esbuildOptions: { target: 'esnext' }
    }
  }
})