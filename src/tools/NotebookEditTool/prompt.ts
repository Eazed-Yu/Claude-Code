export const DESCRIPTION =
  '替换 Jupyter notebook 中特定单元格的内容。'
export const PROMPT = `用新源代码完全替换 Jupyter notebook（.ipynb 文件）中特定单元格的内容。Jupyter notebook 是将代码、文本和可视化内容结合在一起的交互式文档，常用于数据分析和科学计算。notebook_path 参数必须是绝对路径，而非相对路径。cell_number 从 0 开始索引。使用 edit_mode=insert 可在 cell_number 指定的索引位置插入新单元格。使用 edit_mode=delete 可删除 cell_number 指定索引处的单元格。`
