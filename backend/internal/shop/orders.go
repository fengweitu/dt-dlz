package shop

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

func inventory(db queryer, items []Record, direction int64) {
	for _, i := range items {
		qty := number(i["qty"]) * direction
		exec(db, "UPDATE products SET stock=stock+? WHERE id=?", qty, i["id"])
		if i["variant_id"] != nil {
			exec(db, "UPDATE product_variants SET stock=stock+? WHERE id=? AND product_id=?", qty, i["variant_id"], i["id"])
		}
	}
}
func orderItems(v any) []Record {
	if s, ok := v.(string); ok {
		v = decode(s)
	}
	out := []Record{}
	for _, i := range v.([]any) {
		out = append(out, Record(i.(map[string]any)))
	}
	return out
}
func quoteOrder(c *request) any {
	placing := c.r.URL.Path == "/api/orders"
	if placing {
		c.auth(false)
	}
	raw, ok := c.data["items"].([]any)
	if !ok || len(raw) == 0 || len(raw) > 50 {
		fail(400, "Your bag is empty or contains too many products.")
	}
	items := []Record{}
	seen := map[string]bool{}
	subtotal := int64(0)
	for _, raw := range raw {
		i, ok := raw.(map[string]any)
		if !ok {
			fail(400, "Invalid product format.")
		}
		id := integer(i["id"], 1, 1e9)
		qty := integer(i["qty"], 1, 99)
		var vid any
		if i["variant_id"] != nil {
			vid = integer(i["variant_id"], 1, 1e12)
		}
		key := fmt.Sprint(id, "/", vid)
		if seen[key] {
			fail(400, "Duplicate product specification.")
		}
		seen[key] = true
		p := one(c.tx, "SELECT * FROM products WHERE id=? AND active=1", id)
		if p == nil {
			fail(400, "A product is no longer available.")
		}
		var v Record
		if one(c.tx, "SELECT id FROM product_variants WHERE product_id=?", id) != nil {
			v = one(c.tx, "SELECT * FROM product_variants WHERE id=? AND product_id=? AND active=1", vid, id)
			if v == nil {
				fail(400, "Please select a valid specification.")
			}
		} else if vid != nil {
			fail(400, "This product has no specifications.")
		}
		price, stock, label := number(p["price"]), number(p["stock"]), ""
		if v != nil {
			price = number(v["price"])
			stock = number(v["stock"])
			label = str(v["label"])
		}
		if qty > stock {
			fail(400, str(p["name"])+" has insufficient stock for this specification.")
		}
		items = append(items, Record{"id": id, "name": p["name"], "price": price, "image": p["image"], "qty": qty, "variant_id": vid, "variant_label": label})
		subtotal += price * qty
	}
	code := ""
	if v, exists := c.data["coupon"]; exists {
		var ok bool
		code, ok = v.(string)
		if !ok {
			fail(400, "Invalid promo code.")
		}
	}
	code = strings.ToUpper(strings.TrimSpace(code))
	discount := int64(0)
	if code != "" {
		coupon := one(c.tx, "SELECT * FROM coupons WHERE code=? AND active=1", code)
		if coupon == nil {
			fail(400, "This promo code is invalid or inactive.")
		}
		if code == "WELCOME10" && c.user != nil && one(c.tx, "SELECT id FROM orders WHERE user_id=? AND status!='已取消'", c.user["id"]) != nil {
			fail(400, "This welcome offer is only valid on your first order.")
		}
		if subtotal < number(coupon["minimum"]) {
			fail(400, "The minimum spend for this offer has not been met.")
		}
		discount = subtotal * number(coupon["percent"]) / 100
	}
	shipping := int64(1500)
	if subtotal >= 29900 {
		shipping = 0
	}
	q := Record{"currency": "USD", "items": items, "subtotal": subtotal, "discount": discount, "shipping": shipping, "total": subtotal - discount + shipping}
	if !placing {
		return q
	}
	address, ok := c.data["address"].(map[string]any)
	if !ok {
		fail(400, "Please complete your delivery address.")
	}
	for _, k := range []string{"name", "phone", "detail"} {
		v := strings.TrimSpace(str(address[k]))
		if v == "" || len([]rune(v)) > 300 {
			fail(400, "Please complete your delivery address.")
		}
	}
	id := "AL" + time.Now().Format("20060102") + strings.ToUpper(token(4))
	inventory(c.tx, items, -1)
	exec(c.tx, "INSERT INTO orders(id,user_id,items,address,subtotal,discount,shipping,total,status,created,currency,payment) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", id, c.user["id"], encoded(items), encoded(address), subtotal, discount, shipping, q["total"], "待付款", time.Now().Unix(), "USD", "whatsapp")
	q["id"] = id
	c.status = 201
	return q
}
func listOrders(c *request) any {
	c.auth(false)
	q := "SELECT * FROM orders WHERE user_id=? ORDER BY created DESC,id DESC"
	args := []any{c.user["id"]}
	if strings.Contains(c.r.URL.Path, "/admin/") {
		q = "SELECT o.*,u.email FROM orders o JOIN users u ON o.user_id=u.id ORDER BY created DESC,id DESC"
		args = nil
	}
	out := rows(c.tx, q, args...)
	for _, o := range out {
		o["items"] = decode(str(o["items"]))
		o["address"] = decode(str(o["address"]))
	}
	return out
}

