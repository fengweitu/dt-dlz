package shop

import (
	"database/sql"
	_ "embed"
	"encoding/json"
	"fmt"
	_ "github.com/mattn/go-sqlite3"
	"os"
	"path/filepath"
)

//go:embed schema.sql
var schema string

type Record map[string]any
type queryer interface {
	Query(string, ...any) (*sql.Rows, error)
	Exec(string, ...any) (sql.Result, error)
}

func rows(db queryer, q string, args ...any) []Record {
	rs, err := db.Query(q, args...)
	must(err)
	defer rs.Close()
	cols, err := rs.Columns()
	must(err)
	result := []Record{}
	for rs.Next() {
		values := make([]any, len(cols))
		refs := make([]any, len(cols))
		for i := range values {
			refs[i] = &values[i]
		}
		must(rs.Scan(refs...))
		r := Record{}
		for i, k := range cols {
			if b, ok := values[i].([]byte); ok {
				r[k] = string(b)
			} else {
				r[k] = values[i]
			}
		}
		result = append(result, r)
	}
	must(rs.Err())
	return result
}
func one(db queryer, q string, args ...any) Record {
	r := rows(db, q, args...)
	if len(r) == 0 {
		return nil
	}
	return r[0]
}
func exec(db queryer, q string, args ...any) sql.Result {
	r, e := db.Exec(q, args...)
	must(e)
	return r
}
func must(err error) {
	if err != nil {
		panic(err)
	}
}
func number(v any) int64 {
	switch n := v.(type) {
	case int:
		return int64(n)
	case int64:
		return n
	case json.Number:
		i, e := n.Int64()
		if e == nil {
			return i
		}
	case float64:
		if n == float64(int64(n)) {
			return int64(n)
		}
	}
	return 0
}
func str(v any) string     { s, _ := v.(string); return s }
func encoded(v any) string { b, e := json.Marshal(v); must(e); return string(b) }
func decode(s string) any  { var v any; must(json.Unmarshal([]byte(s), &v)); return v }

func OpenDB(root, path string) (db *sql.DB, err error) {
	defer func() {
		if p := recover(); p != nil {
			if db != nil {
				db.Close()
			}
			err = fmt.Errorf("database initialization: %v", p)
		}
	}()
	if path == "" {
		path = filepath.Join(root, "data", "shop.db")
	}
	must(os.MkdirAll(filepath.Dir(path), 0700))
	db, err = sql.Open("sqlite3", path+"?_foreign_keys=on&_busy_timeout=15000&_journal_mode=WAL&_txlock=immediate")
	must(err)
	db.SetMaxOpenConns(1)
	exec(db, schema)
	tx, err := db.Begin()
	must(err)
	defer tx.Rollback()
	// Existing Python databases are reused without rewriting accounts, inventory or orders.
	if one(tx, "SELECT name FROM migrations WHERE name='go-catalog-v1'") == nil {
		if number(one(tx, "SELECT COUNT(*) AS n FROM products")["n"]) == 0 {
			raw, e := os.ReadFile(filepath.Join(root, "catalog.json"))
			must(e)
			var products []Record
			must(json.Unmarshal(raw, &products))
			for _, p := range products {
				exec(tx, "INSERT INTO products(id,name,subtitle,category,price,old_price,stock,image,tag,description,source_url,source_checked_on,gallery) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", p["id"], p["name"], p["subtitle"], p["category"], p["price"], p["old_price"], p["stock"], p["image"], p["tag"], p["description"], p["source_url"], p["source_checked_on"], encoded(p["gallery"]))
				for _, raw := range p["variants"].([]any) {
					v := raw.(map[string]any)
					exec(tx, "INSERT INTO product_variants(id,product_id,label,price,stock,active,source_variant_id) VALUES (?,?,?,?,?,?,?)", v["id"], p["id"], v["label"], v["price"], v["stock"], v["active"], v["source_variant_id"])
				}
			}
		}
		exec(tx, "INSERT INTO migrations(name) VALUES ('go-catalog-v1')")
	}
	exec(tx, "INSERT OR IGNORE INTO coupons VALUES ('WELCOME10',10,0,1)")
	if email, password := os.Getenv("ADMIN_EMAIL"), os.Getenv("ADMIN_PASSWORD"); email != "" && password != "" {
		if len(password) < 10 {
			return db, fmt.Errorf("ADMIN_PASSWORD must contain at least 10 characters")
		}
		exec(tx, "INSERT OR IGNORE INTO users(name,email,password,role) VALUES (?,?,?,'admin')", "Administrator", normalizeEmail(email), hashPassword(password))
	}
	must(tx.Commit())
	return db, nil
}
