/**
 * The data side of the contract: what a customer application sends, and what the
 * renderer produces from it. No React, no DOM.
 */

/** Arbitrary JSON supplied by the calling application. */
export type ReportData = Record<string, unknown>

/** Body of `POST /api/reports/render`. */
export interface RenderRequest {
  /** `invoice-modern`, or `invoice-modern:v2` to pin a version. */
  templateId: string
  data: ReportData
  options?: {
    format?: 'pdf' | 'html'
    filename?: string
  }
}

/** A node in the "Insert Variable" tree, derived from the applied test data. */
export interface VariableNode {
  /** Dot path, e.g. `invoice.total`. Array members use `items[]`. */
  path: string
  key: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'null'
  /** The binding token inserted on click, e.g. `{{invoice.total}}`. */
  token: string
  preview: string
  children?: VariableNode[]
  /** True for `items[]` — such a node is a valid table/repeater data source. */
  isArrayRoot?: boolean
}
