/**
 * Document label catalogue.
 *
 * These are the words printed *on* a report — not editor chrome. Templates
 * reference them as `{{@t.billTo}}` tokens, resolved per render request, so one
 * template renders in any language rather than needing a copy per locale.
 *
 * Adding a locale means adding one entry per key here. A missing key falls back
 * to English rather than rendering blank, because a half-translated document is
 * still usable and a blank label is not.
 *
 * No React.
 */

import { DEFAULT_LOCALE, type LocaleCode } from './locales'

/** Every label a built-in template can print. */
export type DocumentStringKey =
  // Document titles
  | 'invoice'
  | 'quotation'
  | 'receipt'
  | 'deliveryNote'
  | 'purchaseOrder'
  | 'payslip'
  // Parties
  | 'billTo'
  | 'payment'
  | 'employee'
  // Payment block
  | 'due'
  | 'method'
  | 'account'
  | 'bankTransfer'
  // Table headers
  | 'item'
  | 'scope'
  | 'goods'
  | 'description'
  | 'earnings'
  | 'qty'
  | 'units'
  | 'price'
  | 'amount'
  | 'value'
  // Totals
  | 'subtotal'
  | 'discount'
  | 'tax'
  | 'total'
  | 'gross'
  | 'deductions'
  | 'netPay'
  // Payslip meta
  | 'employeeId'
  | 'department'
  | 'engineering'
  | 'payDate'
  | 'periodEnding'
  // Reports
  | 'summary'
  | 'lineItems'
  | 'revenue'
  | 'expenses'
  | 'net'
  | 'preparedFor'
  | 'confidential'
  | 'summaryBody'
  // Certificates
  | 'certifiesThat'
  | 'certificateBody'
  | 'authorisedSignature'
  | 'issued'
  // Footers
  | 'invoiceFooter'
  | 'payslipFooter'

type Catalogue = Record<DocumentStringKey, string>

const en: Catalogue = {
  invoice: 'INVOICE',
  quotation: 'QUOTATION',
  receipt: 'RECEIPT',
  deliveryNote: 'DELIVERY NOTE',
  purchaseOrder: 'PURCHASE ORDER',
  payslip: 'PAYSLIP',

  billTo: 'BILL TO',
  payment: 'PAYMENT',
  employee: 'EMPLOYEE',

  due: 'Due',
  method: 'Method',
  account: 'Account',
  bankTransfer: 'Bank Transfer',

  item: 'Item',
  scope: 'Scope',
  goods: 'Goods',
  description: 'Description',
  earnings: 'Earnings',
  qty: 'Qty',
  units: 'Units',
  price: 'Price',
  amount: 'Amount',
  value: 'Value',

  subtotal: 'Subtotal',
  discount: 'Discount',
  tax: 'Tax',
  total: 'Total',
  gross: 'Gross',
  deductions: 'Deductions',
  netPay: 'Net pay',

  employeeId: 'Employee ID',
  department: 'Department',
  engineering: 'Engineering',
  payDate: 'Pay date',
  periodEnding: 'Period ending',

  summary: 'Summary',
  lineItems: 'Line items',
  revenue: 'Revenue',
  expenses: 'Expenses',
  net: 'Net',
  preparedFor: 'Prepared for',
  confidential: 'Confidential',
  summaryBody:
    'This period is compared against the preceding cycle. Figures are supplied by the calling application and bound to this template at render time.',

  certifiesThat: 'This certifies that',
  certificateBody:
    'has successfully completed the programme of study and met all requirements set out by the awarding body.',
  authorisedSignature: 'Authorised Signature',
  issued: 'Issued',

  invoiceFooter: 'Thank you for your business. Payment is due within 15 days.',
  payslipFooter: 'This payslip is computer generated and does not require a signature.',
}

