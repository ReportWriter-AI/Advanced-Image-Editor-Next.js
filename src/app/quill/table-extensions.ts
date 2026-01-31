import { Table, TableCell, TableHeader } from '@tiptap/extension-table'
import { mergeAttributes } from '@tiptap/core'

export const ExtendedTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alternateRows: {
        default: false,
        parseHTML: (element) =>
          element.getAttribute('data-alternate-rows') === 'true',
        renderHTML: (attributes) =>
          attributes.alternateRows ? { 'data-alternate-rows': 'true' } : {},
      },
      dashedBorders: {
        default: false,
        parseHTML: (element) =>
          element.getAttribute('data-dashed-borders') === 'true',
        renderHTML: (attributes) =>
          attributes.dashedBorders ? { 'data-dashed-borders': 'true' } : {},
      },
    }
  },
})

const cellAttrs = {
  backgroundColor: {
    default: null,
    parseHTML: (element: Element) =>
      (element as HTMLElement).style?.backgroundColor ||
      element.getAttribute('data-background-color') ||
      null,
  },
  verticalAlign: {
    default: null,
    parseHTML: (element: Element) =>
      (element as HTMLElement).style?.verticalAlign ||
      element.getAttribute('data-vertical-align') ||
      null,
  },
  textAlign: {
    default: null,
    parseHTML: (element: Element) =>
      (element as HTMLElement).style?.textAlign ||
      element.getAttribute('data-text-align') ||
      null,
  },
}

export const ExtendedTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...cellAttrs,
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = { ...HTMLAttributes }
    const styles: string[] = []
    if (node.attrs.backgroundColor)
      styles.push(`background-color: ${node.attrs.backgroundColor}`)
    if (node.attrs.verticalAlign)
      styles.push(`vertical-align: ${node.attrs.verticalAlign}`)
    if (node.attrs.textAlign) styles.push(`text-align: ${node.attrs.textAlign}`)
    if (styles.length) attrs.style = (attrs.style ? `${attrs.style}; ` : '') + styles.join('; ')
    return ['td', mergeAttributes(this.options.HTMLAttributes, attrs), 0]
  },
})

export const ExtendedTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...cellAttrs,
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = { ...HTMLAttributes }
    const styles: string[] = []
    if (node.attrs.backgroundColor)
      styles.push(`background-color: ${node.attrs.backgroundColor}`)
    if (node.attrs.verticalAlign)
      styles.push(`vertical-align: ${node.attrs.verticalAlign}`)
    if (node.attrs.textAlign) styles.push(`text-align: ${node.attrs.textAlign}`)
    if (styles.length) attrs.style = (attrs.style ? `${attrs.style}; ` : '') + styles.join('; ')
    return ['th', mergeAttributes(this.options.HTMLAttributes, attrs), 0]
  },
})
