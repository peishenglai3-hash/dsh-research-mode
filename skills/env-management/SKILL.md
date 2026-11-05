---
name: env-management
description: "Record and manage reproducible research environments: OS, interpreter, package versions, seeds, commands and provenance. Use when running code, installing dependencies, switching Python/R/Node environments, or filling an artifact environment face; never record credentials."
---

# env-management — 科研环境与可复现性

## 何时使用

运行代码、安装依赖、切换 Python/R/Node 环境，或为 artifact 记录环境清单时。

## 流程

1. 先读项目 `README`/锁文件/`pyproject.toml`/`package.json`；不要凭记忆装包。
2. 记录：OS、架构、解释器版本、包管理器、关键依赖版本、随机种子、硬件（如相关）。
3. 环境变更与代码变更分开提交/记录；不把凭据写进环境文件。
4. 运行前写清命令、输入、预期输出；运行后保存日志与退出码。
5. 把环境清单写入 provenance 的 `environment` 面；缺失项写 `unavailable`，不猜。

## 硬约束

- 不在项目根外写文件；不覆盖用户数据。
- 不把 `.env`、token、私钥记录为 artifact 或导出。
- 不声称“可复现”而没有命令、版本与数据校验和。
- 需要联网安装时先确认网络/镜像/许可；失败要显式报告，不静默降级。
