package shop

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/crypto/pbkdf2"
	"regexp"
	"strings"
	"time"
)

func token(n int) string {
	b := make([]byte, n)
	_, e := rand.Read(b)
	must(e)
	return hex.EncodeToString(b)
}
func normalizeEmail(v string) string { return strings.ToLower(strings.TrimSpace(v)) }
func hashPassword(v string) string {
	b, e := bcrypt.GenerateFromPassword([]byte(v), bcrypt.DefaultCost)
	must(e)
	return string(b)
}
func verifyPassword(hash, password string) bool {
	if strings.HasPrefix(hash, "$2") {
		return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
	}
	parts := strings.Split(hash, ":")
	if len(parts) != 2 {
		return false
	}
	derived := hex.EncodeToString(pbkdf2.Key([]byte(password), []byte(parts[0]), 200000, 32, sha256.New))
	return subtle.ConstantTimeCompare([]byte(derived), []byte(parts[1])) == 1
}
func validEmail(email string) {
	if !regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`).MatchString(email) {
		fail(400, "Please enter a valid email address.")
	}
}
func authenticate(c *request) any {
	email := normalizeEmail(c.text("email", 200))
	validEmail(email)
	password := c.text("password", 128)
	if strings.HasSuffix(c.r.URL.Path, "register") {
		if len(password) < 8 || len(password) > 72 {
			fail(400, "Password must contain 8–72 bytes.")
		}
		exec(c.tx, "INSERT INTO users(name,email,password) VALUES (?,?,?)", c.text("name", 40), email, hashPassword(password))
	}
	u := one(c.tx, "SELECT * FROM users WHERE email=?", email)
	if u == nil || !verifyPassword(str(u["password"]), password) {
		fail(401, "Incorrect email or password.")
	}
	// Upgrade legacy PBKDF2 hashes after a successful sign-in without resetting passwords.
	if !strings.HasPrefix(str(u["password"]), "$2") && len(password) <= 72 {
		exec(c.tx, "UPDATE users SET password=? WHERE id=?", hashPassword(password), u["id"])
	}
	t := token(32)
	exec(c.tx, "DELETE FROM sessions WHERE expires<?", time.Now().Unix())
	exec(c.tx, "INSERT INTO sessions VALUES (?,?,?)", t, u["id"], time.Now().Unix()+604800)
	cookie(c.w, t, 604800)
	delete(u, "password")
	return u
}
func logout(c *request) any {
	if t, e := c.r.Cookie("session"); e == nil {
		exec(c.tx, "DELETE FROM sessions WHERE token=?", t.Value)
	}
	cookie(c.w, "", -1)
	return Record{"ok": true}
}
func subscribe(c *request) any {
	e := normalizeEmail(c.text("email", 200))
	validEmail(e)
	exec(c.tx, "INSERT OR IGNORE INTO subscribers VALUES (?,?)", e, time.Now().Unix())
	return Record{"ok": true}
}
func profile(c *request) any {
	c.auth(false)
	uid := c.user["id"]
	method := c.r.Method
	if strings.HasSuffix(c.r.URL.Path, "favorites") {
		if method == "GET" {
			ids := []int64{}
			for _, r := range rows(c.tx, "SELECT product_id FROM favorites WHERE user_id=?", uid) {
				ids = append(ids, number(r["product_id"]))
			}
			return ids
		}
		id := integer(c.data["product_id"], 1, 1e9)
		if one(c.tx, "SELECT id FROM products WHERE id=? AND active=1", id) == nil {
			fail(404, "Product not found.")
		}
		if method == "POST" {
			exec(c.tx, "INSERT OR IGNORE INTO favorites VALUES (?,?)", uid, id)
		} else {
			exec(c.tx, "DELETE FROM favorites WHERE user_id=? AND product_id=?", uid, id)
		}
	} else {
		switch method {
		case "GET":
			return rows(c.tx, "SELECT id,name,phone,detail FROM addresses WHERE user_id=?", uid)
		case "POST":
			r := exec(c.tx, "INSERT INTO addresses(user_id,name,phone,detail) VALUES (?,?,?,?)", uid, c.text("name", 50), c.text("phone", 30), c.text("detail", 300))
			id, e := r.LastInsertId()
			must(e)
			return Record{"id": id}
		case "DELETE":
			exec(c.tx, "DELETE FROM addresses WHERE id=? AND user_id=?", integer(c.data["id"], 1, 1e9), uid)
		}
	}
	return Record{"ok": true}
}