// whatsappNumber returns the configured contact number in digits-only form, or
// an empty string when the store has not been given a usable number yet. The
// environment variable takes precedence over store-config.json, and the file is
// read on every call so the number can change without a restart.
func (s *Server) whatsappNumber() string {
	phone := os.Getenv("WHATSAPP_NUMBER")
	if phone == "" {
		raw, e := os.ReadFile(filepath.Join(s.Root, "store-config.json"))
		if e != nil {
			return ""
		}
		var config struct {
			Number string `json:"whatsapp_number"`
		}
		if json.Unmarshal(raw, &config) != nil {
			return ""
		}
		phone = config.Number
	}
	phone = regexp.MustCompile(`[+ ()-]`).ReplaceAllString(phone, "")
	if !regexp.MustCompile(`^[1-9][0-9]{6,14}$`).MatchString(phone) {
		return ""
	}
	return phone
}

// contact exposes the WhatsApp entry point used by the floating contact button.
// An unconfigured store returns empty strings so the storefront can show the
// placeholder state instead of a broken link.
func contact(c *request) any {
	phone := c.s.whatsappNumber()
	if phone == "" {
		return Record{"whatsapp_number": "", "whatsapp_url": ""}
	}
	return Record{"whatsapp_number": phone, "whatsapp_url": "https://wa.me/" + phone}
}
func (s *Server) paymentURL(o Record) string {
	phone := s.whatsappNumber()
	if phone == "" {
		fail(503, "WhatsApp payment contact is not configured yet. Please try again later.")
	}
	lines := []string{"Hello, I would like to arrange payment for AURELIS order " + str(o["id"]) + "."}
	for _, i := range orderItems(o["items"]) {
		lines = append(lines, fmt.Sprintf("%s — %s × %d", str(i["name"]), str(i["variant_label"]), number(i["qty"])))
	}
	lines = append(lines, fmt.Sprintf("Total: %s %.2f", str(o["currency"]), float64(number(o["total"]))/100))
	return "https://wa.me/" + phone + "?text=" + url.QueryEscape(strings.Join(lines, "\n"))
}
func orderAction(c *request) any {
	c.auth(false)
	id, action := c.g.Param("id"), c.g.Param("action")
	o := one(c.tx, "SELECT * FROM orders WHERE id=? AND user_id=?", id, c.user["id"])
	if o == nil {
		fail(404, "Order not found.")
	}
	status := str(o["status"])
	switch action {
	case "pay":
		if status != "待付款" {
			fail(400, "This order cannot be paid in its current state.")
		}
		return Record{"url": c.s.paymentURL(o), "status": status}
	case "cancel":
		if status != "待付款" {
			fail(400, "Only unpaid orders can be cancelled.")
		}
		status = "已取消"
		inventory(c.tx, orderItems(o["items"]), 1)
	case "refund":
		if status != "待发货" && status != "已发货" && status != "已完成" {
			fail(400, "This order is not eligible for a refund request.")
		}
		status = "退款申请中"
	case "receive":
		if status != "已发货" {
			fail(400, "This order has not been shipped.")
		}
		status = "已完成"
	default:
		fail(404, "Endpoint not found.")
	}
	exec(c.tx, "UPDATE orders SET status=? WHERE id=?", status, id)
	return Record{"ok": true, "status": status, "message": "Order updated."}
}
