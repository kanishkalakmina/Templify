# Security Policy

## Supported versions

Templify is pre-1.0 in practice: fixes land on `main` and in the next published image.
Please test against the latest `ghcr.io/kanishkalakmina/templify:latest` before reporting.

## Reporting a vulnerability

**Please do not open a public issue.**

Use GitHub's private reporting:
[**Report a vulnerability**](https://github.com/kanishkalakmina/Templify/security/advisories/new)

Include what you can — affected version, reproduction steps, and what an attacker gains.
You will get an acknowledgement within a few days. This is a small project maintained in
spare time, so please allow reasonable time for a fix before disclosing publicly.

## Where the risk actually is

Templify is designed to run **inside your own network**, which is a deliberate part of its
security posture: report payloads contain invoices, payslips and audit findings, and they
never leave your perimeter. The areas most worth scrutiny:

- **Template files are untrusted input.** A `.templify` file is imported from wherever the
  user got it. Conditions are evaluated by a hand-written parser precisely so a template
  can never execute code — `eval` and `new Function` are prohibited in this codebase. A way
  around that is a genuine vulnerability.
- **The render server runs headless Chromium** over template-authored HTML. Sandbox escape,
  SSRF via a template-supplied URL, or local file reads through an image binding all matter.
- **The API is unauthenticated by default.** That is intentional for a container on a
  trusted network; set `TEMPLIFY_API_KEY` to require `Authorization: Bearer`. Reports that
  amount to "the open API is open" are not vulnerabilities, but a way to *bypass* a
  configured key is.
- **Denial of service through a malicious payload** — an array large enough to hang the
  renderer, for example. Renders are capped by `TEMPLIFY_RENDER_TIMEOUT_MS`, and gaps in
  that bound are worth reporting.

## Out of scope

- The prototype's `localStorage` mode, which stores design data only, in the user's own browser
- Missing rate limiting on a self-hosted instance you control
- The QR and barcode renderers, which are documented as non-scannable visual placeholders
