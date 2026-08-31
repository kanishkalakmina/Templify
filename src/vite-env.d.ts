/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of a Templify report server. Leave unset for the normal case —
   * the app probes its own origin, which is what makes the single-container
   * deployment work with no build-time configuration.
   */
  readonly VITE_TEMPLIFY_SERVER?: string
  /**
   * API key for a server started with `TEMPLIFY_API_KEY`, sent as
   * `Authorization: Bearer …` on catalogue and render calls.
   *
   * Compiled into the bundle, and the bundle is served by the server it
   * authenticates against — so treat it as public to anyone who can load the
   * editor. It exists so that enabling auth does not silently empty the
   * workspace (#11), not as a security boundary; that is #13.
   */
  readonly VITE_TEMPLIFY_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
