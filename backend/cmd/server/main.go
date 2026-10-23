package main

import (
	"aurelis/backend/internal/shop"
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

func main() {
	rootFlag := flag.String("root", "..", "Repository root containing data, catalog.json and store-config.json")
	flag.Parse()
	root, err := filepath.Abs(*rootFlag)
	if err != nil {
		log.Fatal(err)
	}
	db, err := shop.OpenDB(root, os.Getenv("SHOP_DB"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	addr := os.Getenv("API_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	s := &shop.Server{DB: db, Root: root, AllowedOrigin: os.Getenv("FRONTEND_ORIGIN")}
	server := &http.Server{Addr: addr, Handler: s.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	go func() {
		log.Printf("AURELIS Go API listening on %s", addr)
		if e := server.ListenAndServe(); e != nil && e != http.ErrServerClosed {
			log.Fatal(e)
		}
	}()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	<-signals
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	server.Shutdown(ctx)
}
