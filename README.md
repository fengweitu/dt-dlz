# AURELIS 电商独立站

当前版本采用 **React + TypeScript 前端 / Go + Gin 后端**，前后端独立运行、独立构建，通过 JSON REST API 通信。运行商城不再需要 Python。

## 技术栈

| 层级 | 技术 | 用途 |
| --- | --- | --- |
| 前端 | React 19、TypeScript 5、Vite 6 | 组件、状态、表单及生产构建 |
| 路由 | React Router 7（HashRouter） | 保留旧版 `#home`、`#product/2001` 等访问链接 |
| 图标 / 样式 | Lucide React、CSS | 保留 AURELIS 深绿、暖白、香槟色设计及移动端布局 |
| API | Go 1.25、Gin v1.12、net/http | 独立 REST API、请求校验、会话及商家权限 |
| 数据访问 | database/sql、go-sqlite3 | SQLite 持久化、事务、库存一致性 |
| 密码 | bcrypt；兼容旧 PBKDF2 | 原有账号直接登录，登录后自动升级旧哈希 |
| 构建 / 测试 | TypeScript、Vite、Go test / race、go vet | 类型检查、生产构建和后端集成测试 |

前端由 React 组件渲染，不再加载原生 `app.js`，也没有把旧 HTML 字符串塞进 React。后端业务全部由 Go 执行，不代理 Python 服务。

## 目录

```text
frontend/
  src/
    components/       头尾布局、商品卡片、购物袋、登录弹窗、订单卡片
    pages/            首页、商品、结算、账户、后台、文章
    lib/              API 客户端、TypeScript 类型、全局状态
    App.tsx           React Router 路由
    main.tsx          React 入口
  public/images/      商品原图和品牌资产
  vite.config.ts      开发 / 预览 API 代理
  package-lock.json   锁定前端依赖
backend/
  cmd/server/         Go 启动入口、优雅退出
  internal/shop/
    server.go         HTTP 路由、事务边界、鉴权、统一错误处理
    database.go       数据库连接、初始化和迁移
    schema.sql        编译嵌入 Go 二进制的数据库结构
    auth.go           登录、收藏、地址、订阅
    catalog.go        商品、规格、库存及编辑校验
    orders.go         服务端计价、订单状态、WhatsApp
    admin.go          收款确认、发货、退款记录、优惠券
    server_test.go    隔离数据库的集成和并发测试
  go.mod / go.sum     锁定后端依赖
catalog.json          首次启动的 30 款商品 / 82 种规格
store-config.json     WhatsApp 联系号码配置
sources/              商品、价格、图片来源快照
scripts/dev.mjs       同时启动独立前端和 Go 服务
scripts/              可选的历史商品导入和品牌素材工具
legacy/               旧 Python / 原生 JS 历史代码，不参与构建和运行
data/                本地 SQLite 数据库和备份（不提交版本库）
docs/                 API 说明、Nginx 配置样例
```

## 本地启动

环境：Node.js 20.19+、npm、Go 1.25+；SQLite 驱动使用 CGO，需要 C 编译器（macOS 安装 Xcode Command Line Tools，Linux 安装 gcc）。

```bash
npm run setup
npm run dev
```

- 前端：`http://localhost:3000`
- 后端：`http://127.0.0.1:8080/api/health`
- Vite 把 `/api/*` 转发给 Go；浏览器通过同源 Cookie 维持登录。
- 按 Ctrl+C 关闭开发服务。端口占用会直接报错，不会偷偷切换到其他前端端口。

也可独立启动：

```bash
# 终端一
cd backend
go run ./cmd/server -root ..

# 终端二，从项目根目录开始
npm run dev --prefix frontend
```

## 构建与验证

```bash
npm run build    # frontend/dist + backend/bin/server
npm test         # Go 集成测试及竞态检测
npm run check    # TypeScript / Vite 构建 + go vet
npm start        # 本地预览构建产物，同时运行 Go API
```

`npm start` 是本地预览；部署时由 Nginx 等静态服务托管 `frontend/dist`，Go 只处理 `/api`。参见 [Nginx 示例](docs/nginx.conf.example)。部署 Go 二进制时一并提供 `catalog.json`、`store-config.json` 和数据目录，用 `-root /srv/aurelis` 指定路径。数据库 schema 已嵌入二进制，无需部署 Go 源码。

