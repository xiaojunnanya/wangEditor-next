import * as core from '@wangeditor-next/core'
import * as slate from 'slate'

import createEditor from '../../../tests/utils/create-editor'
import { TableElement, TableRowElement } from '../src/module/custom-types'
import {
  handleRowBorderHighlight,
  handleRowBorderMouseDown,
  handleRowBorderVisible,
} from '../src/module/row-resize'

// Mock DOM methods
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: () => '',
  }),
})

// Mock HTMLElement methods
Object.defineProperty(HTMLElement.prototype, 'closest', {
  value(selector: string) {
    if (selector === '.table') {
      return {
        getBoundingClientRect: () => ({
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          width: 300,
          height: 200,
        }),
      }
    }
    if (selector === '.row-resizer-item') {
      return this
    }
    return null
  },
})

// Mock isHTMLElememt function
vi.mock('@wangeditor-next/core', async () => {
  const actual = await vi.importActual('@wangeditor-next/core')

  return {
    ...actual,
    isHTMLElememt: vi.fn(() => true),
  }
})

function setEditorSelection(
  editor: core.IDomEditor,
  selection: slate.Selection = {
    anchor: { path: [0, 0, 0], offset: 0 },
    focus: { path: [0, 0, 0], offset: 0 },
  },
) {
  editor.selection = selection
}

function createTableWithRows(rowHeights: number[]): TableElement {
  const rows: TableRowElement[] = rowHeights.map(height => ({
    type: 'table-row',
    height,
    children: [
      {
        type: 'table-cell',
        children: [{ text: 'Cell content' }],
      },
    ],
  }))

  return {
    type: 'table',
    width: 'auto',
    children: rows,
    columnWidths: [100, 150, 200],
  }
}

describe('Row Resize Module', () => {
  let editor: core.IDomEditor

  beforeEach(() => {
    editor = createEditor()
  })

  describe('handleRowBorderVisible', () => {
    test('should not process if editor is disabled', () => {
      const table = createTableWithRows([30, 40, 50])
      const mockEvent = {
        clientY: 35,
        target: document.createElement('div'),
      } as MouseEvent

      vi.spyOn(editor, 'isDisabled').mockReturnValue(true)
      const transformsSpy = vi.spyOn(slate.Transforms, 'setNodes')

      handleRowBorderVisible(editor, table, mockEvent)

      expect(transformsSpy).not.toHaveBeenCalled()
    })

    test('should set hover state when mouse is on row border', () => {
      const table = createTableWithRows([30, 40, 50])

      // Create a mock target with closest method
      const mockTarget = {
        closest: vi.fn((selector: string) => {
          if (selector === '.table') {
            return {
              getBoundingClientRect: () => ({
                x: 0,
                y: 0,
                top: 0,
                left: 0,
                width: 300,
                height: 120, // 30 + 40 + 50
              }),
            }
          }
          return null
        }),
      }

      const mockEvent = {
        clientY: 30, // 在第一行边界位置 (30px)
        target: mockTarget,
      } as MouseEvent

      vi.spyOn(editor, 'isDisabled').mockReturnValue(false)
      const transformsSpy = vi.spyOn(slate.Transforms, 'setNodes')

      handleRowBorderVisible(editor, table, mockEvent)

      expect(transformsSpy).toHaveBeenCalledWith(
        editor,
        { isHoverRowBorder: true, resizingRowIndex: 0 },
        { mode: 'highest' },
      )
    })

    test('should reset hover state when mouse moves away', () => {
      const table: TableElement = {
        ...createTableWithRows([30, 40, 50]),
        isHoverRowBorder: true,
        resizingRowIndex: 0,
      }
      const mockEvent = {
        clientY: 200, // 远离边界
        target: document.createElement('div'),
      } as MouseEvent

      vi.spyOn(editor, 'isDisabled').mockReturnValue(false)
      const transformsSpy = vi.spyOn(slate.Transforms, 'setNodes')

      handleRowBorderVisible(editor, table, mockEvent)

      expect(transformsSpy).toHaveBeenCalledWith(
        editor,
        { isHoverRowBorder: false, resizingRowIndex: -1 },
        { mode: 'highest' },
      )
    })
  })

  describe('handleRowBorderHighlight', () => {
    test('should set resizing state on mouseenter', () => {
      const mockEvent = { type: 'mouseenter' } as MouseEvent
      const transformsSpy = vi.spyOn(slate.Transforms, 'setNodes')

      handleRowBorderHighlight(editor, mockEvent)

      expect(transformsSpy).toHaveBeenCalledWith(
        editor,
        { isResizingRow: true },
        { mode: 'highest' },
      )
    })

    test('should clear resizing state on mouseleave', () => {
      const mockEvent = { type: 'mouseleave' } as MouseEvent
      const transformsSpy = vi.spyOn(slate.Transforms, 'setNodes')

      handleRowBorderHighlight(editor, mockEvent)

      expect(transformsSpy).toHaveBeenCalledWith(
        editor,
        { isResizingRow: false },
        { mode: 'highest' },
      )
    })
  })

  describe('handleRowBorderMouseDown', () => {
    test('should set editor reference for row resizing', () => {
      const table = createTableWithRows([30, 40, 50])

      // 这个函数主要是设置内部状态，我们通过后续的拖动行为来验证
      expect(() => {
        handleRowBorderMouseDown(editor, table)
      }).not.toThrow()
    })
  })

  describe('Row resize integration', () => {
    test('should handle complete row resize workflow', () => {
      const table = createTableWithRows([30, 40, 50])

      setEditorSelection(editor, {
        anchor: { path: [0, 0, 0], offset: 0 },
        focus: { path: [0, 0, 0], offset: 0 },
      })

      // 模拟鼠标悬停
      const mockTarget = {
        closest: vi.fn((selector: string) => {
          if (selector === '.table') {
            return {
              getBoundingClientRect: () => ({
                x: 0,
                y: 0,
                top: 0,
                left: 0,
                width: 300,
                height: 120,
              }),
            }
          }
          return null
        }),
      }

      const hoverEvent = {
        clientY: 30, // 在第一行边界位置
        target: mockTarget,
      } as MouseEvent

      vi.spyOn(editor, 'isDisabled').mockReturnValue(false)
      const transformsSpy = vi.spyOn(slate.Transforms, 'setNodes')

      handleRowBorderVisible(editor, table, hoverEvent)

      // 验证悬停状态被设置
      expect(transformsSpy).toHaveBeenCalledWith(
        editor,
        { isHoverRowBorder: true, resizingRowIndex: 0 },
        { mode: 'highest' },
      )

      // 模拟鼠标按下
      handleRowBorderMouseDown(editor, table)

      // 模拟鼠标进入高亮状态
      const enterEvent = { type: 'mouseenter' } as MouseEvent

      handleRowBorderHighlight(editor, enterEvent)

      expect(transformsSpy).toHaveBeenCalledWith(
        editor,
        { isResizingRow: true },
        { mode: 'highest' },
      )
    })
  })
})