const si: Catalogue = {
  invoice: 'ඉන්වොයිසිය',
  quotation: 'මිල ගණන්',
  receipt: 'ලදුපත',
  deliveryNote: 'බෙදාහැරීමේ සටහන',
  purchaseOrder: 'මිලදී ගැනීමේ ඇණවුම',
  payslip: 'වැටුප් පත්‍රිකාව',

  billTo: 'බිල් කරන්නේ',
  payment: 'ගෙවීම',
  employee: 'සේවකයා',

  due: 'නියමිත දිනය',
  method: 'ක්‍රමය',
  account: 'ගිණුම',
  bankTransfer: 'බැංකු හුවමාරුව',

  item: 'අයිතමය',
  scope: 'විෂය පථය',
  goods: 'භාණ්ඩ',
  description: 'විස්තරය',
  earnings: 'ආදායම්',
  qty: 'ප්‍රමාණය',
  units: 'ඒකක',
  price: 'මිල',
  amount: 'මුදල',
  value: 'වටිනාකම',

  subtotal: 'උප එකතුව',
  discount: 'වට්ටම',
  tax: 'බදු',
  total: 'මුළු එකතුව',
  gross: 'දළ වැටුප',
  deductions: 'අඩු කිරීම්',
  netPay: 'ශුද්ධ වැටුප',

  employeeId: 'සේවක අංකය',
  department: 'අංශය',
  engineering: 'ඉංජිනේරු',
  payDate: 'ගෙවීම් දිනය',
  periodEnding: 'කාල සීමාව අවසන්',

  summary: 'සාරාංශය',
  lineItems: 'අයිතම',
  revenue: 'ආදායම',
  expenses: 'වියදම්',
  net: 'ශුද්ධ',
  preparedFor: 'සකස් කරන ලද්දේ',
  confidential: 'රහසිගත',
  summaryBody:
    'මෙම කාල සීමාව පෙර චක්‍රය සමඟ සංසන්දනය කර ඇත. සංඛ්‍යා ලේඛන අයදුම්පත මගින් සපයා ඇති අතර ඉදිරිපත් කිරීමේදී මෙම අච්චුවට බැඳී ඇත.',

  certifiesThat: 'මෙයින් සහතික කරනු ලබන්නේ',
  certificateBody:
    'අධ්‍යයන වැඩසටහන සාර්ථකව සම්පූර්ණ කර ඇති අතර සම්මාන පිරිනමන ආයතනය විසින් නියම කරන ලද සියලු අවශ්‍යතා සපුරාලා ඇත.',
  authorisedSignature: 'බලයලත් අත්සන',
  issued: 'නිකුත් කළ දිනය',

  invoiceFooter: 'ඔබේ ව්‍යාපාරයට ස්තූතියි. ගෙවීම දින 15 ක් ඇතුළත කළ යුතුය.',
  payslipFooter: 'මෙම වැටුප් පත්‍රිකාව පරිගණකගත කර ඇති අතර අත්සනක් අවශ්‍ය නොවේ.',
}

