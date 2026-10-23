
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'customer');
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires INTEGER);
        CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, subtitle TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL, old_price INTEGER DEFAULT 0, stock INTEGER NOT NULL, image TEXT NOT NULL, tag TEXT DEFAULT '', description TEXT NOT NULL, active INTEGER DEFAULT 1, source_url TEXT DEFAULT '', source_checked_on TEXT DEFAULT '', gallery TEXT NOT NULL DEFAULT '[]');
        CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), items TEXT NOT NULL, address TEXT NOT NULL, subtotal INTEGER, discount INTEGER, shipping INTEGER, total INTEGER, status TEXT, created INTEGER, tracking TEXT DEFAULT '', payment TEXT DEFAULT 'whatsapp',currency TEXT NOT NULL DEFAULT 'USD');
        CREATE TABLE IF NOT EXISTS addresses(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), name TEXT, phone TEXT, detail TEXT);
        CREATE TABLE IF NOT EXISTS coupons(code TEXT PRIMARY KEY, percent INTEGER NOT NULL, minimum INTEGER NOT NULL, active INTEGER DEFAULT 1);
        CREATE TABLE IF NOT EXISTS subscribers(email TEXT PRIMARY KEY, created INTEGER);
        CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), product_id INTEGER REFERENCES products(id), rating INTEGER, body TEXT, created INTEGER, UNIQUE(user_id,product_id));
        CREATE TABLE IF NOT EXISTS product_variants(id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), label TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>0), stock INTEGER NOT NULL CHECK(stock>=0), active INTEGER DEFAULT 1, source_variant_id TEXT DEFAULT '');
        CREATE TABLE IF NOT EXISTS favorites(user_id INTEGER REFERENCES users(id), product_id INTEGER REFERENCES products(id), PRIMARY KEY(user_id,product_id));
        
CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY);
