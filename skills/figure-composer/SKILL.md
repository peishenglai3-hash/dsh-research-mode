---
name: figure-composer
description: "Compose multi-panel scientific figures: narrative order, shared scales, alignment, export and captions. Use when assembling Figure 1/2/3 or poster/report panels from multiple plots, tables or diagrams."
---

# figure-composer — 多面板图表编排

## 何时使用

需要把多张图、表、示意图组合成论文 Figure 1/2/3，或做海报/汇报的图表版式时。

## 流程

1. **确定叙事顺序**：每个 panel 回答一个子问题；panel 字母按阅读顺序。
2. **统一尺度**：同一变量的坐标范围、色标、字号、线宽保持一致；不同尺度必须显式标注。
3. **版式**：优先单栏/双栏原生宽度；留白用于分组，不用边框堆叠。
4. **对齐**：轴线、标题、图例对齐；图例不遮挡数据。
5. **导出**：矢量 PDF/SVG；位图 ≥300 dpi；嵌入字体或转曲。
6. **图注**：逐 panel 说明数据、方法、n、误差；缩写首次出现给全称。

## 硬约束

- 不拼接不同样本/不同方法的 panel 而不说明。
- 不用缩放/裁剪制造视觉差异。
- 组合图与原始单图、生成脚本一起记录为 artifact。
