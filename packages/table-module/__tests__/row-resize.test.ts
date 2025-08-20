/**
 * @description row resize test
 * @author wangfupeng
 */

import * as slate from 'slate'

import createEditor from '../../../tests/utils/create-editor'
import { handleRowBorderHighlight, handleRowBorderMouseDown, handleRowBorderVisible } from '../src/module/row-resize'

describe('Row Resize Module', () => {
  test('handleRowBorderVisible should work correctly', () => {
    const editor = createEditor()
    const mockElemNode = {
      type: 'table',
      rowHeights: [30, 30, 30],
      isHoverRowBorder: false,
      rowResizingIndex: -1,
    } as any

    const mockEvent = {
      clientY: 35,
      target: {
        getBoundingClientRect: () => ({ y: 0 }),
        closest: () => ({ getBoundingClientRect: () => ({ y: 0 }) }),
      },
    } as any

    const mockTransforms = vi.spyOn(slate.Transforms, 'setNodes')

    handleRowBorderVisible(editor, mockElemNode, mockEvent, 100)

    expect(mockTransforms).toHaveBeenCalled()
  })

  test('handleRowBorderHighlight should work correctly', () => {
    const editor = createEditor()
    const mockEvent = { type: 'mouseenter' } as any
    const mockTransforms = vi.spyOn(slate.Transforms, 'setNodes')

    handleRowBorderHighlight(editor, mockEvent)

    expect(mockTransforms).toHaveBeenCalledWith(
      editor,
      { isRowResizing: true },
      { mode: 'highest' },
    )
  })

  test('handleRowBorderMouseDown should work correctly', () => {
    const editor = createEditor()
    const mockElemNode = {} as any

    // 这个函数主要是设置全局变量，测试调用是否成功
    expect(() => {
      handleRowBorderMouseDown(editor, mockElemNode)
    }).not.toThrow()
  })
})
