import os, json, sqlite3, secrets, hashlib, hmac, time, re
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from http.cookies import SimpleCookie
from urllib.parse import urlparse, quote
from pathlib import Path

ROOT = Path(__file__).parent
DB = os.environ.get('SHOP_DB', str(ROOT / 'data' / 'shop.db'))
PORT = int(os.environ.get('PORT', '3000'))

def whatsapp_payment_url(order):
    config=json.loads((ROOT/'store-config.json').read_text())
    phone=re.sub(r'[+ ()-]', '', os.environ.get('WHATSAPP_NUMBER') or config.get('whatsapp_number',''))
    if not re.fullmatch(r'[1-9][0-9]{6,14}',phone):
        raise APIError('WhatsApp payment contact is not configured yet. Please try again later.',503)
    items=json.loads(order['items']) if isinstance(order['items'],str) else order['items']
    lines=['Hello, I would like to arrange payment for AURELIS order '+order['id']+'.']
    lines += [f"{i['name']} — {i.get('variant_label','')} × {i['qty']}" for i in items]
    lines += [f"Total: {order['currency']} {order['total']/100:.2f}"]
    return 'https://wa.me/'+phone+'?text='+quote('\n'.join(lines),safe='')

def connect():
    c = sqlite3.connect(DB, timeout=15)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c

def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    return salt + ':' + hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 200000).hex()