const ta: Catalogue = {
  invoice: 'விலைப்பட்டியல்',
  quotation: 'விலைமதிப்பு',
  receipt: 'பற்றுச்சீட்டு',
  deliveryNote: 'விநியோகக் குறிப்பு',
  purchaseOrder: 'கொள்முதல் ஆணை',
  payslip: 'ஊதியச் சீட்டு',

  billTo: 'பயனர் விவரம்',
  payment: 'கட்டணம்',
  employee: 'ஊழியர்',

  due: 'உரிய தேதி',
  method: 'முறை',
  account: 'கணக்கு',
  bankTransfer: 'வங்கி பரிமாற்றம்',

  item: 'பொருள்',
  scope: 'நோக்கம்',
  goods: 'சரக்குகள்',
  description: 'விவரம்',
  earnings: 'வருவாய்',
  qty: 'அளவு',
  units: 'அலகுகள்',
  price: 'விலை',
  amount: 'தொகை',
  value: 'மதிப்பு',

  subtotal: 'கூட்டுத்தொகை',
  discount: 'தள்ளுபடி',
  tax: 'வரி',
  total: 'மொத்தம்',
  gross: 'மொத்த ஊதியம்',
  deductions: 'பிடித்தங்கள்',
  netPay: 'நிகர ஊதியம்',

  employeeId: 'ஊழியர் எண்',
  department: 'துறை',
  engineering: 'பொறியியல்',
  payDate: 'ஊதிய தேதி',
  periodEnding: 'காலம் முடிவடைகிறது',

  summary: 'சுருக்கம்',
  lineItems: 'உருப்படிகள்',
  revenue: 'வருவாய்',
  expenses: 'செலவுகள்',
  net: 'நிகர',
  preparedFor: 'தயாரிக்கப்பட்டது',
  confidential: 'இரகசியம்',
  summaryBody:
    'இந்தக் காலம் முந்தைய சுழற்சியுடன் ஒப்பிடப்படுகிறது. புள்ளிவிவரங்கள் அழைக்கும் பயன்பாட்டால் வழங்கப்பட்டு, வழங்கும் நேரத்தில் இந்த வார்ப்புருவுடன் இணைக்கப்படுகின்றன.',

  certifiesThat: 'இதன் மூலம் சான்றளிக்கப்படுகிறது',
  certificateBody:
    'படிப்புத் திட்டத்தை வெற்றிகரமாக நிறைவு செய்து, வழங்கும் அமைப்பு நிர்ணயித்த அனைத்துத் தேவைகளையும் பூர்த்தி செய்துள்ளார்.',
  authorisedSignature: 'அதிகாரமளிக்கப்பட்ட கையொப்பம்',
  issued: 'வழங்கப்பட்ட தேதி',

  invoiceFooter: 'உங்கள் வணிகத்திற்கு நன்றி. கட்டணம் 15 நாட்களுக்குள் செலுத்தப்பட வேண்டும்.',
  payslipFooter: 'இந்த ஊதியச் சீட்டு கணினியால் உருவாக்கப்பட்டது, கையொப்பம் தேவையில்லை.',
}

const fr: Catalogue = {
  invoice: 'FACTURE',
  quotation: 'DEVIS',
  receipt: 'REÇU',
  deliveryNote: 'BON DE LIVRAISON',
  purchaseOrder: 'BON DE COMMANDE',
  payslip: 'BULLETIN DE PAIE',

  billTo: 'FACTURER À',
  payment: 'PAIEMENT',
  employee: 'SALARIÉ',

  due: 'Échéance',
  method: 'Méthode',
  account: 'Compte',
  bankTransfer: 'Virement bancaire',

  item: 'Article',
  scope: 'Prestation',
  goods: 'Marchandises',
  description: 'Description',
  earnings: 'Rémunération',
  qty: 'Qté',
  units: 'Unités',
  price: 'Prix',
  amount: 'Montant',
  value: 'Valeur',

  subtotal: 'Sous-total',
  discount: 'Remise',
  tax: 'TVA',
  total: 'Total',
  gross: 'Brut',
  deductions: 'Retenues',
  netPay: 'Net à payer',

  employeeId: 'Matricule',
  department: 'Service',
  engineering: 'Ingénierie',
  payDate: 'Date de paiement',
  periodEnding: 'Période se terminant le',

  summary: 'Synthèse',
  lineItems: 'Postes',
  revenue: 'Produits',
  expenses: 'Charges',
  net: 'Net',
  preparedFor: 'Préparé pour',
  confidential: 'Confidentiel',
  summaryBody:
    "Cette période est comparée au cycle précédent. Les chiffres sont fournis par l'application appelante et liés à ce modèle au moment du rendu.",

  certifiesThat: 'Il est certifié que',
  certificateBody:
    "a suivi avec succès le programme d'études et satisfait à toutes les exigences fixées par l'organisme de délivrance.",
  authorisedSignature: 'Signature autorisée',
  issued: 'Délivré le',

  invoiceFooter: 'Merci de votre confiance. Le paiement est dû sous 15 jours.',
  payslipFooter: 'Ce bulletin est généré par ordinateur et ne nécessite pas de signature.',
}

