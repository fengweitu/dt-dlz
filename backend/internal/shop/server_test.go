package shop

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"golang.org/x/crypto/pbkdf2"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

type client struct {
	t      *testing.T
	s      *Server
	h      http.Handler
	cookie string
}

func setup(t *testing.T) *client {
	t.Helper()
	root, e := filepath.Abs("../../..")
	if e != nil {
		t.Fatal(e)
	}
	db, e := OpenDB(root, filepath.Join(t.TempDir(), "shop.db"))
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { db.Close() })
	s := &Server{DB: db, Root: root}
	c := &client{t: t, s: s, h: s.Handler()}
	c.register()
	return c
}
func (c *client) call(method, path string, data any) (int, any) {
	c.t.Helper()
	body := []byte{}
	if data != nil {
		body = []byte(encoded(data))
	}
	r := httptest.NewRequest(method, "http://localhost/api"+path, bytes.NewReader(body))
	if c.cookie != "" {
		r.Header.Set("Cookie", c.cookie)
	}
	w := httptest.NewRecorder()
	c.h.ServeHTTP(w, r)
	for _, cookie := range w.Result().Cookies() {
		c.cookie = cookie.Name + "=" + cookie.Value
	}
	var value any
	if e := json.Unmarshal(w.Body.Bytes(), &value); e != nil {
		c.t.Fatalf("invalid JSON: %s", w.Body.String())
	}
	return w.Code, value
}
func (c *client) expect(method, path string, data any, status int) any {
	c.t.Helper()
	code, v := c.call(method, path, data)
	if code != status {
		c.t.Fatalf("%s %s: got %d want %d: %v", method, path, code, status, v)
	}
	return v
}
func (c *client) register() {
	c.expect("POST", "/register", Record{"name": "Test customer", "email": token(6) + "@example.test", "password": "test-password"}, 200)
}
func (c *client) admin() {
	exec(c.s.DB, "INSERT OR IGNORE INTO users(name,email,password,role) VALUES ('Admin','admin@example.test',?,'admin')", hashPassword("admin-password"))
	c.expect("POST", "/login", Record{"email": "admin@example.test", "password": "admin-password"}, 200)
}
func orderData() Record {
	return Record{"items": []Record{{"id": 2001, "variant_id": 200101, "qty": 1}}, "address": Record{"name": "Test customer", "phone": "12025550123", "detail": "Test address only"}}
}
func (c *client) order() Record {
	return Record(c.expect("POST", "/orders", orderData(), 201).(map[string]any))
}

