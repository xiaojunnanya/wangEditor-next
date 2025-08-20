import { DomEditor, IDomEditor, isHTMLElememt } from '@wangeditor-next/core'
import throttle from 'lodash.throttle'
import { Editor, Element as SlateElement, Transforms } from 'slate'

import { isOfType } from '../utils'
import $ from '../utils/dom'
import { TableElement } from './custom-types'

/**
 * 计算行高距离表格顶部的累积距离
 */
function getCumulativeHeights(rowHeights: number[]) {
  const cumulativeHeights: number[] = []
  let totalHeight = 0

  for (const height of rowHeights) {
    totalHeight += height
    cumulativeHeights.push(totalHeight)
  }

  return cumulativeHeights
}

/**
 * 用于计算拖动行时，行高变化的比例
 */
export function getRowHeightRatios(rowHeights: number[]) {
  const rowHeightsRatio: number[] = []
  const totalHeight = rowHeights.reduce((a, b) => a + b, 0)

  for (const height of rowHeights) {
    rowHeightsRatio.push(height / totalHeight)
  }

  return rowHeightsRatio
}

// 是否为光标选区行为
let isSelectionOperation = false
// 拖拽行高相关信息
let isMouseDownForRowResize = false
let clientYWhenMouseDown = 0
let rowHeightWhenMouseDown = 0
let editorWhenMouseDown: IDomEditor | null = null
const $window = $(window)

function onRowMouseDown(event: Event) {
  const elem = event.target as HTMLElement
  // 判断是否为光标选区行为，对行高变更行为进行过滤

  if (elem.closest('[data-block-type="table-cell"]')) {
    isSelectionOperation = true
  } else if (elem.tagName === 'DIV' && elem.closest('.row-resizer-item')) {
    if (editorWhenMouseDown === null) { return }

    const [[elemNode]] = Editor.nodes(editorWhenMouseDown, {
      match: isOfType(editorWhenMouseDown, 'table'),
    })
    const { rowHeights = [], rowResizingIndex = -1 } = elemNode as TableElement

    // 记录必要信息
    isMouseDownForRowResize = true
    const { clientY } = event as MouseEvent

    clientYWhenMouseDown = clientY
    rowHeightWhenMouseDown = rowHeights[rowResizingIndex]
    document.body.style.cursor = 'row-resize'
    event.preventDefault()
  }

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  $window.on('mousemove', onRowMouseMove)
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  $window.on('mouseup', onRowMouseUp)
}

$window.on('mousedown', onRowMouseDown)

/**
 * 计算等比例调整所有行高度（用于最底部行拖动）
 */
function calculateProportionalHeights(rowHeights: number[], rowResizingIndex: number, newBottomHeight: number): number[] {
  const currentTotalHeight = rowHeights.reduce((a, b) => a + b, 0)
  const currentBottomHeight = rowHeights[rowResizingIndex]

  // 确保最底部行不小于最小高度
  const actualNewBottomHeight = Math.max(20, newBottomHeight)

  // 计算新的总高度
  const newTotalHeight = currentTotalHeight - currentBottomHeight + actualNewBottomHeight

  // 如果新总高度太小，则设置最小总高度
  const minTotalHeight = rowHeights.length * 20 // 每行至少20px

  if (newTotalHeight < minTotalHeight) {
    // 如果新总高度小于最小值，则所有行都设为最小高度
    return rowHeights.map(() => 20)
  }

  // 计算其他行的总高度
  const otherRowsCurrentHeight = currentTotalHeight - currentBottomHeight
  const otherRowsNewHeight = newTotalHeight - actualNewBottomHeight

  // 如果其他行需要的总高度为0或负数，则只保留最底部行
  if (otherRowsNewHeight <= 0) {
    const result = rowHeights.map(() => 20)

    result[rowResizingIndex] = Math.max(20, newTotalHeight - (rowHeights.length - 1) * 20)
    return result
  }

  // 计算其他行的缩放比例
  const otherRowsScaleFactor = otherRowsCurrentHeight > 0 ? otherRowsNewHeight / otherRowsCurrentHeight : 1

  // 调整所有行高度
  const newHeights = rowHeights.map((height, index) => {
    if (index === rowResizingIndex) {
      // 最底部行直接使用新高度
      return Math.floor(actualNewBottomHeight * 100) / 100
    }
    // 其他行按比例调整
    const newHeight = height * otherRowsScaleFactor

    return Math.max(20, Math.floor(newHeight * 100) / 100)
  })

  // 由于最小高度限制，可能导致总高度偏差，需要微调最底部行
  const actualTotalHeight = newHeights.reduce((a, b) => a + b, 0)
  const heightDifference = newTotalHeight - actualTotalHeight

  if (Math.abs(heightDifference) > 0.01) {
    newHeights[rowResizingIndex] = Math.max(20, newHeights[rowResizingIndex] + heightDifference)
  }

  return newHeights
}

