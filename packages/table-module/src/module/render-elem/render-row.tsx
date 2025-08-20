/**
 * @description render row
 * @author wangfupeng
 */

import { DomEditor, IDomEditor } from '@wangeditor-next/core'
import { Element as SlateElement } from 'slate'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { jsx, VNode } from 'snabbdom'

import { TableElement } from '../custom-types'

function renderTableRow(
  elemNode: SlateElement,
  children: VNode[] | null,
  editor: IDomEditor,
): VNode {
  // 获取表格节点以获取行高信息
  const tableNode = editor.getParentNode(elemNode) as TableElement
  const { rowHeights = [] } = tableNode || {}

  // 获取当前行的索引
  const path = DomEditor.findPath(editor, elemNode)
  const rowIndex = path[path.length - 1] as number
  const rowHeight = rowHeights[rowIndex]

  const style = rowHeight ? { height: `${rowHeight}px` } : {}

  const vnode = <tr style={style}>{children}</tr>

  return vnode
}

export default renderTableRow
