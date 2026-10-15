/**
 * Response header encoding.
 *
 * Node validates header values against latin-1 and throws `ERR_INVALID_CHAR`
 * on anything outside it. Two values on the render route are built from input
 * the server does not control — `options.filename` from the request body, and
 * the missing-binding list from paths written into the template — so both can
 * contain characters that make `setHeader` throw and turn a successful render
 * into a 500.
 *
 * That is not hypothetical for this product: the document locales include
 * Sinhala and Tamil, so an integrator naming the file in the language of the
 * document it contains is the obvious thing to do, and was the one input that
 * broke it.
 *
 * CRLF injection is not the concern — Node rejects `\r` and `\n` outright.
 * These helpers exist so that legitimate non-ASCII input survives instead of
 * crashing the request.
 */

/** Characters RFC 8187 allows unescaped in an `ext-value`. */
const EXT_VALUE_ESCAPES = /['()*!]/g

/**
 * Percent-encodes a string for an RFC 8187 `ext-value`.
 *
 * `encodeURIComponent` leaves a handful of characters that are not `attr-char`,
 * so they are escaped afterwards rather than hand-rolling the whole encoder.
 */
function extValue(value: string): string {
  return encodeURIComponent(value).replace(
    EXT_VALUE_ESCAPES,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/**
 * Reduces a filename to something safe inside a quoted `filename="…"`.
 *
 * Path separators go too: the parameter is a *suggested* name, and a client
 * that treats a traversal sequence as a path is a client we should not be
 * handing one to.
 */
function asciiFilename(value: string): string {
  return value
    .replace(/[\\/]+/g, '-')
    // Anything outside printable ASCII, plus the quote and backslash that would
    // terminate or escape the quoted string.
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/["\\]/g, '-')
    .trim()
}

/**
 * Builds a `Content-Disposition` carrying both forms: the ASCII `filename` that
 * every client understands, and the RFC 8187 `filename*` that modern ones
 * prefer and which preserves the original characters exactly.
 */
export function contentDisposition(
  disposition: 'inline' | 'attachment',
  filename: string,
): string {
  // Control characters are stripped from both forms, not just the ASCII one.
  // Percent-encoding makes them inert in the header, but a client that decodes
  // `filename*` and writes the result to disk should not receive a newline.
  const clean = filename.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
  const ascii = asciiFilename(clean)
  const header = `${disposition}; filename="${ascii || 'document'}"`
  // Only worth sending when it would actually say something different — an
  // ASCII name needs no second copy of itself, and an empty one has nothing
  // to preserve.
  if (!ascii || ascii === clean) return header
  return `${header}; filename*=UTF-8''${extValue(clean)}`
}

/**
 * Joins values into a comma-separated header, percent-encoding each one.
 *
 * Encoding also escapes any comma inside a value, so the separator stays
 * unambiguous and a consumer can `split(',')` then decode each part.
 */
export function headerList(values: readonly string[]): string {
  return values.map(extValue).join(',')
}
