# 部署到 Cloudflare Pages 并绑定 www.tideoralab.com

## 0. 结论先行

这个站点是**纯静态单页应用**：`frontend/src/lib/api.ts` 里没有任何 `fetch`，商品数据来自打包进 bundle 的
`catalog.json`，账号 / 收藏 / 地址 / 订单都存在浏览器 `localStorage`，付款走 WhatsApp 跳转。
所以不需要 Workers、D1、数据库或任何服务端 —— **Cloudflare Pages 托管 `frontend/dist` 即可**。

- 构建产物：`frontend/dist`，约 69 MB / 301 个文件
  （97 份 COA 报告 27.5 MB + 商品图 41 MB + JS/CSS 0.4 MB）
- 单文件最大 4.3 MB（`images/tideora-product-photo.jpg`），远低于 Pages 的 25 MiB 限制
- 文件数 301，远低于 20,000 限制

Cloudflare 免费额度：无限带宽、每月 500 次构建、无限请求。这个站完全在免费额度内。

---

## 1. 一次性准备

```bash
npm run setup          # 安装前端依赖（只装 frontend/）
npx wrangler@4 login   # 浏览器授权 Cloudflare 账号，凭据存在本机
npx wrangler@4 whoami  # 确认已登录
```

> 本机当前**没有安装 git**（`git` 不在 PATH）。如果你要走 GitHub 自动发布，需要先装 git；否则用下面的直传方式即可。

---

## 2. 购买域名 tideoralab.com

我查过 Verisign 的 RDAP（.com 的权威注册库）：`https://rdap.verisign.com/com/v1/domain/tideoralab.com` 返回 **404，即未注册、可购买**。

购买必须由你本人完成（涉及付款和实名信息，我无法代操作）：

1. 登录 <https://dash.cloudflare.com> → 左侧 **Domain Registration → Register Domains**
2. 搜索 `tideoralab.com`，确认显示可注册
3. 加入购物车 → 填写注册人信息 → 付款
   - Cloudflare 按**成本价**卖，`.com` 约 **10.44 美元/年**，无溢价、无需续费加价，ICANN 费已含
   - 支持信用卡 / PayPal；`.com` 首次注册需 **1 年**起购
4. 注册完成后域名会自动出现在你的账号里，并自动使用 Cloudflare 的 DNS（名称服务器无需手动改）

注册完建议顺手做两件事：

- **开启 DNSSEC**：域名详情 → Configuration → DNSSEC → Enable
- **锁定转移**（Registrar Lock）默认已开，保持开启

> 如果 Cloudflare 对新注册风控拒绝（少数情况），备选：在 Porkbun / Namecheap 买，然后在 Cloudflare
> 添加该站点、把名称服务器改成 Cloudflare 分配的两个 NS，最后再考虑转入 Cloudflare Registrar。

---

## 3. 部署前端（三选一）

### A. 命令行直传（推荐，最快）

```bash
npm run deploy:cf
# = npm run build:web && npx wrangler@4 pages deploy
```

首次执行会问要创建哪个项目，项目名取 `wrangler.toml` 里的 `tideora`。
它会自动创建 Pages 项目并上传 `frontend/dist`，完成后给出 `https://tideora.pages.dev` 预览地址。

### B. 控制台拖拽上传

1. dashboard → **Workers & Pages → Create → Pages → Upload assets**
2. 项目名填 `tideora`
3. 把 `frontend/dist` 里的**内容**打包成 zip 上传（仓库根目录已生成 `tideora-site.zip`）

### C. GitHub 自动发布

1. 把仓库推到 GitHub
2. Pages → **Connect to Git** → 选择仓库
3. 构建设置：
   - Framework preset：`Vite`
   - **Root directory：`frontend`**
   - Build command：`npm run build`
   - Build output directory：`dist`
4. 之后每次 push 到主分支自动构建发布

> 注意：`npm run build` 会先跑 `tsc -b`，类型检查**必须**是绿的，否则构建直接失败。
> 本次部署前已修掉 `api.ts` 的两处类型错误（原先 `tsc -b` 报错，Pages 构建会失败）。

---

## 4. 绑定 www.tideoralab.com

### 4.1 主域名 www

Pages 项目 → **Custom domains → Set up a custom domain** → 输入 `www.tideoralab.com` → Activate。

因为域名就在同一个 Cloudflare 账号里，它会自动创建 `www` 的 CNAME 指向 `tideora.pages.dev` 并签好证书，
通常 1–5 分钟生效（状态从 `Initializing` 变 `Active`）。

### 4.2 裸域 301 跳到 www

站点对外统一用 `www`（报告图片里印的也是 www.tideoralab.com），所以裸域做跳转：

1. 同一个 Pages 项目再添加自定义域 `tideoralab.com`（让裸域能解析到 Pages）
2. 域名 `tideoralab.com` → **Rules → Redirect Rules → Create rule**
   - Rule name：`apex to www`
   - When incoming requests match：**Custom filter expression**
     ```
     http.host eq "tideoralab.com"
     ```
   - Then：**Dynamic redirect**
     - Expression：`concat("https://www.tideoralab.com", http.request.uri.path)`
     - Status code：`301`
     - Preserve query string：✅
3. 保存后访问 `http://tideoralab.com/anything` 应 301 到 `https://www.tideoralab.com/anything`

### 4.3 HTTPS

域名 → **SSL/TLS → Edge Certificates**：

- **Always Use HTTPS**：On
- **Automatic HTTPS Rewrites**：On

