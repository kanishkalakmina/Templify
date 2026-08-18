## What and why

<!-- What changed, and what problem it solves. Link the issue: Closes #123 -->

## How I verified it

<!-- Tick what you ran. All three should pass. -->

- [ ] `npm run build:all`
- [ ] `npm run verify`
- [ ] `npm run verify:render`

<!--
If this touches rendering, layout or a built-in template, the checks above are NOT
sufficient — three shipped bugs passed a fully green suite. Open the editor or render a
PDF, look at the output, and attach evidence.
-->

- [ ] I looked at the rendered output (screenshot or PDF attached below), or this change
      does not affect rendering

## Screenshots / rendered output

<!-- Before and after, if visual. -->

## Notes for the reviewer

<!-- Trade-offs, things you were unsure about, anything deliberately left out. -->

---

- [ ] I read [CONTRIBUTING.md](../CONTRIBUTING.md) and this PR does not break an
      architecture rule (no React in `types/`/`services/`, one renderer, layers depend
      downward, no `eval`, exports carry no data)