const de: Catalogue = {
  invoice: 'RECHNUNG',
  quotation: 'ANGEBOT',
  receipt: 'QUITTUNG',
  deliveryNote: 'LIEFERSCHEIN',
  purchaseOrder: 'BESTELLUNG',
  payslip: 'LOHNABRECHNUNG',

  billTo: 'RECHNUNGSEMPFÄNGER',
  payment: 'ZAHLUNG',
  employee: 'MITARBEITER',

  due: 'Fällig',
  method: 'Zahlungsart',
  account: 'Konto',
  bankTransfer: 'Banküberweisung',

  item: 'Position',
  scope: 'Leistung',
  goods: 'Waren',
  description: 'Beschreibung',
  earnings: 'Bezüge',
  qty: 'Menge',
  units: 'Einheiten',
  price: 'Preis',
  amount: 'Betrag',
  value: 'Wert',

  subtotal: 'Zwischensumme',
  discount: 'Rabatt',
  tax: 'MwSt.',
  total: 'Gesamt',
  gross: 'Brutto',
  deductions: 'Abzüge',
  netPay: 'Nettoauszahlung',

  employeeId: 'Personalnummer',
  department: 'Abteilung',
  engineering: 'Technik',
  payDate: 'Zahltag',
  periodEnding: 'Abrechnungszeitraum bis',

  summary: 'Zusammenfassung',
  lineItems: 'Positionen',
  revenue: 'Erlöse',
  expenses: 'Aufwendungen',
  net: 'Netto',
  preparedFor: 'Erstellt für',
  confidential: 'Vertraulich',
  summaryBody:
    'Dieser Zeitraum wird mit dem vorhergehenden Zyklus verglichen. Die Zahlen werden von der aufrufenden Anwendung geliefert und beim Rendern an diese Vorlage gebunden.',

  certifiesThat: 'Hiermit wird bescheinigt, dass',
  certificateBody:
    'das Studienprogramm erfolgreich abgeschlossen und alle von der vergebenden Stelle festgelegten Anforderungen erfüllt hat.',
  authorisedSignature: 'Rechtsgültige Unterschrift',
  issued: 'Ausgestellt am',

  invoiceFooter: 'Vielen Dank für Ihren Auftrag. Zahlbar innerhalb von 15 Tagen.',
  payslipFooter: 'Diese Abrechnung wurde maschinell erstellt und bedarf keiner Unterschrift.',
}

const es: Catalogue = {
  invoice: 'FACTURA',
  quotation: 'PRESUPUESTO',
  receipt: 'RECIBO',
  deliveryNote: 'ALBARÁN',
  purchaseOrder: 'ORDEN DE COMPRA',
  payslip: 'NÓMINA',

  billTo: 'FACTURAR A',
  payment: 'PAGO',
  employee: 'EMPLEADO',

  due: 'Vencimiento',
  method: 'Método',
  account: 'Cuenta',
  bankTransfer: 'Transferencia bancaria',

  item: 'Concepto',
  scope: 'Alcance',
  goods: 'Mercancías',
  description: 'Descripción',
  earnings: 'Devengos',
  qty: 'Cant.',
  units: 'Unidades',
  price: 'Precio',
  amount: 'Importe',
  value: 'Valor',

  subtotal: 'Subtotal',
  discount: 'Descuento',
  tax: 'IVA',
  total: 'Total',
  gross: 'Bruto',
  deductions: 'Deducciones',
  netPay: 'Neto a pagar',

  employeeId: 'N.º de empleado',
  department: 'Departamento',
  engineering: 'Ingeniería',
  payDate: 'Fecha de pago',
  periodEnding: 'Periodo que finaliza el',

  summary: 'Resumen',
  lineItems: 'Partidas',
  revenue: 'Ingresos',
  expenses: 'Gastos',
  net: 'Neto',
  preparedFor: 'Preparado para',
  confidential: 'Confidencial',
  summaryBody:
    'Este periodo se compara con el ciclo anterior. Las cifras las proporciona la aplicación que realiza la llamada y se vinculan a esta plantilla en el momento de la generación.',

  certifiesThat: 'Se certifica que',
  certificateBody:
    'ha completado con éxito el programa de estudios y ha cumplido todos los requisitos establecidos por la entidad emisora.',
  authorisedSignature: 'Firma autorizada',
  issued: 'Emitido el',

  invoiceFooter: 'Gracias por su confianza. El pago debe realizarse en 15 días.',
  payslipFooter: 'Esta nómina se ha generado por ordenador y no requiere firma.',
}

