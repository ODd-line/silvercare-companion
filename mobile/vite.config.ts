import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
let watchTestMode=false;
export default defineConfig({root:path.resolve('mobile'),plugins:[react(),{
	name:'watch-build-mode',
	configResolved(config){watchTestMode=config.env.VITE_WATCH_TEST_MODE==='true';},
	writeBundle(){fs.writeFileSync(path.resolve('mobile-www/watch-build.json'),JSON.stringify({format:1,watchTestMode})+'\n');},
}],resolve:{alias:{'@':path.resolve('.')}},build:{outDir:path.resolve('mobile-www'),emptyOutDir:true},publicDir:path.resolve('public')});
