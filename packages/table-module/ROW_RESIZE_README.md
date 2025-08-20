# 表格行高调整功能

## 功能概述

wangEditor-next 表格模块新增了行高调整功能，允许用户通过拖拽来调整表格行的高度，提供了更好的表格编辑体验。

## 主要特性

### 1. 行高拖拽调整
- 鼠标悬停在表格行边界时，会显示行高调整器
- 支持拖拽调整相邻行的高度
- 实时预览行高变化

### 2. 智能调整策略
- **中间行拖拽**：只调整相邻两行的高度，保持其他行不变
- **最底部行拖拽**：等比例调整所有行的高度，保持表格整体比例
- **最小高度限制**：每行最小高度为20px，确保内容可读性

### 3. 视觉反馈
- 鼠标悬停时显示调整器
- 拖拽时高亮显示当前调整的行
- 鼠标指针变为上下箭头，提供直观的操作提示

## 技术实现

### 核心文件

1. **`src/module/row-resize.ts`** - 行高调整的核心逻辑
2. **`src/module/custom-types.ts`** - 扩展了TableElement类型，添加行高相关属性
3. **`src/module/render-elem/render-table.tsx`** - 表格渲染，添加行高调整器
4. **`src/module/render-elem/render-row.tsx`** - 行渲染，应用行高样式
5. **`src/assets/index.less`** - 行高调整器的样式

### 新增属性

在 `TableElement` 类型中新增了以下属性：

```typescript
export type TableElement = {
  // ... 现有属性
  
  /** row height resize bar */
  rowHeights?: number[] // 行高数组
  rowResizingIndex?: number // 用于标记行高 resize-bar index
  isRowResizing?: boolean | null // 用于设置行高 index resize-bar 的 highlight 属性
  isHoverRowBorder?: boolean // 用于设置行高 index resize-bar 的 visible 属性
  scrollHeight?: number // 用于设置行高 resize-bar 高度
}
```

### 核心函数

1. **`handleRowBorderVisible`** - 处理行边界可见性
2. **`handleRowBorderHighlight`** - 处理行边界高亮
3. **`handleRowBorderMouseDown`** - 处理行边界鼠标按下事件
4. **`calculateProportionalHeights`** - 计算等比例行高调整
5. **`calculateAdjacentHeights`** - 计算相邻行高度调整

## 使用方法

### 基本使用

1. 将鼠标移动到表格行之间的边界线上
2. 当鼠标变为上下箭头时，按住鼠标左键拖拽
3. 拖拽中间行时，只会调整相邻两行的高度
4. 拖拽最底部行时，所有行会按比例调整

### 代码示例

```typescript
import tableModule from '@wangeditor-next/table-module'

const editor = createEditor({
  // ... 其他配置
  modules: [tableModule]
})
```

## 样式定制

行高调整器的样式可以通过修改 `src/assets/index.less` 文件来自定义：

```less
.row-resizer {
  position: absolute;
  display: flex;
  flex-direction: column;
  top: 0px;
  left: 0px;
  width: 0;
  height: 0;
  z-index: 1;

  .row-resizer-item {
    position: relative;
  }
}

.row-resizer .resizer-line-hotzone {
  cursor: row-resize;
  width: auto;
  height: 6px;
  right: auto;
  bottom: 0px;

  .resizer-line {
    height: 2px;
    width: 100%;
    margin-left: 0;
    margin-top: 5px;
  }
}
```

## 兼容性

- 与现有的列宽调整功能完全兼容
- 支持表格的所有现有功能（插入/删除行列、合并单元格等）
- 自动维护行高数组，确保数据一致性

## 注意事项

1. 每行最小高度为20px，无法拖拽到更小
2. 行高调整会影响表格的整体高度
3. 在表格内容变化时，行高会自动调整以适应内容
4. 行高调整功能与列宽调整功能可以同时使用

## 测试

运行测试命令：

```bash
npm test row-resize.test.ts
```

## 示例

查看 `examples/row-resize-demo.html` 文件获取完整的使用示例。 