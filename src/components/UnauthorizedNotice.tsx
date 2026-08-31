import { SERVER } from '@/data/server'

/**
 * Shown when the report server answers `/api/health` but rejects the catalogue
 * with a 401.
 *
 * It replaces what used to happen: a green "Server connected" dot, an empty
 * workspace and a toast that faded after six seconds — a combination that reads
 * as "my templates have been deleted" rather than "this server wants a key"
 * (#11).
 *
 * Persistent rather than a toast, because the condition is persistent. Nothing
 * the user does in the app will clear it; it is fixed in the deployment.
 */
export function UnauthorizedNotice() {
  return (
    <div
      role="alert"
      className="mb-5 rounded-2xl border border-[rgba(217,161,59,.4)] bg-[rgba(217,161,59,.08)] p-4"
    >
      <div className="text-[13px] font-semibold text-warn">
        This server requires an API key — your templates are safe
      </div>

      <div className="mt-[7px] text-[12.5px] leading-relaxed text-ink-2">
        The report server is running and holding your templates, but it is refusing this
        editor with a <span className="font-mono text-accent-link">401</span>. Nothing has
        been lost and nothing has been deleted — the workspace looks empty only because the
        catalogue could not be read.
      </div>

      <div className="mt-3 text-[12.5px] leading-relaxed text-muted">
        It is running with{' '}
        <span className="font-mono text-accent-link">TEMPLIFY_API_KEY</span> set. Two ways
        forward:
      </div>

      <ul className="mt-2 flex list-none flex-col gap-2 p-0 text-[12px] leading-relaxed text-muted">
        <li>
          <strong className="font-medium text-ink">Unset it</strong> and restart the
          container, if the server is only reachable from your own network. That is the
          intended single-tenant setup.
        </li>
        <li>
          <strong className="font-medium text-ink">Or rebuild the frontend</strong> with{' '}
          <span className="font-mono text-accent-link">VITE_TEMPLIFY_KEY</span> set to the
          same value, so the editor sends it.
        </li>
      </ul>

      <div className="mt-3 text-[11.5px] leading-relaxed text-faint">
        Be aware that the second option compiles the key into the bundle this server hands to
        every browser, so it is not a security boundary — it only stops the editor coming up
        empty. Keeping the instance off the public network is what actually protects it, and
        an operator login is planned.
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-toolbar p-3 font-mono text-[11px] leading-[1.7] text-ink-3">
        <pre>{`# confirm it from a terminal — the templates are still there
curl -s ${SERVER.url}/api/health
# -> {"status":"ok","templates":8,"auth":"required"}

curl -s -o /dev/null -w '%{http_code}\\n' \\
  -H "Authorization: Bearer $${SERVER.envVar}" \\
  ${SERVER.url}/api/templates
# -> 200`}</pre>
      </div>
    </div>
  )
}