（Pages 自定义域默认就是 Full/Strict，无需改 SSL/TLS 模式，也不要设成 Flexible。）

---

## 5. 仓库里已经配好的东西

| 文件 | 作用 |
| --- | --- |
| `wrangler.toml` | Pages 项目名 `tideora`、构建输出目录 `frontend/dist`，供 `wrangler pages deploy` 读取 |
| `frontend/public/_headers` | 安全头（nosniff / Referrer-Policy / X-Frame-Options / Permissions-Policy）＋ 缓存策略：`/assets/*` 一年 immutable、`/images/*` 7 天、`/reports/*` 1 天、`index.html` 每次校验 |
| `frontend/public/_redirects` | `/* /index.html 200`，SPA 回退（虽然是 HashRouter，顺手保留，防止直接访问路径 404） |
| `package.json` | `npm run build:web`（只构建前端）、`npm run deploy:cf`（构建 + 直传） |
| `frontend/package.json` | `engines.node >= 20.19`，避免 Pages 用低版本 Node 构建失败 |

---

## 6. 上线验收清单

```bash
# 1) 站点与证书
curl -sI https://www.tideoralab.com/ | head -1          # 200
curl -sI http://tideoralab.com/ | grep -i -E "HTTP/|location"   # 301 -> https://www.tideoralab.com/

# 2) SPA 路由（HashRouter，路径在 # 后面）
curl -s https://www.tideoralab.com/ | grep -o '<title>[^<]*</title>'

# 3) 静态资源与报告图片
curl -sI https://www.tideoralab.com/assets/$(curl -s https://www.tideoralab.com/ | grep -o 'assets/index-[^"]*\.js') | head -1
curl -sI https://www.tideoralab.com/reports/00297a1bd9bb2b86.jpg | head -1   # 200, cache-control max-age=86400

# 4) 缓存头
curl -sI https://www.tideoralab.com/ | grep -i cache-control             # must-revalidate
curl -sI https://www.tideoralab.com/_headers | head -1                   # 404 或不返回，正常
```

浏览器里逐项确认：

- [ ] 首页、Catalogue、COA & Testing、Quality、FAQ、Shipping、Research notes、About 都能打开
- [ ] `#/coa` 列表 160 行，点 View 弹出报告，图片正常（六行字段对齐、品牌 Tideora）
- [ ] 商品详情切换规格，价格变化正确（卡片显示 $ 下限 – $ 上限）
- [ ] 购物车 → 结算 → “Pay via WhatsApp” 打开 `wa.me/8615190068041` 草稿，含订单号/规格/金额
- [ ] 手机端（宽度 390）布局正常，悬浮 WhatsApp 按钮可用
- [ ] 刷新页面不 404（`_redirects` 生效）

---

## 7. 以后怎么更新

```bash
npm run deploy:cf        # 改完代码：重新构建并发布
```

COA 报告有变动时：

```bash
python scripts/fix_test_report_fields.py                  # 重建本地样例报告
python scripts/mirror_report_images.py                    # 重新镜像/重排远程报告
npm run deploy:cf
```

---

## 8. 已知限制（上线前请确认能接受）

1. **订单只存在客户浏览器里。** 静态站没有后端，`localStorage` 保存的订单/账号/收藏只在那台设备和浏览器上；
   换设备、清缓存就没了，你自己的后台页面也只能看到本浏览器产生的数据。真正的订单信息是通过
   **WhatsApp 消息**到你手机上的。如果需要后台可查、可改状态的订单，得加一个服务端：
   - 现成的 Go 版后端（`backend/`，SQLite）放到一台 VPS/Fly.io 上，需要持久磁盘；
   - 或在 Cloudflare 上用 Workers + D1 重写订单接口。
2. **没有邮件、物流、支付网关、税费**。付款是 WhatsApp 人工确认，后台的“退款”只记录状态。
3. **报告图片 27.5 MB**。首次访问某份报告时才加载该张图（懒加载），之后走 CDN 缓存，不影响首页速度；
   但仓库和部署包会变大。`frontend/public/images/` 里另有约 16 MB 未被引用的旧图（`yuantid-*`、`photo-*`），
   想瘦身可以删掉，部署包能降到约 53 MB。
4. **静态站没有服务端重定向的表单校验**，`/api/*` 不存在，任何写到 `/api` 的请求都会落到 `_redirects` 返回
   `index.html` —— 当前代码不会发这种请求，但以后接后端时要注意。
5. **Cloudflare 会对内容做滥用审核**。本站是“仅供科研、非人用”的肽类产品站，页脚已有免责声明；
   如果收到投诉需要能提供合规说明，必要时准备下架流程。

---

## 9. 排错

| 现象 | 原因 / 处理 |
| --- | --- |
| Pages 构建失败 `TS2352` | 类型错误挡住了 `tsc -b`，本地先跑 `npm run build:web` 复现 |
| 部署后白屏 | 打开 devtools 看 `assets/index-*.js` 是否 404；多半是 Root directory 没设成 `frontend`，输出目录不是 `dist` |
| 自定义域一直 `Initializing` | 域名不在同一 Cloudflare 账号 → 需要在 DNS 里手动加 CNAME `www` → `tideora.pages.dev`（Proxied） |
| 裸域打不开 | 没添加 apex 自定义域，或 Redirect Rule 的表达式写成了 `www` |
| 图片 404 | 检查是否部署了 `frontend/public/reports/`（构建时应被复制到 `dist/reports/`） |
| 访问旧内容 | `index.html` 有 `must-revalidate`，强刷一次；或在 Pages 项目里 Purge cache |
