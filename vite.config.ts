import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import path from 'path'

/**
 * 构建号：用于识别浏览器里跑的是哪一版前端。
 * 部署后 dist/version.json 会一并上传，页面可据此发现「代码已更新但页面未刷新」。
 */
const BUILD_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)

function versionFilePlugin(): Plugin {
  return {
    name: 'dms-version-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId: BUILD_ID, builtAt: new Date().toISOString() })
      })
    }
  }
}

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID)
  },
  plugins: [
    vue(),
    versionFilePlugin(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts'
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts'
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    },
    // pdfjs-dist v4 是纯 ESM(.mjs)，让 Vite 解析到 mjs
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/pdf.worker.min.js': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'esnext',  // pdfjs-dist v4 使用 top-level await，需要 esnext
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'pdfjs': ['pdfjs-dist'],
          'three': ['three'],
          'codemirror': ['codemirror', '@codemirror/lang-markdown', '@codemirror/lang-javascript', '@codemirror/lang-xml'],
          'uppy': ['@uppy/core', '@uppy/dashboard', '@uppy/tus'],
          'element-plus': ['element-plus', '@element-plus/icons-vue']
        }
      }
    }
  }
})