/**
 * 计算相邻行高度调整（用于中间行拖动）
 */
function calculateAdjacentHeights(rowHeights: number[], rowResizingIndex: number, heightChange: number): number[] {
  const newHeights = [...rowHeights]

  // 找到下方的相邻行进行调整
  const adjacentIndex = rowResizingIndex + 1

  if (adjacentIndex >= newHeights.length) {
    // 如果没有下方相邻行，则不进行调整
    return newHeights
  }

  const topRowHeight = newHeights[rowResizingIndex]
  const bottomRowHeight = newHeights[adjacentIndex]

  // 计算边界可以移动的范围
  const minTopHeight = 20
  const minBottomHeight = 20
  const maxTopHeight = topRowHeight + bottomRowHeight - minBottomHeight

  // 计算新的上行高度（边界直接跟随鼠标）
  let newTopHeight = topRowHeight + heightChange

  // 限制上行高度在允许范围内
  newTopHeight = Math.max(minTopHeight, Math.min(maxTopHeight, newTopHeight))

  // 计算新的下行高度（确保总高度不变）
  const newBottomHeight = topRowHeight + bottomRowHeight - newTopHeight

  // 应用新高度
  newHeights[rowResizingIndex] = Math.floor(newTopHeight * 100) / 100
  newHeights[adjacentIndex] = Math.floor(newBottomHeight * 100) / 100

  return newHeights
}

/**
 * 根据鼠标位置计算行高度
 * @param rowHeights 当前行高度数组
 * @param rowResizingIndex 正在调整的边界索引
 * @param mousePositionInTable 鼠标相对于表格顶部的位置
 * @param cumulativeHeights 行高度的累积和数组
 * @returns 调整后的行高度数组
 */
function calculateAdjacentHeightsByBorderPosition(
  rowHeights: number[],
  rowResizingIndex: number,
  mousePositionInTable: number,
  cumulativeHeights: number[],
): number[] {
  const newHeights = [...rowHeights]

  // 检查边界范围
  if (rowResizingIndex < 0 || rowResizingIndex >= rowHeights.length) {
    return newHeights
  }

  // 计算当前边界的上边界位置（前面所有行的高度总和）
  const topBoundary = rowResizingIndex === 0 ? 0 : cumulativeHeights[rowResizingIndex - 1]

  // 计算当前边界的下边界位置（包括当前行和下一行的高度）
  const bottomBoundary = rowResizingIndex + 1 < rowHeights.length
    ? cumulativeHeights[rowResizingIndex + 1]
    : cumulativeHeights[rowResizingIndex]

  // 计算允许的边界移动范围
  const minBorderPosition = topBoundary + 20 // 上行最小高度
  const maxBorderPosition = bottomBoundary - 20 // 下行最小高度

  // 限制鼠标位置在允许范围内
  const clampedMousePosition = Math.max(minBorderPosition, Math.min(maxBorderPosition, mousePositionInTable))

  // 计算新的上行高度（第rowResizingIndex行）
  const newTopHeight = clampedMousePosition - topBoundary

  // 计算新的下行高度（第rowResizingIndex+1行）
  const adjacentIndex = rowResizingIndex + 1

  if (adjacentIndex < rowHeights.length) {
    const currentTwoRowsHeight = rowHeights[rowResizingIndex] + rowHeights[adjacentIndex]
    const newBottomHeight = currentTwoRowsHeight - newTopHeight

    // 应用新高度
    newHeights[rowResizingIndex] = Math.floor(newTopHeight * 100) / 100
    newHeights[adjacentIndex] = Math.floor(newBottomHeight * 100) / 100
  }

  return newHeights
}

