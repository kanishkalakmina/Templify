import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The proxy is the entire reason this example needs no backend of its own.
 *
 * Templify sends no CORS headers, so a page served from :5181 cannot call
 * :8080 directly — the browser discards the response before this app ever
 * sees it. Proxying `/api` makes the two look like one origin.
 *
 * That single line buys two things: the browser is allowed to call the render
 * endpoint, and the print popup is allowed to read the document inside its own
 * iframe (see BillPreview.jsx — cross-origin frames cannot be measured).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5181,
    proxy: { '/api': 'http://localhost:8080' },
  },
})
