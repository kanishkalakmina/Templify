/**
 * The built-in template catalogue.
 *
 * Twenty-six starting points across seven groups. Each entry is an *option set*
 * over one of the four layout architectures rather than a hand-built page, so
 * the catalogue stays small and consistent.
 *
 * Built-ins are compiled into the bundle rather than stored, which is what makes
 * them structurally immutable — there is no write path to a `builtIn: true`
 * record. Using one duplicates it (architecture NFR-005).
 *
 * No React.
 */

import type { Orientation, PageSize, ReportTemplate, TemplateCategory } from '@/types/template'
import { buildLayout, type LayoutArchitecture, type LayoutOptions } from './layouts'
import { initialVersion } from '@/services/versioning'
import { DEFAULT_MARGINS } from '@/services/templateCatalog'

export interface BuiltInSpec {
  id: string
  name: string
  category: TemplateCategory
  description: string
  architecture: LayoutArchitecture
  options: LayoutOptions
  size?: PageSize
  orientation?: Orientation
}

export interface LibraryGroup {
  name: string
  category: TemplateCategory
  specs: BuiltInSpec[]
}

/** A fixed origin date keeps built-in timestamps stable across reloads. */
const CATALOGUE_DATE = '2026-08-01T09:00:00.000Z'

export function specToTemplate(spec: BuiltInSpec): ReportTemplate {
  const accent = spec.options.accent ?? '#2F6FED'
  const template: ReportTemplate = {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    description: spec.description,
    version: 1,
    builtIn: true,
    archived: false,
    createdAt: CATALOGUE_DATE,
    updatedAt: CATALOGUE_DATE,
    page: {
      size: spec.size ?? 'A4',
      orientation: spec.orientation ?? 'portrait',
      margins: { ...DEFAULT_MARGINS },
      background: '#FFFFFF',
    },
    branding: {
      primaryColor: accent,
      secondaryColor: '#0F172A',
      defaultLogo: '{{company.logo}}',
      defaultFooter: 'Thank you for your business.',
      fontFamily: spec.options.serif
        ? "'Source Serif 4', Georgia, serif"
        : "'IBM Plex Sans', system-ui, sans-serif",
    },
    variables: [],
    elements: buildLayout(spec.architecture, spec.options),
    versions: [],
  }
  return { ...template, versions: [initialVersion(template, 'Built-in layout')] }
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                   */
/* -------------------------------------------------------------------------- */

export const LIBRARY_GROUPS: LibraryGroup[] = [
  {
    name: 'Invoices',
    category: 'invoice',
    specs: [
      {
        id: 'invoice-modern',
        name: 'Invoice Modern',
        category: 'invoice',
        description: 'Professional blue-accent invoice with QR and totals block.',
        architecture: 'doc',
        options: { accent: '#2F6FED', qr: true },
      },
      {
        id: 'invoice-classic',
        name: 'Invoice Classic',
        category: 'invoice',
        description: 'Traditional serif business invoice, no accent fills.',
        architecture: 'doc',
        options: { accent: '#111827', serif: true, plain: true },
      },
      {
        id: 'invoice-corporate',
        name: 'Invoice Corporate',
        category: 'invoice',
        description: 'Strong header band with reversed branding.',
        architecture: 'doc',
        options: { accent: '#0F3D8C', band: true },
      },
      {
        id: 'invoice-minimal',
        name: 'Invoice Minimal',
        category: 'invoice',
        description: 'Monochrome invoice with generous whitespace.',
        architecture: 'doc',
        options: { accent: '#0F172A', plain: true },
      },
      {
        id: 'invoice-professional',
        name: 'Invoice Professional',
        category: 'invoice',
        description: 'Teal accent with QR verification block.',
        architecture: 'doc',
        options: { accent: '#0F766E', qr: true },
      },
      {
        id: 'invoice-bold',
        name: 'Invoice Bold',
        category: 'invoice',
        description: 'Oversized display title for high-impact billing.',
        architecture: 'doc',
        options: { accent: '#DC2626', big: true },
      },
    ],
  },
  {
    name: 'Quotations',
    category: 'quotation',
    specs: [
      {
        id: 'quotation-modern',
        name: 'Quotation Modern',
        category: 'quotation',
        description: 'Violet-accent quotation with a scope table.',
        architecture: 'doc',
        options: { accent: '#5B21B6', title: '{{@t.quotation}}', itemLabel: '{{@t.scope}}' },
      },
      {
        id: 'quotation-corporate',
        name: 'Quotation Corporate',
        category: 'quotation',
        description: 'Banded corporate quotation for formal proposals.',
        architecture: 'doc',
        options: { accent: '#1E3A8A', band: true, title: '{{@t.quotation}}' },
      },
      {
        id: 'quotation-simple',
        name: 'Quotation Simple',
        category: 'quotation',
        description: 'Plain monochrome quotation, no fills.',
        architecture: 'doc',
        options: { accent: '#0F172A', plain: true, title: '{{@t.quotation}}' },
      },
    ],
  },
  {
    name: 'Receipts',
    category: 'receipt',
    specs: [
      {
        id: 'receipt-modern',
        name: 'Receipt Modern',
        category: 'receipt',
        description: 'Teal receipt with QR for transaction lookup.',
        architecture: 'doc',
        options: { accent: '#0F766E', title: '{{@t.receipt}}', qr: true },
      },
      {
        id: 'receipt-compact',
        name: 'Receipt Compact',
        category: 'receipt',
        description: 'A5 receipt for short transactions.',
        architecture: 'doc',
        options: { accent: '#0F172A', plain: true, title: '{{@t.receipt}}' },
        size: 'A5',
      },
      {
        id: 'receipt-professional',
        name: 'Receipt Professional',
        category: 'receipt',
        description: 'Slate-toned receipt for corporate accounts.',
        architecture: 'doc',
        options: { accent: '#334155', title: '{{@t.receipt}}' },
      },
    ],
  },
  {
    name: 'Business Reports',
    category: 'report',
    specs: [
      {
        id: 'business-report',
        name: 'Business Report',
        category: 'report',
        description: 'KPI row, summary, chart and line items.',
        architecture: 'report',
        options: { accent: '#2F6FED' },
      },
      {
        id: 'financial-report',
        name: 'Financial Report',
        category: 'report',
        description: 'Financial period report with totals breakdown.',
        architecture: 'report',
        options: { accent: '#0F766E', title: 'Financial Report' },
      },
      {
        id: 'sales-report',
        name: 'Sales Report',
        category: 'report',
        description: 'Sales performance with amber accent.',
        architecture: 'report',
        options: { accent: '#B45309', title: 'Sales Report' },
      },
      {
        id: 'monthly-report',
        name: 'Monthly Report',
        category: 'report',
        description: 'Serif monthly summary for stakeholder circulation.',
        architecture: 'report',
        options: { accent: '#4C1D95', title: 'Monthly Report', serif: true },
      },
    ],
  },
  {
    name: 'Certificates',
    category: 'certificate',
    specs: [
      {
        id: 'certificate-modern',
        name: 'Certificate Modern',
        category: 'certificate',
        description: 'Double-ruled certificate with QR verification.',
        architecture: 'certificate',
        options: { accent: '#5B7CFA' },
      },
      {
        id: 'certificate-classic',
        name: 'Certificate Classic',
        category: 'certificate',
        description: 'Gold-bordered certificate with signature lines.',
        architecture: 'certificate',
        options: { accent: '#8A6D1F', title: 'CERTIFICATE OF ACHIEVEMENT' },
      },
      {
        id: 'certificate-minimal',
        name: 'Certificate Minimal',
        category: 'certificate',
        description: 'Restrained monochrome award certificate.',
        architecture: 'certificate',
        options: { accent: '#0F172A', title: 'CERTIFICATE' },
      },
    ],
  },
  {
    name: 'HR',
    category: 'hr',
    specs: [
      {
        id: 'payslip-modern',
        name: 'Payslip',
        category: 'hr',
        description: 'Employee payslip with earnings and deductions.',
        architecture: 'payslip',
        options: { accent: '#0F766E' },
      },
      {
        id: 'employee-report',
        name: 'Employee Report',
        category: 'hr',
        description: 'Per-employee performance summary.',
        architecture: 'report',
        options: { accent: '#334155', title: 'Employee Report' },
      },
      {
        id: 'employment-certificate',
        name: 'Employment Certificate',
        category: 'hr',
        description: 'Formal confirmation of employment.',
        architecture: 'certificate',
        options: { accent: '#334155', title: 'CERTIFICATE OF EMPLOYMENT' },
      },
    ],
  },
  {
    name: 'Other',
    category: 'other',
    specs: [
      {
        id: 'delivery-note',
        name: 'Delivery Note',
        category: 'other',
        description: 'Goods dispatch note with itemised contents.',
        architecture: 'doc',
        options: { accent: '#334155', title: '{{@t.deliveryNote}}', plain: true, itemLabel: '{{@t.goods}}' },
      },
      {
        id: 'purchase-order',
        name: 'Purchase Order',
        category: 'other',
        description: 'Supplier purchase order with order reference.',
        architecture: 'doc',
        options: { accent: '#1D4ED8', title: '{{@t.purchaseOrder}}' },
      },
      {
        id: 'audit-report',
        name: 'Audit Report',
        category: 'other',
        description: 'Multi-section audit report with KPIs and chart.',
        architecture: 'report',
        options: { accent: '#9F1239', title: 'Security Audit Report' },
      },
      {
        id: 'custom-report',
        name: 'Custom Report',
        category: 'other',
        description: 'Neutral report scaffold to build on.',
        architecture: 'report',
        options: { accent: '#0F172A', title: 'Custom Report' },
      },
    ],
  },
]

export const BUILT_IN_SPECS: BuiltInSpec[] = LIBRARY_GROUPS.flatMap((group) => group.specs)

export const BUILT_IN_TEMPLATES: ReportTemplate[] = BUILT_IN_SPECS.map(specToTemplate)

export function builtInById(id: string): ReportTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id)
}

export function specById(id: string): BuiltInSpec | undefined {
  return BUILT_IN_SPECS.find((s) => s.id === id)
}