const onRowMouseMove = throttle((event: Event) => {
  if (!isMouseDownForRowResize) { return }
  if (editorWhenMouseDown === null) { return }
  event.preventDefault()

  const { clientY } = event as MouseEvent
  const heightChange = clientY - clientYWhenMouseDown // 计算高度变化

  const [[elemNode]] = Editor.nodes(editorWhenMouseDown, {
    match: isOfType(editorWhenMouseDown, 'table'),
  })
  const { rowHeights = [], rowResizingIndex = -1 } = elemNode as TableElement

  let adjustRowHeights: number[]
  const tableNode = DomEditor.getSelectedNodeByType(editorWhenMouseDown, 'table') as TableElement
  const tableDom = DomEditor.toDOMNode(editorWhenMouseDown, tableNode)

  // 判断是否为最底部行
  const isBottomRow = rowResizingIndex === rowHeights.length - 1

  if (isBottomRow) {
    // 最底部行：等比例调整所有行高度
    const newBottomHeight = rowHeightWhenMouseDown + heightChange

    adjustRowHeights = calculateProportionalHeights(rowHeights, rowResizingIndex, newBottomHeight)
  } else {
    // 中间行：计算边界的绝对位置
    const tableElement = tableDom.querySelector('.table')

    if (tableElement) {
      const tableRect = tableElement.getBoundingClientRect()
      const mousePositionInTable = clientY - tableRect.top // 鼠标相对于表格顶部的位置

      // 计算边界的新位置
      const cumulativeHeights = getCumulativeHeights(rowHeights)
      const newBorderPosition = mousePositionInTable

      // 根据新的边界位置计算行高度
      adjustRowHeights = calculateAdjacentHeightsByBorderPosition(rowHeights, rowResizingIndex, newBorderPosition, cumulativeHeights)
    } else {
      // 如果找不到表格元素，则使用原来的逻辑
      adjustRowHeights = calculateAdjacentHeights(rowHeights, rowResizingIndex, heightChange)
    }
  }

  // 应用新的行高度
  Transforms.setNodes(editorWhenMouseDown, { rowHeights: adjustRowHeights } as TableElement, {
    mode: 'highest',
  })
}, 100)

function onRowMouseUp(_event: Event) {
  isSelectionOperation = false
  isMouseDownForRowResize = false
  editorWhenMouseDown = null
  document.body.style.cursor = ''

  // 解绑事件
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  $window.off('mousemove', onRowMouseMove)
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  $window.off('mouseup', onRowMouseUp)
}

/**
 * 鼠标移动时，判断在哪个行边界上
 * Class 先 visible 后 highlight @跟随飞书
 * 避免光标选区功能收到干扰
 */
export function handleRowBorderVisible(
  editor: IDomEditor,
  elemNode: SlateElement,
  e: MouseEvent,
  _scrollHeight: number,
) {
  if (editor.isDisabled()) { return }
  if (isSelectionOperation || isMouseDownForRowResize) { return }

  const {
    rowHeights = [],
    isHoverRowBorder,
    rowResizingIndex,
  } = elemNode as TableElement

  // Row Border 高度为 10px
  const { clientY, target } = e
  // 当单元格合并的时候，鼠标在 cell 中间，则不显示 row border

  if (isHTMLElememt(target)) {
    const rect = target.getBoundingClientRect()

    if (clientY > rect.y + 5 && clientY < rect.y + rect.height - 5) {
      if (isHoverRowBorder) {
        Transforms.setNodes(
          editor,
          { isHoverRowBorder: false, rowResizingIndex: -1 } as TableElement,
          { mode: 'highest' },
        )
      }
      return
    }
  }
  if (isHTMLElememt(target)) {
    const parent = target.closest('.table')

    if (parent) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const { clientY } = e
      const rect = parent.getBoundingClientRect()
      const heights = rowHeights

      const cumulativeHeights = getCumulativeHeights(heights)

      // 鼠标移动时，计算当前鼠标位置，判断在哪个行边界上
      for (let i = 0; i < cumulativeHeights.length; i += 1) {
        if (
          clientY - rect.y >= cumulativeHeights[i] - 5
          && clientY - rect.y < cumulativeHeights[i] + 5
        ) {
          // 节流，防止多次引起Transforms.setNodes重绘
          if (rowResizingIndex === i) { return }
          Transforms.setNodes(
            editor,
            { isHoverRowBorder: true, rowResizingIndex: i } as TableElement,
            { mode: 'highest' },
          )
          return
        }
      }
    }
  }

  // 鼠标移出时，重置
  if (isHoverRowBorder === true) {
    Transforms.setNodes(editor, { isHoverRowBorder: false, rowResizingIndex: -1 } as TableElement, {
      mode: 'highest',
    })
  }
}

/**
 * 设置 class highlight
 * 将 render-row.tsx 拖动功能迁移至 div.row-resize
 */
export function handleRowBorderHighlight(editor: IDomEditor, e: MouseEvent) {
  if (e.type === 'mouseenter') {
    Transforms.setNodes(editor, { isRowResizing: true } as TableElement, { mode: 'highest' })
  } else {
    Transforms.setNodes(editor, { isRowResizing: false } as TableElement, { mode: 'highest' })
  }
}

export function handleRowBorderMouseDown(editor: IDomEditor, _elemNode: SlateElement) {
  if (isMouseDownForRowResize) { return } // 此时正在修改行高
  editorWhenMouseDown = editor
}
