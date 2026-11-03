import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import handler from './server/handler';
export default defineConfig({ plugins: [react(), { name: 'efb-development-api', configureServer(server) { server.middlewares.use('/api/efb', (req, res) => { void handler(req, res); }); } }], base: './' });
