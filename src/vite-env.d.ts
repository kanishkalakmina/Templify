/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of a Templify report server. Leave unset for the normal case —
   * the app probes its own origin, which is what makes the single-container
   * deployment work with no build-time configuration.
   */
  readonly VITE_TEMPLIFY_SERVER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
