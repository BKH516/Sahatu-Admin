import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    
    return {
      base: '/Sahatu-Admin/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'https://sahtee.evra-co.com',
            changeOrigin: true,
            secure: false,
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // إخفاء source maps في Production
        sourcemap: false,
        // تقليل حجم الملفات
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
          },
          format: {
            comments: false
          }
        },
        // تقسيم الكود لتحسين الأداء
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            },
            // إخفاء أسماء الملفات الحقيقية
            chunkFileNames: isProd ? 'assets/[hash].js' : 'assets/[name]-[hash].js',
            entryFileNames: isProd ? 'assets/[hash].js' : 'assets/[name]-[hash].js',
            assetFileNames: isProd ? 'assets/[hash].[ext]' : 'assets/[name]-[hash].[ext]',
          }
        },
        reportCompressedSize: false,
        chunkSizeWarningLimit: 1000,
      },
      esbuild: {
        drop: isProd ? ['console', 'debugger'] : [],
      }
    };
});