func TestCatalogAndPriceIntegrity(t *testing.T) {
	c := setup(t)
	ps := c.expect("GET", "/products", nil, 200).([]any)
	if len(ps) != 30 {
		t.Fatal(len(ps))
	}
	count := 0
	for _, raw := range ps {
		p := raw.(map[string]any)
		count += len(p["variants"].([]any))
		for _, raw := range p["gallery"].([]any) {
			if _, e := os.Stat(filepath.Join(c.s.Root, "frontend/public", str(raw))); e != nil {
				t.Fatal(e)
			}
		}
	}
	if count != 82 {
		t.Fatal(count)
	}
	q := c.expect("POST", "/quote", Record{"items": []Record{{"id": 2001, "variant_id": 200102, "qty": 1, "price": 1}}, "coupon": "WELCOME10"}, 200).(map[string]any)
	if number(q["subtotal"]) != 13500 || number(q["total"]) != 13650 {
		t.Fatal(q)
	}
}
func TestInvalidCartAndOrigin(t *testing.T) {
	c := setup(t)
	for _, items := range []any{[]any{}, []Record{{"id": 2001, "variant_id": 200101, "qty": -1}}, []Record{{"id": 2001, "variant_id": 200101, "qty": 1.5}}, []Record{{"id": 2001, "variant_id": 200101, "qty": true}}, []Record{{"id": 2001, "variant_id": 200201, "qty": 1}}, []Record{{"id": 2001, "variant_id": 200101, "qty": 1}, {"id": 2001, "variant_id": 200101, "qty": 1}}} {
		c.expect("POST", "/quote", Record{"items": items}, 400)
	}
	r := httptest.NewRequest("POST", "http://localhost/api/logout", strings.NewReader("{}"))
	r.Header.Set("Origin", "https://evil.test")
	w := httptest.NewRecorder()
	c.h.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal(w.Code)
	}
	c.cookie = ""
	c.expect("GET", "/orders", nil, 401)
}
func TestCancellationOwnershipAndInventory(t *testing.T) {
	c := setup(t)
	before := number(one(c.s.DB, "SELECT stock FROM product_variants WHERE id=200101")["stock"])
	o := c.order()
	owner := c.cookie
	c.register()
	c.expect("POST", "/orders/"+str(o["id"])+"/cancel", Record{}, 404)
	c.cookie = owner
	c.expect("POST", "/orders/"+str(o["id"])+"/cancel", Record{}, 200)
	c.expect("POST", "/orders/"+str(o["id"])+"/cancel", Record{}, 400)
	if number(one(c.s.DB, "SELECT stock FROM product_variants WHERE id=200101")["stock"]) != before {
		t.Fatal("inventory changed")
	}
}
func TestWhatsAppAndOrderLifecycle(t *testing.T) {
	c := setup(t)
	t.Setenv("WHATSAPP_NUMBER", "+1 202 555 0123")
	o := c.order()
	path := "/orders/" + str(o["id"])
	r := c.expect("POST", path+"/pay", Record{}, 200).(map[string]any)
	u, e := url.Parse(str(r["url"]))
	if e != nil || u.Host != "wa.me" || u.Path != "/12025550123" {
		t.Fatal(r)
	}
	msg := u.Query().Get("text")
	if !strings.Contains(msg, "100.50") || !strings.Contains(msg, str(o["id"])) || strings.Contains(msg, "Test address") {
		t.Fatal(msg)
	}
	if one(c.s.DB, "SELECT status FROM orders WHERE id=?", o["id"])["status"] != "待付款" {
		t.Fatal("redirect marked paid")
	}
	c.expect("POST", "/admin/confirm-payment", Record{"id": o["id"]}, 403)
	owner := c.cookie
	c.admin()
	c.expect("POST", "/admin/confirm-payment", Record{"id": o["id"]}, 200)
	c.expect("POST", "/admin/confirm-payment", Record{"id": o["id"]}, 400)
	c.expect("PATCH", "/admin/orders", Record{"id": o["id"], "tracking": "UPS TEST"}, 200)
	c.cookie = owner
	c.expect("POST", path+"/receive", Record{}, 200)
	if one(c.s.DB, "SELECT status FROM orders WHERE id=?", o["id"])["status"] != "已完成" {
		t.Fatal("not completed")
	}
	t.Setenv("WHATSAPP_NUMBER", "invalid")
	o = c.order()
	c.expect("POST", "/orders/"+str(o["id"])+"/pay", Record{}, 503)
}
func TestRefundRestoresOnce(t *testing.T) {
	c := setup(t)
	o := c.order()
	owner := c.cookie
	c.admin()
	c.expect("POST", "/admin/confirm-payment", Record{"id": o["id"]}, 200)
	c.cookie = owner
	c.expect("POST", "/orders/"+str(o["id"])+"/refund", Record{}, 200)
	c.expect("POST", "/admin/refund", Record{"id": o["id"]}, 403)
	c.admin()
	c.expect("POST", "/admin/refund", Record{"id": o["id"]}, 200)
	c.expect("POST", "/admin/refund", Record{"id": o["id"]}, 400)
	if number(one(c.s.DB, "SELECT stock FROM product_variants WHERE id=200101")["stock"]) != 100 {
		t.Fatal("inventory incorrect")
	}
}
func TestConcurrentOrdersCannotOversell(t *testing.T) {
	c := setup(t)
	exec(c.s.DB, "UPDATE product_variants SET stock=1 WHERE id=200101")
	exec(c.s.DB, "UPDATE products SET stock=101 WHERE id=2001")
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			other := &client{t: t, s: c.s, h: c.h, cookie: c.cookie}
			code, _ := other.call("POST", "/orders", orderData())
			codes <- code
		}()
	}
	wg.Wait()
	close(codes)
	success := 0
	for code := range codes {
		if code == 201 {
			success++
		} else if code != 400 {
			t.Fatal(code)
		}
	}
	if success != 1 {
		t.Fatal(success)
	}
}
func TestFavoritesAddressesAndLogout(t *testing.T) {
	c := setup(t)
	c.expect("POST", "/favorites", Record{"product_id": 2001}, 200)
	if len(c.expect("GET", "/favorites", nil, 200).([]any)) != 1 {
		t.Fatal("missing favorite")
	}
	a := c.expect("POST", "/addresses", Record{"name": "Test", "phone": "12025550123", "detail": "Test address"}, 200).(map[string]any)
	c.expect("DELETE", "/addresses", Record{"id": a["id"]}, 200)
	c.expect("DELETE", "/favorites", Record{"product_id": 2001}, 200)
	c.expect("POST", "/logout", Record{}, 200)
	c.expect("GET", "/addresses", nil, 401)
}
func TestAdminVariantRollbackAndCoupons(t *testing.T) {
	c := setup(t)
	c.admin()
	ps := c.expect("GET", "/admin/products", nil, 200).([]any)
	p := ps[0].(map[string]any)
	vs := p["variants"].([]any)
	v := vs[0].(map[string]any)
	v["price"] = 9999
	c.expect("PATCH", "/admin/products", p, 200)
	v["id"] = 200201
	p["name"] = "Must rollback"
	c.expect("PATCH", "/admin/products", p, 400)
	if one(c.s.DB, "SELECT name FROM products WHERE id=2001")["name"] == "Must rollback" {
		t.Fatal("invalid mutation committed")
	}
	c.expect("POST", "/admin/coupons", Record{"code": "TEST", "percent": 20, "minimum": 0, "active": true}, 200)
	c.expect("POST", "/admin/coupons", Record{"code": "BAD", "percent": 100, "minimum": 0}, 400)
}
func TestWelcomeCouponAndDistinctVariants(t *testing.T) {
	c := setup(t)
	data := orderData()
	data["coupon"] = "WELCOME10"
	data["items"] = []Record{{"id": 2001, "variant_id": 200101, "qty": 1}, {"id": 2001, "variant_id": 200102, "qty": 1}}
	o := c.expect("POST", "/orders", data, 201).(map[string]any)
	if len(o["items"].([]any)) != 2 {
		t.Fatal(o)
	}
	c.expect("POST", "/orders", data, 400)
}
func TestUnknownRouteAndMethodReturnJSON(t *testing.T) {
	c := setup(t)
	if v := c.expect("GET", "/not-a-route", nil, 404).(map[string]any); v["error"] == nil {
		t.Fatal(v)
	}
	if v := c.expect("GET", "/logout", nil, 405).(map[string]any); v["error"] == nil {
		t.Fatal(v)
	}
}
func TestLegacyPasswordAndDatabaseReopen(t *testing.T) {
	c := setup(t)
	salt := "legacy-salt"
	hash := salt + ":" + hex.EncodeToString(pbkdf2.Key([]byte("legacy-password"), []byte(salt), 200000, 32, sha256.New))
	exec(c.s.DB, "INSERT INTO users(name,email,password) VALUES ('Legacy','legacy@example.test',?)", hash)
	c.expect("POST", "/login", Record{"email": "legacy@example.test", "password": "legacy-password"}, 200)
	if !strings.HasPrefix(str(one(c.s.DB, "SELECT password FROM users WHERE email='legacy@example.test'")["password"]), "$2") {
		t.Fatal("hash not upgraded")
	}
	o := c.order()
	exec(c.s.DB, "UPDATE orders SET currency='CNY' WHERE id=?", o["id"])
	file := str(one(c.s.DB, "PRAGMA database_list")["file"])
	db, e := OpenDB(c.s.Root, file)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	if one(db, "SELECT currency FROM orders WHERE id=?", o["id"])["currency"] != "CNY" {
		t.Fatal("legacy currency changed")
	}
	if number(one(db, "SELECT COUNT(*) AS n FROM products")["n"]) != 30 {
		t.Fatal("catalog duplicated")
	}
}