def init_db():
    Path(DB).parent.mkdir(parents=True, exist_ok=True)
    with connect() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'customer');
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires INTEGER);
        CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, subtitle TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL, old_price INTEGER DEFAULT 0, stock INTEGER NOT NULL, image TEXT NOT NULL, tag TEXT DEFAULT '', description TEXT NOT NULL, active INTEGER DEFAULT 1);
        CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), items TEXT NOT NULL, address TEXT NOT NULL, subtotal INTEGER, discount INTEGER, shipping INTEGER, total INTEGER, status TEXT, created INTEGER, tracking TEXT DEFAULT '', payment TEXT DEFAULT 'demo');
        CREATE TABLE IF NOT EXISTS addresses(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), name TEXT, phone TEXT, detail TEXT);
        CREATE TABLE IF NOT EXISTS coupons(code TEXT PRIMARY KEY, percent INTEGER NOT NULL, minimum INTEGER NOT NULL, active INTEGER DEFAULT 1);
        CREATE TABLE IF NOT EXISTS subscribers(email TEXT PRIMARY KEY, created INTEGER);
        CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), product_id INTEGER REFERENCES products(id), rating INTEGER, body TEXT, created INTEGER, UNIQUE(user_id,product_id));
        CREATE TABLE IF NOT EXISTS product_variants(id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), label TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>0), stock INTEGER NOT NULL CHECK(stock>=0), active INTEGER DEFAULT 1, source_variant_id TEXT DEFAULT '');
        CREATE TABLE IF NOT EXISTS favorites(user_id INTEGER REFERENCES users(id), product_id INTEGER REFERENCES products(id), PRIMARY KEY(user_id,product_id));
        ''')
        c.execute("INSERT OR IGNORE INTO coupons VALUES ('WELCOME10',10,0,1)")
        c.execute('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)')
        if 'currency' not in [r['name'] for r in c.execute('PRAGMA table_info(orders)')]:
            c.execute("ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'CNY'")
        if not c.execute("SELECT 1 FROM migrations WHERE name='aurelis-concept-v1'").fetchone():
            # Archive only the original demo catalog. Preserve custom products and order snapshots.
            old_names = ('弧光 · 陶瓷花器','云朵 · 羊毛休闲椅','晨间 · 手作咖啡杯','留白 · 亚麻靠垫','暮色 · 香氛蜡烛','原木 · 边几','拾光 · 玻璃水壶','山野 · 棉织盖毯')
            c.executemany('UPDATE products SET active=0 WHERE name=?', [(name,) for name in old_names])
            for product in json.loads((ROOT / 'sources/aurelis-concept-v1.json').read_text()):
                columns = list(product)
                c.execute('INSERT INTO products('+','.join(columns)+') VALUES ('+','.join('?' for _ in columns)+')', list(product.values()))
            c.execute("INSERT INTO migrations VALUES ('aurelis-concept-v1')")
        for column in ('source_url', 'source_checked_on'):
            if column not in [r['name'] for r in c.execute('PRAGMA table_info(products)')]:
                c.execute(f"ALTER TABLE products ADD COLUMN {column} TEXT DEFAULT ''")
        if not c.execute("SELECT 1 FROM migrations WHERE name='yuantid-catalog-2026-10-23'").fetchone():
            for old in json.loads((ROOT / 'sources/aurelis-concept-v1.json').read_text()):
                c.execute('UPDATE products SET active=0 WHERE id=? AND name=?',(old['id'],old['name']))
            for entry in json.loads((ROOT / 'catalog.json').read_text()):
                product={k:v for k,v in entry.items() if k not in ('variants','gallery')}
                columns=list(product)
                c.execute('INSERT INTO products('+','.join(columns)+') VALUES ('+','.join('?' for _ in columns)+')',list(product.values()))
                for variant in entry['variants']:
                    c.execute('INSERT INTO product_variants(id,product_id,label,price,stock,active,source_variant_id) VALUES (?,?,?,?,?,?,?)',(variant['id'],product['id'],variant['label'],variant['price'],variant['stock'],variant['active'],variant['source_variant_id']))
            c.execute("INSERT INTO migrations VALUES ('yuantid-catalog-2026-10-23')")
        if 'gallery' not in [r['name'] for r in c.execute('PRAGMA table_info(products)')]:
            c.execute("ALTER TABLE products ADD COLUMN gallery TEXT NOT NULL DEFAULT '[]'")
        if not c.execute("SELECT 1 FROM migrations WHERE name='yuantid-images-2026-10-23'").fetchone():
            for product in json.loads((ROOT / 'catalog.json').read_text()):
                c.execute('UPDATE products SET image=?,gallery=? WHERE id=? AND source_url=?',
                          (product['image'],json.dumps(product.get('gallery',[])),product['id'],product['source_url']))
            c.execute("INSERT INTO migrations VALUES ('yuantid-images-2026-10-23')")
        admin_email = os.environ.get('ADMIN_EMAIL')
        admin_password = os.environ.get('ADMIN_PASSWORD')
        if admin_email and admin_password:
            if len(admin_password) < 10: raise ValueError('ADMIN_PASSWORD 至少需要 10 个字符')
            c.execute("INSERT OR IGNORE INTO users(name,email,password,role) VALUES (?,?,?,'admin')", ('管理员',admin_email.lower(),password_hash(admin_password)))

def product_json(c, row, admin=False):
    product=dict(row)
    product['gallery']=list(dict.fromkeys([product['image']]+json.loads(product.get('gallery') or '[]')))
    variants=[dict(v) for v in c.execute('SELECT * FROM product_variants WHERE product_id=? ORDER BY id',(product['id'],))]
    product['variants']=variants if admin else [v for v in variants if v['active']]
    enabled=[v for v in variants if v['active']]
    if enabled:
        product['price']=min(v['price'] for v in enabled)
        product['max_price']=max(v['price'] for v in enabled)
        product['stock']=sum(v['stock'] for v in enabled)
    elif variants:
        product['stock']=0
    product.setdefault('max_price',product['price'])
    return product

def change_inventory(c, item, direction):
    c.execute('UPDATE products SET stock=stock+? WHERE id=?',(direction*item['qty'],item['id']))
    if item.get('variant_id'):
        c.execute('UPDATE product_variants SET stock=stock+? WHERE id=? AND product_id=?',(direction*item['qty'],item['variant_id'],item['id']))

class APIError(Exception):
    def __init__(self, message, status=400): self.message, self.status = message, status

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT/'public'),**kwargs)
    def log_message(self, fmt, *args): pass
    def json_response(self, data, status=200, cookie=None):
        raw = json.dumps(data,ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(raw)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        if cookie: self.send_header('Set-Cookie',cookie)
        self.end_headers()
        self.wfile.write(raw)
    def do_GET(self):
        if self.path.startswith('/api/'): self.api('GET')
        else:
            if urlparse(self.path).path in ('/', '/shop', '/account', '/admin'): self.path='/index.html'
            super().do_GET()
    def do_POST(self): self.api('POST')
    def do_PATCH(self): self.api('PATCH')
    def do_DELETE(self): self.api('DELETE')
    def api(self,method):
        try:
            origin = self.headers.get('Origin')
            if method != 'GET' and origin and urlparse(origin).netloc != self.headers.get('Host'):
                raise APIError('Request origin does not match.',403)
            if method != 'GET' and self.headers.get('Sec-Fetch-Site') == 'cross-site': raise APIError('Request origin does not match.',403)
            length = int(self.headers.get('Content-Length',0))
            if length > 100000: raise APIError('Request too large.',413)
            try: data = json.loads(self.rfile.read(length)) if length else {}
            except (ValueError,UnicodeError): raise APIError('Invalid JSON.')
            if not isinstance(data,dict): raise APIError('Invalid request format.')
            with connect() as c:
                cookie=SimpleCookie(self.headers.get('Cookie',''))
                token=cookie.get('session')
                user=c.execute('SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',(token.value if token else '',int(time.time()))).fetchone()
                path=urlparse(self.path).path
                def auth(admin=False):
                    if not user: raise APIError('Please sign in.',401)
                    if admin and user['role']!='admin': raise APIError('Administrator access required.',403)
                def txt(key,maximum=200):
                    value=data.get(key,'')
                    if not isinstance(value,str) or not value.strip() or len(value)>maximum: raise APIError('Please enter a valid '+key)
                    return value.strip()
                if path=='/api/products' and method=='GET':
                    return self.json_response([product_json(c,p) for p in c.execute('SELECT * FROM products WHERE active=1')])
                if path=='/api/me' and method=='GET': return self.json_response(dict(user) if user else None)
                if path in ('/api/register','/api/login') and method=='POST':
                    email=txt('email').lower(); password=txt('password',128)
                    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$',email): raise APIError('Please enter a valid email address.')
                    if path.endswith('register'):
                        if len(password)<8: raise APIError('Password must contain at least 8 characters.')
                        try: c.execute('INSERT INTO users(name,email,password) VALUES (?,?,?)',(txt('name',40),email,password_hash(password)))
                        except sqlite3.IntegrityError: raise APIError('This email is already registered.')
                    found=c.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
                    if not found or not hmac.compare_digest(found['password'],password_hash(password,found['password'].split(':')[0])): raise APIError('Incorrect email or password.',401)
                    session=secrets.token_urlsafe(32)
                    c.execute('DELETE FROM sessions WHERE expires<?',(int(time.time()),))
                    c.execute('INSERT INTO sessions VALUES (?,?,?)',(session,found['id'],int(time.time())+604800))
                    return self.json_response({k:found[k] for k in ('id','name','email','role')},cookie=f'session={session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800'+ ('; Secure' if os.environ.get('COOKIE_SECURE')=='1' else ''))
                if path=='/api/logout' and method=='POST':
                    if token: c.execute('DELETE FROM sessions WHERE token=?',(token.value,))
                    return self.json_response({'ok':True},cookie='session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
                if path=='/api/subscribe' and method=='POST':
                    email=txt('email').lower()
                    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$',email): raise APIError('Please enter a valid email address.')
                    c.execute('INSERT OR IGNORE INTO subscribers VALUES (?,?)',(email,int(time.time())))
                    return self.json_response({'ok':True})
                if path=='/api/favorites':
                    auth()
                    if method=='GET': return self.json_response([r[0] for r in c.execute('SELECT product_id FROM favorites WHERE user_id=?',(user['id'],))])
                    pid=data.get('product_id')
                    if not c.execute('SELECT 1 FROM products WHERE id=? AND active=1',(pid,)).fetchone(): raise APIError('Product not found.',404)
                    if method=='POST': c.execute('INSERT OR IGNORE INTO favorites VALUES (?,?)',(user['id'],pid))
                    elif method=='DELETE': c.execute('DELETE FROM favorites WHERE user_id=? AND product_id=?',(user['id'],pid))
                    return self.json_response({'ok':True})
                if path=='/api/addresses':
                    auth()
                    if method=='GET': return self.json_response([dict(r) for r in c.execute('SELECT id,name,phone,detail FROM addresses WHERE user_id=?',(user['id'],))])
                    if method=='POST':
                        cur=c.execute('INSERT INTO addresses(user_id,name,phone,detail) VALUES (?,?,?,?)',(user['id'],txt('name',50),txt('phone',30),txt('detail',300)))
                        return self.json_response({'id':cur.lastrowid})
                    if method=='DELETE':
                        c.execute('DELETE FROM addresses WHERE id=? AND user_id=?',(data.get('id'),user['id']))
                        return self.json_response({'ok':True})
                if path=='/api/quote' and method=='POST' or path=='/api/orders' and method=='POST':
                    placing=path=='/api/orders'
                    if placing: auth()
                    c.execute('BEGIN IMMEDIATE')
                    raw_items=data.get('items',[])
                    if not isinstance(raw_items,list) or not raw_items or len(raw_items)>50: raise APIError('Your bag is empty or contains too many products.')
                    items=[]; seen=set()
                    for item in raw_items:
                        if not isinstance(item,dict): raise APIError('Invalid product format.')
                        pid=item.get('id'); qty=item.get('qty'); vid=item.get('variant_id')
                        if type(pid)!=int or type(qty)!=int or qty<1 or qty>99 or (vid is not None and type(vid)!=int): raise APIError('Invalid product quantity or specification.')
                        key=(pid,vid)
                        if key in seen: raise APIError('Duplicate product specification.')
                        seen.add(key)
                        p=c.execute('SELECT * FROM products WHERE id=? AND active=1',(pid,)).fetchone()
                        if not p: raise APIError('A product is no longer available. Please update your bag.')
                        variant=None
                        if c.execute('SELECT 1 FROM product_variants WHERE product_id=?',(pid,)).fetchone():
                            variant=c.execute('SELECT * FROM product_variants WHERE id=? AND product_id=? AND active=1',(vid,pid)).fetchone()
                            if not variant: raise APIError('Please select a valid specification for '+p['name']+'.')
                        elif vid is not None: raise APIError('This product has no specifications.')
                        stock=variant['stock'] if variant else p['stock']
                        if qty>stock: raise APIError(p['name']+' has insufficient stock for this specification.')
                        items.append({'id':pid,'name':p['name'],'price':variant['price'] if variant else p['price'],'image':p['image'],'qty':qty,'variant_id':variant['id'] if variant else None,'variant_label':variant['label'] if variant else ''})
                    subtotal=sum(i['price']*i['qty'] for i in items)
                    code=data.get('coupon','')
                    if not isinstance(code,str): raise APIError('Invalid promo code.')
                    coupon=c.execute('SELECT * FROM coupons WHERE code=? AND active=1',(code.upper().strip(),)).fetchone() if code else None
                    if code and not coupon: raise APIError('This promo code is invalid or inactive.')
                    if coupon and coupon['code']=='WELCOME10' and user and c.execute("SELECT 1 FROM orders WHERE user_id=? AND status!='已取消' LIMIT 1",(user['id'],)).fetchone(): raise APIError('This welcome offer is only valid on your first order.')
                    if coupon and subtotal<coupon['minimum']: raise APIError('The minimum spend for this offer has not been met.')
                    discount=subtotal*coupon['percent']//100 if coupon else 0
                    shipping=0 if subtotal>=29900 else 1500
                    quote={'currency':'USD','items':items,'subtotal':subtotal,'discount':discount,'shipping':shipping,'total':subtotal-discount+shipping}
                    if not placing: return self.json_response(quote)
                    address=data.get('address')
                    if not isinstance(address,dict) or any(not isinstance(address.get(k),str) or not address[k].strip() or len(address[k])>300 for k in ('name','phone','detail')): raise APIError('Please complete your delivery address.')
                    oid='AL'+time.strftime('%Y%m%d')+secrets.token_hex(4).upper()
                    for i in items: change_inventory(c,i,-1)
                    c.execute('INSERT INTO orders(id,user_id,items,address,subtotal,discount,shipping,total,status,created,currency) VALUES (?,?,?,?,?,?,?,?,?,?,?)',(oid,user['id'],json.dumps(items,ensure_ascii=False),json.dumps(address,ensure_ascii=False),subtotal,discount,shipping,quote['total'],'待付款',int(time.time()),'USD'))
                    c.execute("UPDATE orders SET payment='whatsapp' WHERE id=?",(oid,))
                    return self.json_response({'id':oid,**quote},201)
                if path=='/api/orders' and method=='GET':
                    auth()
                    result=[]
                    for r in c.execute('SELECT * FROM orders WHERE user_id=? ORDER BY created DESC',(user['id'],)):
                        d=dict(r); d['items']=json.loads(d['items']); d['address']=json.loads(d['address']); result.append(d)
                    return self.json_response(result)
                if re.fullmatch('/api/orders/[^/]+/(pay|cancel|receive|refund)',path) and method=='POST':
                    auth(); c.execute('BEGIN IMMEDIATE')
                    oid,action=path.split('/')[3:]
                    order=c.execute('SELECT * FROM orders WHERE id=? AND user_id=?',(oid,user['id'])).fetchone()
                    if not order: raise APIError('Order not found.',404)
                    status=order['status']
                    if action=='pay':
                        if status!='待付款': raise APIError('This order cannot be paid in its current state.')
                        return self.json_response({'url':whatsapp_payment_url(dict(order)),'status':status})
                    elif action=='cancel':
                        if status!='待付款': raise APIError('Only unpaid orders can be cancelled. For paid orders, request a refund.')
                        status='已取消'
                        for i in json.loads(order['items']): change_inventory(c,i,1)
                    elif action=='refund':
                        if status not in ('待发货','已发货','已完成'): raise APIError('This order is not eligible for a refund request.')
                        status='退款申请中'
                    elif action=='receive':
                        if status!='已发货': raise APIError('This order has not been shipped.')
                        status='已完成'
                    c.execute('UPDATE orders SET status=? WHERE id=?',(status,oid))
                    return self.json_response({'ok':True,'status':status,'message':'Order updated.'})
                if path.startswith('/api/admin/'):
                    auth(True)
                    if path=='/api/admin/confirm-payment' and method=='POST':
                        oid=txt('id',100)
                        changed=c.execute("UPDATE orders SET status='待发货',payment='whatsapp' WHERE id=? AND status='待付款'",(oid,)).rowcount
                        if not changed: raise APIError('Only an unpaid order can be confirmed.')
                        return self.json_response({'ok':True})
                    if path=='/api/admin/overview' and method=='GET':
                        return self.json_response({'users':c.execute('SELECT COUNT(*) FROM users').fetchone()[0], 'orders':c.execute('SELECT COUNT(*) FROM orders').fetchone()[0], 'revenue':c.execute("SELECT COALESCE(SUM(total),0) FROM orders WHERE currency='USD' AND status IN ('待发货','已发货','已完成')").fetchone()[0], 'subscribers':c.execute('SELECT COUNT(*) FROM subscribers').fetchone()[0]})
                    if path=='/api/admin/products':
                        if method=='GET': return self.json_response([product_json(c,r,True) for r in c.execute('SELECT * FROM products')])
                        if method in ('POST','PATCH'):
                            fields={k:txt(k,2000 if k=='description' else 500) for k in ('name','subtitle','category','image','description')}
                            if not (fields['image'].startswith('https://') or re.fullmatch(r'/images/[a-zA-Z0-9_.-]+', fields['image'])): raise APIError('Use an HTTPS image URL or a local /images/ path.')
                            for k in ('price','old_price','stock'):
                                n=data.get(k,0)
                                if type(n)!=int or n<0 or n>100000000: raise APIError('Invalid price or stock.')
                                fields[k]=n
                            if fields['price']<=0: raise APIError('Price must be greater than zero.')
                            fields['tag']=str(data.get('tag',''))[:40]; fields['active']=1 if data.get('active',True) else 0
                            if method=='POST': c.execute('INSERT INTO products('+','.join(fields)+') VALUES ('+','.join('?' for _ in fields)+')',list(fields.values()))
                            else:
                                cur=c.execute('UPDATE products SET '+','.join(k+'=?' for k in fields)+' WHERE id=?',list(fields.values())+[data.get('id')])
                                if not cur.rowcount: raise APIError('Product not found.',404)
                            if method=='PATCH':
                                existing=[dict(v) for v in c.execute('SELECT * FROM product_variants WHERE product_id=?',(data.get('id'),))]
                                if existing:
                                    supplied=data.get('variants',existing)
                                    if not isinstance(supplied,list) or len(supplied)!=len(existing): raise APIError('All existing specifications must be provided.')
                                    ids={v['id'] for v in existing}
                                    seen_variants=set()
                                    for v in supplied:
                                        if not isinstance(v,dict) or type(v.get('id'))!=int or v['id'] not in ids or v['id'] in seen_variants: raise APIError('Invalid specification reference.')
                                        seen_variants.add(v['id'])
                                        if not isinstance(v.get('label'),str) or not v['label'].strip() or len(v['label'])>150: raise APIError('Invalid specification label.')
                                        if type(v.get('price'))!=int or not 0<v['price']<=100000000 or type(v.get('stock'))!=int or not 0<=v['stock']<=1000000: raise APIError('Invalid specification price or inventory.')
                                        c.execute('UPDATE product_variants SET label=?,price=?,stock=?,active=? WHERE id=? AND product_id=?',(v['label'].strip(),v['price'],v['stock'],1 if v.get('active',True) else 0,v['id'],data['id']))
                                    enabled=[v for v in supplied if v.get('active',True)]
                                    c.execute('UPDATE products SET price=?,stock=? WHERE id=?',(min(v['price'] for v in enabled) if enabled else fields['price'],sum(v['stock'] for v in enabled),data['id']))
                            return self.json_response({'ok':True})
                    if path=='/api/admin/orders':
                        if method=='GET':
                            result=[]
                            for r in c.execute('SELECT o.*,u.email FROM orders o JOIN users u ON o.user_id=u.id ORDER BY created DESC'):
                                d=dict(r); d['items']=json.loads(d['items']); d['address']=json.loads(d['address']); result.append(d)
                            return self.json_response(result)
                        if method=='PATCH':
                            tracking=txt('tracking',100)
                            cur=c.execute("UPDATE orders SET status='已发货',tracking=? WHERE id=? AND status='待发货'",(tracking,data.get('id')))
                            if not cur.rowcount: raise APIError('Only processing orders can be shipped.')
                            return self.json_response({'ok':True})
                    if path=='/api/admin/refund' and method=='POST':
                        c.execute('BEGIN IMMEDIATE')
                        order=c.execute("SELECT * FROM orders WHERE id=? AND status='退款申请中'",(data.get('id'),)).fetchone()
                        if not order: raise APIError('No pending refund request found.')
                        c.execute("UPDATE orders SET status='已退款' WHERE id=?",(order['id'],))
                        for i in json.loads(order['items']): change_inventory(c,i,1)
                        return self.json_response({'ok':True,'message':'Demo refund completed. Stock restored; no real funds were transferred.'})
                    if path=='/api/admin/coupons':
                        if method=='GET': return self.json_response([dict(r) for r in c.execute('SELECT * FROM coupons')])
                        if method=='POST':
                            code=txt('code',30).upper(); percent=data.get('percent'); minimum=data.get('minimum',0)
                            if type(percent)!=int or percent<1 or percent>90 or type(minimum)!=int or minimum<0: raise APIError('Discount must be 1–90%; minimum spend cannot be negative.')
                            c.execute('INSERT INTO coupons VALUES (?,?,?,?) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,minimum=excluded.minimum,active=excluded.active',(code,percent,minimum,1 if data.get('active',True) else 0))
                            return self.json_response({'ok':True})
                raise APIError('Endpoint not found.',404)
        except APIError as e: self.json_response({'error':e.message},e.status)
        except (ValueError,TypeError,sqlite3.IntegrityError): self.json_response({'error':'Invalid data. Please review your entries.'},400)
        except Exception as e:
            print('API error:',type(e).__name__,str(e))
            self.json_response({'error':'Server unavailable. Please try again.'},500)

if __name__=='__main__':
    init_db()
    print(f'AURELIS is running at http://localhost:{PORT}',flush=True)
    ThreadingHTTPServer(('127.0.0.1',PORT),Handler).serve_forever()
