# AURELIS Java 后端版本

这是与 `backend/` Go 版本并列的 Java 实现，使用 Spring Boot 3、Java 17、Spring Web、Spring JDBC、SQLite JDBC。默认监听 `127.0.0.1:8081`，避免与 Go 版本的 8080 冲突。两套后端共享 `catalog.json`、`data/shop.db` 和 `store-config.json`，前端一次只连接其中一个。

```bash
cd java-backend
mvn spring-boot:run -DAURELIS_ROOT=..
```

生产构建：

```bash
mvn clean package
java -jar target/aurelis-java-api-2.0.0.jar --aurelis.root=..
```

切换 React 前端到 Java：

```bash
API_PROXY_TARGET=http://127.0.0.1:8081 npm run dev --prefix frontend
```

当前 Java 版本已提供健康检查、从同一 `catalog.json` 读取商品、SQLite 初始化和 WhatsApp 付款链接配置。完整业务 API（登录、收藏、地址、报价、订单、库存和后台）继续以 Go 版本为基准，下一步可将 `java-backend/src/main/java/com/aurelis/store` 中的 service/controller 按 API 文档逐项迁移；两版不会同时写同一个 SQLite 数据库。

## 与 Go 版本的关系

Java 版本是独立的 Spring Boot 服务，不调用 Go 进程。Java 服务的商品目录、健康检查和 WhatsApp 链接已经可运行；订单、账号、库存和后台接口会按 [docs/API.md](../docs/API.md) 继续扩展。切换前端到 Java 时，未实现的 API 页面会返回明确的服务端错误，不会悄悄回退到 Go。