const pt: Catalogue = {
  invoice: 'FATURA',
  quotation: 'ORÇAMENTO',
  receipt: 'RECIBO',
  deliveryNote: 'GUIA DE REMESSA',
  purchaseOrder: 'ORDEM DE COMPRA',
  payslip: 'RECIBO DE VENCIMENTO',

  billTo: 'FATURAR A',
  payment: 'PAGAMENTO',
  employee: 'COLABORADOR',

  due: 'Vencimento',
  method: 'Método',
  account: 'Conta',
  bankTransfer: 'Transferência bancária',

  item: 'Item',
  scope: 'Âmbito',
  goods: 'Mercadorias',
  description: 'Descrição',
  earnings: 'Remunerações',
  qty: 'Qtd.',
  units: 'Unidades',
  price: 'Preço',
  amount: 'Valor',
  value: 'Valor',

  subtotal: 'Subtotal',
  discount: 'Desconto',
  tax: 'IVA',
  total: 'Total',
  gross: 'Bruto',
  deductions: 'Descontos',
  netPay: 'Líquido a receber',

  employeeId: 'N.º de colaborador',
  department: 'Departamento',
  engineering: 'Engenharia',
  payDate: 'Data de pagamento',
  periodEnding: 'Período que termina em',

  summary: 'Resumo',
  lineItems: 'Rubricas',
  revenue: 'Receitas',
  expenses: 'Despesas',
  net: 'Líquido',
  preparedFor: 'Preparado para',
  confidential: 'Confidencial',
  summaryBody:
    'Este período é comparado com o ciclo anterior. Os valores são fornecidos pela aplicação chamadora e associados a este modelo no momento da geração.',

  certifiesThat: 'Certifica-se que',
  certificateBody:
    'concluiu com êxito o programa de estudos e cumpriu todos os requisitos definidos pela entidade emissora.',
  authorisedSignature: 'Assinatura autorizada',
  issued: 'Emitido em',

  invoiceFooter: 'Obrigado pela sua preferência. O pagamento é devido em 15 dias.',
  payslipFooter: 'Este recibo é gerado por computador e não requer assinatura.',
}

const CATALOGUES: Record<LocaleCode, Catalogue> = { en, si, ta, fr, de, es, pt }

/**
 * Looks up a document label. Unknown keys return the key itself so a typo is
 * visible on the page rather than silently blank; missing translations fall back
 * to English.
 */
export function documentString(key: string, locale: LocaleCode): string {
  const catalogue = CATALOGUES[locale] ?? CATALOGUES[DEFAULT_LOCALE]
  const value = catalogue[key as DocumentStringKey]
  if (value !== undefined) return value
  const fallback = CATALOGUES[DEFAULT_LOCALE][key as DocumentStringKey]
  return fallback ?? key
}

/** Every key, for the editor's label picker and for coverage checks. */
export function documentStringKeys(): DocumentStringKey[] {
  return Object.keys(en) as DocumentStringKey[]
}

/** Used by tests to prove no locale silently falls back for a whole catalogue. */
export function catalogueFor(locale: LocaleCode): Record<string, string> {
  return CATALOGUES[locale] ?? CATALOGUES[DEFAULT_LOCALE]
}
