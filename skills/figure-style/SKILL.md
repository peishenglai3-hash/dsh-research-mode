---
name: figure-style
description: "Choose and style scientific figures for papers and reports: one figure one conclusion, accessible color, units and uncertainty, vector export and artifact provenance. Use when generating or unifying line, bar, scatter, heatmap, network or map figures."
---

# figure-style — 科研图表风格

## 何时使用

需要为论文/报告生成或统一图表风格（折线、柱状、散点、热图、网络图、地图）时。

## 原则

- 先问“读者要从图中读出什么比较”，再选图型；不要用装饰性 3D、阴影、渐变。
- 一图一结论；标题写结论，不写“图 1”。
- 颜色用于编码变量，不用于装饰；连续量用顺序色，分类量用可区分色；避免红绿唯一区分。
- 坐标轴必须有单位；误差线/置信区间说明含义；样本量写进图注。
- 字体、线宽、字号服从目标期刊/模板；中英文标点一致。

## 流程

1. 写图注草稿（结论、数据、方法、n、误差含义）。
2. 选图型与编码；列出数据列与变换。
3. 用项目模板生成图；导出 SVG/PDF（矢量）+ PNG（预览）。
4. 自检：可读性、色盲友好、缺测值处理、坐标轴截断是否误导。
5. 把图与生成代码记录为 artifact；`kind=figure`，附 `code`/`environment` 面。

## 硬约束

- 不修改数据点来“让图好看”；不隐藏不利结果。
- 不把相关性图注写成因果结论。
- 缺失数据显式标注，不插值冒充观测。
