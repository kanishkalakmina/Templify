/**
 * Bundles the server into a single CommonJS file.
 *
 * esbuild reads `paths` from tsconfig.server.json, so the `@/` alias used
 * throughout `src/` resolves without extra configuration — which is what lets
 * the server import the editor's domain and rendering modules unchanged.
 *
 * Runtime dependencies stay external and are installed in the image; only our
 * own code is bundled.
 */

import esbuild from 'esbuild'

const external = ['express', 'react', 'react-dom', 'react-dom/server', 'puppeteer-core']

await esbuild.build({
  entryPoints: ['server/index.ts'],
  outfile: 'dist-server/index.cjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  tsconfig: 'tsconfig.server.json',
  jsx: 'automatic',
  // esbuild escapes non-ASCII to \uXXXX by default, which triples the size of
  // the Sinhala and Tamil catalogues and makes the bundle unsearchable. The
  // rendered HTML already declares UTF-8.
  charset: 'utf8',
  external,
  minify: false,
  sourcemap: false,
  logLevel: 'info',
})

console.log('Server bundled to dist-server/index.cjs')
