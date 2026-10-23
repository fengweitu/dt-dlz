package shop

import (
	"database/sql"
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"
	"github.com/mattn/go-sqlite3"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type Server struct {
	DB            *sql.DB
	Root          string
	AllowedOrigin string
}
type apiError struct {
	Status  int
	Message string
}

func fail(code int, message string) { panic(apiError{code, message}) }

type request struct {
	s      *Server
	tx     *sql.Tx
	g      *gin.Context
	r      *http.Request
	w      http.ResponseWriter
	data   Record
	user   Record
	status int
}

// Handler builds the Gin engine. Gin owns routing and path parameters only:
// transactions, sessions, validation and error translation stay in wrap, so a
// handler still receives one *request and returns a value to encode.
func (s *Server) Handler() http.Handler {
	// GIN_MODE, when set, still wins so the route table can be inspected.
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	// No proxy is trusted: the API reads no client-IP headers of its own.
	must(r.SetTrustedProxies(nil))
	r.HandleMethodNotAllowed = true
	// wrap recovers panics raised inside a handler; this catches anything else
	// so the client still receives JSON rather than a dropped connection.
	r.Use(gin.CustomRecovery(func(g *gin.Context, err any) {
		log.Printf("request error: %v", err)
		writeJSON(g.Writer, 500, Record{"error": "Server unavailable."})
	}))
	r.NoRoute(func(g *gin.Context) {
		writeJSON(g.Writer, 404, Record{"error": "Endpoint not found."})
	})
	r.NoMethod(func(g *gin.Context) {
		writeJSON(g.Writer, 405, Record{"error": "Method not allowed."})
	})
	r.GET("/api/health", func(g *gin.Context) {
		writeJSON(g.Writer, 200, Record{"status": "ok", "service": "aurelis-go-api"})
	})
	api := r.Group("/api")
	api.GET("/products", s.wrap(products))
	api.GET("/contact", s.wrap(contact))
	api.GET("/me", s.wrap(func(c *request) any { return c.user }))
	api.POST("/register", s.wrap(authenticate))
	api.POST("/login", s.wrap(authenticate))
	api.POST("/logout", s.wrap(logout))
	api.POST("/subscribe", s.wrap(subscribe))
	for _, p := range []string{"/favorites", "/addresses"} {
		api.GET(p, s.wrap(profile))
		api.POST(p, s.wrap(profile))
		api.DELETE(p, s.wrap(profile))
	}
	api.POST("/quote", s.wrap(quoteOrder))
	api.POST("/orders", s.wrap(quoteOrder))
	api.GET("/orders", s.wrap(listOrders))
	api.POST("/orders/:id/:action", s.wrap(orderAction))
	admin := api.Group("/admin")
	admin.GET("/overview", s.wrap(adminAPI))
	admin.GET("/products", s.wrap(adminAPI))
	admin.POST("/products", s.wrap(adminAPI))
	admin.PATCH("/products", s.wrap(adminAPI))
	admin.GET("/orders", s.wrap(adminAPI))
	admin.PATCH("/orders", s.wrap(adminAPI))
	admin.POST("/confirm-payment", s.wrap(adminAPI))
	admin.POST("/refund", s.wrap(adminAPI))
	admin.GET("/coupons", s.wrap(adminAPI))
	admin.POST("/coupons", s.wrap(adminAPI))
	return r
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func (s *Server) wrap(fn func(*request) any) gin.HandlerFunc {
	return func(g *gin.Context) {
		w, r := g.Writer, g.Request
		defer func() {
			if p := recover(); p != nil {
				switch e := p.(type) {
				case apiError:
					writeJSON(w, e.Status, Record{"error": e.Message})
				case sqlite3.Error:
					if e.Code == sqlite3.ErrConstraint {
						writeJSON(w, 400, Record{"error": "Invalid or duplicate data."})
					} else {
						log.Printf("database error: %v", e)
						writeJSON(w, 500, Record{"error": "Server unavailable."})
					}
				default:
					log.Printf("request error: %v", p)
					writeJSON(w, 500, Record{"error": "Server unavailable."})
				}
			}
		}()
		if r.Method != "GET" {
			origin := r.Header.Get("Origin")
			u, e := url.Parse(origin)
			if origin != "" && (e != nil || (u.Host != r.Host && origin != s.AllowedOrigin)) {
				fail(403, "Request origin does not match.")
			}
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				fail(403, "Request origin does not match.")
			}
		}
		data := Record{}
		if r.Method != "GET" {
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 100000))
			dec.UseNumber()
			e := dec.Decode(&data)
			if e != nil && !errors.Is(e, io.EOF) {
				fail(400, "Invalid JSON.")
			}
			if data == nil {
				fail(400, "Invalid request format.")
			}
			var extra any
			if e = dec.Decode(&extra); e != io.EOF {
				fail(400, "Invalid JSON.")
			}
		}
		tx, e := s.DB.BeginTx(r.Context(), nil)
		must(e)
		defer tx.Rollback()
		c := &request{s: s, tx: tx, g: g, r: r, w: w, data: data, status: 200}
		if cookie, e := r.Cookie("session"); e == nil {
			c.user = one(tx, "SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?", cookie.Value, time.Now().Unix())
		}
		result := fn(c)
		must(tx.Commit())
		writeJSON(w, c.status, result)
	}
}
func (c *request) auth(admin bool) {
	if c.user == nil {
		fail(401, "Please sign in.")
	}
	if admin && c.user["role"] != "admin" {
		fail(403, "Administrator access required.")
	}
}
func (c *request) text(k string, max int) string {
	s, ok := c.data[k].(string)
	s = strings.TrimSpace(s)
	if !ok || s == "" || len([]rune(s)) > max {
		fail(400, "Please enter a valid "+k)
	}
	return s
}
func integer(v any, min, max int64) int64 {
	n, ok := v.(json.Number)
	if !ok {
		fail(400, "Invalid numeric value.")
	}
	i, e := n.Int64()
	if e != nil || i < min || i > max {
		fail(400, "Invalid price, quantity or inventory.")
	}
	return i
}
func active(v any) int {
	if v == false || v == json.Number("0") || v == int64(0) {
		return 0
	}
	return 1
}
func cookie(w http.ResponseWriter, token string, age int) {
	http.SetCookie(w, &http.Cookie{Name: "session", Value: token, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: os.Getenv("COOKIE_SECURE") == "1", MaxAge: age})
}
