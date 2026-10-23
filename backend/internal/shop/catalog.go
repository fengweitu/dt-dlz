package shop

import (
	"regexp"
	"strings"
)

func product(db queryer, p Record, all bool) Record {
	variants := rows(db, "SELECT * FROM product_variants WHERE product_id=? ORDER BY id", p["id"])
	visible := []Record{}
	stock := int64(0)
	min, max := int64(1<<62), int64(0)
	for _, v := range variants {
		if number(v["active"]) != 0 {
			stock += number(v["stock"])
			price := number(v["price"])
			if price < min {
				min = price
			}
			if price > max {
				max = price
			}
		}
		if all || number(v["active"]) != 0 {
			visible = append(visible, v)
		}
	}
	p["variants"] = visible
	p["max_price"] = p["price"]
	if len(variants) > 0 {
		p["stock"] = stock
		if max > 0 {
			p["price"] = min
			p["max_price"] = max
		}
	}
	gallery := []string{str(p["image"])}
	if str(p["gallery"]) != "" {
		for _, v := range decode(str(p["gallery"])).([]any) {
			url := str(v)
			found := false
			for _, g := range gallery {
				if g == url {
					found = true
				}
			}
			if !found {
				gallery = append(gallery, url)
			}
		}
	}
	p["gallery"] = gallery
	return p
}
func products(c *request) any {
	out := []Record{}
	for _, p := range rows(c.tx, "SELECT * FROM products WHERE active=1 ORDER BY id") {
		out = append(out, product(c.tx, p, false))
	}
	return out
}
func saveProduct(c *request) any {
	fields := []string{"name", "subtitle", "category", "image", "description", "price", "old_price", "stock", "tag", "active"}
	values := []any{}
	for _, k := range fields[:5] {
		max := 500
		if k == "description" {
			max = 2000
		}
		values = append(values, c.text(k, max))
	}
	image := str(values[3])
	if !strings.HasPrefix(image, "https://") && !regexp.MustCompile(`^/images/[a-zA-Z0-9_.-]+$`).MatchString(image) {
		fail(400, "Use an HTTPS image URL or a local /images/ path.")
	}
	values = append(values, integer(c.data["price"], 1, 1e8), integer(c.data["old_price"], 0, 1e8), integer(c.data["stock"], 0, 1e8), str(c.data["tag"]), active(c.data["active"]))
	if c.r.Method == "POST" {
		exec(c.tx, "INSERT INTO products("+strings.Join(fields, ",")+") VALUES (?,?,?,?,?,?,?,?,?,?)", values...)
	} else {
		id := integer(c.data["id"], 1, 1e9)
		assign := []string{}
		for _, k := range fields {
			assign = append(assign, k+"=?")
		}
		res := exec(c.tx, "UPDATE products SET "+strings.Join(assign, ",")+" WHERE id=?", append(values, id)...)
		n, _ := res.RowsAffected()
		if n == 0 {
			fail(404, "Product not found.")
		}
		existing := rows(c.tx, "SELECT * FROM product_variants WHERE product_id=?", id)
		if len(existing) > 0 {
			if raw, ok := c.data["variants"]; ok {
				supplied, ok := raw.([]any)
				if !ok || len(supplied) != len(existing) {
					fail(400, "All existing specifications must be provided.")
				}
				allowed := map[int64]bool{}
				for _, v := range existing {
					allowed[number(v["id"])] = true
				}
				for _, raw := range supplied {
					v, ok := raw.(map[string]any)
					if !ok {
						fail(400, "Invalid specification.")
					}
					vid := integer(v["id"], 1, 1e12)
					if !allowed[vid] {
						fail(400, "Invalid specification reference.")
					}
					delete(allowed, vid)
					label := strings.TrimSpace(str(v["label"]))
					if label == "" || len([]rune(label)) > 150 {
						fail(400, "Invalid specification label.")
					}
					exec(c.tx, "UPDATE product_variants SET label=?,price=?,stock=?,active=? WHERE id=? AND product_id=?", label, integer(v["price"], 1, 1e8), integer(v["stock"], 0, 1e6), active(v["active"]), vid, id)
				}
			}
			exec(c.tx, "UPDATE products SET price=COALESCE((SELECT MIN(price) FROM product_variants WHERE product_id=? AND active=1),price),stock=(SELECT COALESCE(SUM(stock),0) FROM product_variants WHERE product_id=? AND active=1) WHERE id=?", id, id, id)
		}
	}
	return Record{"ok": true}
}
