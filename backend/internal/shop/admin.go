package shop

import (
	"strings"
)

// adminAPI serves every /api/admin/* route; the trailing path segment selects
// the action, which Gin leaves intact on the request URL.
func adminAPI(c *request) any {
	c.auth(true)
	path := strings.TrimPrefix(c.r.URL.Path, "/api/admin/")
	switch path {
	case "overview":
		return Record{"users": one(c.tx, "SELECT COUNT(*) AS n FROM users")["n"], "orders": one(c.tx, "SELECT COUNT(*) AS n FROM orders")["n"], "subscribers": one(c.tx, "SELECT COUNT(*) AS n FROM subscribers")["n"], "revenue": one(c.tx, "SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE currency='USD' AND status IN ('待发货','已发货','已完成')")["n"]}
	case "products":
		if c.r.Method == "GET" {
			out := []Record{}
			for _, p := range rows(c.tx, "SELECT * FROM products ORDER BY id") {
				out = append(out, product(c.tx, p, true))
			}
			return out
		}
		return saveProduct(c)
	case "orders":
		if c.r.Method == "GET" {
			return listOrders(c)
		}
		res := exec(c.tx, "UPDATE orders SET status='已发货',tracking=? WHERE id=? AND status='待发货'", c.text("tracking", 100), c.text("id", 100))
		n, _ := res.RowsAffected()
		if n == 0 {
			fail(400, "Only processing orders can be shipped.")
		}
	case "confirm-payment":
		res := exec(c.tx, "UPDATE orders SET status='待发货',payment='whatsapp' WHERE id=? AND status='待付款'", c.text("id", 100))
		n, _ := res.RowsAffected()
		if n == 0 {
			fail(400, "Only an unpaid order can be confirmed.")
		}
	case "refund":
		o := one(c.tx, "SELECT * FROM orders WHERE id=? AND status='退款申请中'", c.text("id", 100))
		if o == nil {
			fail(400, "No pending refund request found.")
		}
		exec(c.tx, "UPDATE orders SET status='已退款' WHERE id=?", o["id"])
		inventory(c.tx, orderItems(o["items"]), 1)
		return Record{"ok": true, "message": "Refund recorded and stock restored. Arrange any transfer separately."}
	case "coupons":
		if c.r.Method == "GET" {
			return rows(c.tx, "SELECT * FROM coupons ORDER BY code")
		}
		exec(c.tx, "INSERT INTO coupons VALUES (?,?,?,?) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,minimum=excluded.minimum,active=excluded.active", strings.ToUpper(c.text("code", 30)), integer(c.data["percent"], 1, 90), integer(c.data["minimum"], 0, 1e8), active(c.data["active"]))
	default:
		fail(404, "Endpoint not found.")
	}
	return Record{"ok": true}
}
