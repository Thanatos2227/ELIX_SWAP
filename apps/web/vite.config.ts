import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@elis/types': path.resolve(__dirname, '../../packages/types/src'),
            '@elis/chains': path.resolve(__dirname, '../../packages/chains/src'),
            '@elis/contracts': path.resolve(__dirname, '../../packages/contracts/src'),
            '@elis/tokens': path.resolve(__dirname, '../../packages/tokens/src'),
            '@elis/security': path.resolve(__dirname, '../../packages/security/src'),
            '@elis/routing': path.resolve(__dirname, '../../packages/routing/src'),
            '@elis/execution': path.resolve(__dirname, '../../packages/execution/src'),
            '@elis/sdk': path.resolve(__dirname, '../../packages/sdk/src'),
            '@elis/ui': path.resolve(__dirname, '../../packages/ui/src'),
                                                                                                                        '@': path.resolve(__dirname, './src')
        }
    },
    server: {
        port: 3000,
        host: true
    }
});
