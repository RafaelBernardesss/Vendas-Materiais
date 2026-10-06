import { defineConfig } from 'vite';

const paginas = ['index', 'login', 'cadastro', 'carrinho', 'checkout', 'meus-materiais', 'admin', 'produto'];

export default defineConfig({
  base: '/',
  server: {
    port: 5173,
    proxy: {
      // Em desenvolvimento o Vite encaminha a API para o Express (porta 3000)
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(paginas.map((p) => [p, `./${p}.html`])),
    },
  },
});