## 配置

查看 [.env.example](.env.example)。程序读取进程环境变量，**不会自动加载 .env 文件**。

| 配置 | 默认 / 含义 |
| --- | --- |
| `API_ADDR` | `127.0.0.1:8080` |
| `SHOP_DB` | 项目根目录下 `data/shop.db` |
| `API_PROXY_TARGET` | Vite 的 Go 上游地址，默认 `http://127.0.0.1:8080` |
| `FRONTEND_ORIGIN` | 额外允许的可信请求来源；默认要求 Origin 与 Host 一致 |
| `COOKIE_SECURE` | HTTPS 部署设为 `1` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 启动时创建管理员；密码至少 10 字符，不提供默认管理员密码 |
| `WHATSAPP_NUMBER` | 可覆盖 `store-config.json` 的号码 |

创建管理员例子（自行替换邮箱和密码）：

```bash
ADMIN_EMAIL='owner@example.com' ADMIN_PASSWORD='replace-with-a-strong-password' npm run dev
```

## WhatsApp 付款

编辑项目根目录的 `store-config.json`：

```json
{
  "whatsapp_number": ""
}
```

后续填入含国家区号的号码即可，如 `12025550123`（仅格式示例）。配置在每次点击付款时读取，**无需重启**。环境变量优先于文件。

客户下单后，在订单页点击 **Pay via WhatsApp**：打开指定号码的消息草稿，附带订单编号、商品规格、数量和金额；不包含收件人姓名、电话或地址，也不会自动发送消息。号码留空或格式错误时提示尚未配置。跳转不代表收款成功，订单维持待付款；后台核实收款后点击 **Confirm received payment**。

## 数据兼容与业务规则

- 原有 `data/shop.db` 直接复用，保留账号、Cookie 会话、收藏、订单、规格及库存。
- 已备份到 `data/pre-go-migration-backup.db`。只有数据库完全没有商品时才从 `catalog.json` 初始化，不覆盖后台修改的数据。
- 原有订单的 CNY / USD 币种和商品快照保留。
- 新账号使用 bcrypt，旧 PBKDF2 密码在成功登录后升级。
- 金额使用整数美分。服务端根据规格 ID 取价，不接受前端提供的成交价。
- 创建订单、扣库存、取消和退款恢复库存均在 SQLite 事务内，避免超卖和重复恢复。
- 原有购物车沿用 `aurelis-cart-v2`，不同规格保持独立商品行。
- 30 款商品、82 种规格、69 张本地原图；来源快照为 2026-10-23，不是实时价格同步。
- 保留无功效/用途描述的英文商品文案，展示产品名称、规格、图片和价格。
- 现有库存仍为演示库存；没有接入物流、邮件、税费计算和自动支付网关。后台退款为记录及库存操作，不执行实际转账。

API 列表见 [docs/API.md](docs/API.md)。

## 双后端版本

项目现在同时保留两套后端：

- `backend/`：Go + Gin，完整业务实现，默认 API 端口 `8080`。
- `java-backend/`：Java 17 + Spring Boot 3，默认 API 端口 `8081`，读取同一商品目录、SQLite 和 WhatsApp 配置。

前端通过 `API_PROXY_TARGET` 选择后端。Go 版本是当前完整业务基准；Java 版本的启动、健康检查、商品目录和 WhatsApp 配置已经独立完成，详细说明见 [java-backend/README.md](java-backend/README.md)。由于当前运行环境没有可用 Java Runtime/Maven，Java 版本需要在安装 JDK 17 和 Maven 的环境中构建验证。

Java 联调入口：`npm run dev:java`。它会把前端 `/api` 代理到 `127.0.0.1:8081`，同时启动 Spring Boot。由于当前 Java 版本尚未完成 Go 版本全部业务 API 的逐项迁移，完整商城联调仍使用 `npm run dev` 的 Go 版本；Java 版本目前用于独立服务、商品目录和 WhatsApp 配置验证。
