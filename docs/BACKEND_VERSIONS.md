# 后端双版本切换

```text
React/Vite :3000
    ├── API_PROXY_TARGET=http://127.0.0.1:8080 → Go / backend
    └── API_PROXY_TARGET=http://127.0.0.1:8081 → Java / java-backend
```

不要让两套服务同时写同一个生产 SQLite 文件；切换前停止另一套服务，或给 `SHOP_DB` 指定独立数据库副本。两套服务使用同一 `catalog.json` 与 `store-config.json`。Java 版本当前提供健康检查、商品目录和 WhatsApp 链接；完整业务接口以 Go 版本为基准，Java 按 API 文档逐项迁移。
