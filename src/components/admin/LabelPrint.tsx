'use client'
import JsBarcode from 'jsbarcode'

export type LabelField = { label: string; value: string }

function renderLabel(barcode: string, fields: LabelField[]) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, barcode, {
    format: 'CODE128',
    width: 2.5,
    height: 70,
    displayValue: true,
    fontSize: 16,
    font: 'monospace',
    margin: 10,
  })
  return `<div class="label">${svg.outerHTML}
${fields.map(f => `<div class="field-row"><span class="field-label">${f.label}: </span>${f.value}</div>`).join('')}
</div>`
}

export function printLabel(barcode: string, fields: LabelField[]) {
  const w = window.open('', '_blank', 'width=500,height=400,scrollbars=yes')
  if (!w) return
  w.document.write(labelPageHtml(renderLabel(barcode, fields)))
  w.document.close()
}

export function printLabels(labels: { barcode: string; fields: LabelField[] }[]) {
  const w = window.open('', '_blank', 'width=500,height=400,scrollbars=yes')
  if (!w) return
  w.document.write(labelPageHtml(labels.map(l => renderLabel(l.barcode, l.fields)).join('\n<div class="page-break"></div>\n')))
  w.document.close()
}

function labelPageHtml(content: string) {
  return `<!DOCTYPE html><html><head><style>
    @page{margin:0}
    *,*::before,*::after{box-sizing:border-box}
    body{display:flex;flex-direction:column;align-items:center;margin:0;font-family:system-ui,-apple-system,sans-serif;padding:20}
    .label{width:320px;text-align:center;display:flex;flex-direction:column;align-items:center}
    .field-row{font-size:14px;margin:4px 0;color:#1a1a1a;width:100%}
    .field-label{color:#666}
    .page-break{page-break-after:always}
  </style></head><body>
  ${content}
  <script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close()}},500)}</script>
  </body></html>`
}
