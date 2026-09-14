1. 身体切换男女
2. 项目冷启动，涉及到整体的数据结构清理优化整理，例如身体测量单独一个文件，训练计划一个模版，结果一个模版，长期目标一个模版等等



---
关于首次 Workspace 注册：

  - macOS 的 DSH 官方 Web 使用系统目录选择器；首次点击 “Add workspace” 选择
    training 目录是 DSH 的本机文件授权边界，不能也不应由浏览器自动化模拟。

  - 容器中应改走 DSH 官方 workspace/create Remote API，对 /workspace 做幂等注
    册，并持久化 DSH_HOME。

  - 容器还必须给 DSH Web 单独配置浏览器可访问的 public origin（或完整反代），
    包括 /api/remote.mux 与 cookie；不能把容器内 127.0.0.1:3080 直接返回给外
    部浏览器。方案已写入技术文档，暂未实施该容器化 Bootstrap。

  未提交的 data/**、docs/say.md 及截图目录保留在工作区，未混入本次提交。