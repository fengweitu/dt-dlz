# API 约定

基础路径 `/api`，JSON 请求和响应。前端通过 Vite/Nginx 同源代理访问独立 Go API。会话使用 HttpOnly、SameSite=Lax Cookie。写请求检查 Origin 及 Sec-Fetch-Site，管理员接口额外校验角色。错误格式 `{"error":"message"}`；401 未登录、403 无权限、400 无效输入或状态、404 不存在、503 WhatsApp 未配置。

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | /health | 服务健康 |
| GET | /products | 活跃商品、规格、图集、价格范围 |
| GET | /me | 当前用户或 null |
| POST | /register | name / email / password，创建账号并登录 |
| POST | /login | email / password |
| POST | /logout | 清除会话 |
| POST | /subscribe | email，记录订阅 |
| GET / POST / DELETE | /favorites | POST/DELETE: product_id |
| GET / POST / DELETE | /addresses | POST: name / phone / detail；DELETE: id |
| POST | /quote | items / coupon，服务端报价 |
| POST | /orders | items / coupon / address，事务创建订单 |
| GET | /orders | 当前用户的订单 |
| POST | /orders/{id}/pay | 返回 WhatsApp URL，不更新付款状态 |
| POST | /orders/{id}/cancel | 取消待付款订单并恢复库存 |
| POST | /orders/{id}/receive | 确认已发货订单收货 |
| POST | /orders/{id}/refund | 发起退款请求 |
| GET | /admin/overview | 商家统计 |
| GET / POST / PATCH | /admin/products | 商品与已有规格管理 |
| GET / PATCH | /admin/orders | 查询订单；PATCH: id / tracking，发货 |
| POST | /admin/confirm-payment | id，人工核实后确认收款 |
| POST | /admin/refund | id，记录退款并恢复库存；不转账 |
| GET / POST | /admin/coupons | code / percent / minimum / active |

报价/订单示例（金额在服务端计算）：

```json
{
  "items": [{"id":2001,"variant_id":200101,"qty":1}],
  "coupon":"",
  "address":{"name":"Test customer","phone":"12025550123","detail":"Test address"}
}
```

`address` 只在创建订单时必填。商品和规格 ID 必须匹配；数量 1–99；不同规格可以并存，完全重复商品行拒绝。所有金额均为整数最小货币单位，例如 USD 8550 = $85.50。

订单状态为兼容旧数据库继续保存中文枚举，React 映射为英文：

```text
待付款 → 待发货（管理员确认收款）→ 已发货 → 已完成
待付款 → 已取消（恢复库存）
待发货 / 已发货 / 已完成 → 退款申请中 → 已退款（恢复库存）
```

商品 PATCH 必须保留全部已有规格（若提供 variants）；不能把其他商品规格 ID 移入本商品。变更失败时整个事务回滚。
