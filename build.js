import esbuild from 'esbuild';
const {build} = esbuild;

build({
    entryPoints: [
        './nft/index.ts'
    ],
    outdir: './dist',
    minify: false,
    bundle: false
}).catch(() => process.exit(1));
