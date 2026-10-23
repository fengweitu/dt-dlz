import unittest, tempfile, threading, json, http.client, os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import server
from unittest.mock import patch
from urllib.parse import urlparse, parse_qs

class ShopTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        server.DB=str(Path(cls.temp.name)/'test.db')
        server.init_db()
        with server.connect() as c:
            c.execute("INSERT INTO users(name,email,password,role) VALUES (?,?,?,'admin')",('Test Admin','admin@example.test',server.password_hash('test-admin-password')))
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        cls.port=cls.http.server_port
        threading.Thread(target=cls.http.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown();cls.http.server_close();cls.temp.cleanup()
    def setUp(self):
        self.cookie=''
        email='user-'+os.urandom(6).hex()+'@example.test'
        self.req('/register','POST',{'name':'测试顾客','email':email,'password':'test-password'})
    def req(self,path,method='GET',data=None,cookie=None,origin=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.port)
        headers={'Content-Type':'application/json','Cookie':self.cookie if cookie is None else cookie}
        if origin:headers['Origin']=origin
        conn.request(method,'/api'+path,json.dumps(data) if data is not None else None,headers)
        r=conn.getresponse();body=json.loads(r.read())
        if r.getheader('Set-Cookie'):self.cookie=r.getheader('Set-Cookie').split(';')[0]
        status=r.status;conn.close();return status,body
    def order(self,qty=1,pid=2001,**kw):
        return self.req('/orders','POST',{'items':[{'id':pid,'variant_id':pid*100+1,'qty':qty}],'address':{'name':'测试','phone':'13800000000','detail':'测试省测试市测试街道 1 号'},**kw})
    def test_catalog_migration_is_repeatable_and_preserves_legacy_currency(self):
        with server.connect() as c:
            count=c.execute('SELECT COUNT(*) FROM products').fetchone()[0]
            c.execute("INSERT INTO orders(id,user_id,items,address,subtotal,discount,shipping,total,status,created,currency) VALUES ('LEGACY',NULL,'[]','{}',12900,0,1500,14400,'已完成',0,'CNY')")
        server.init_db()
        with server.connect() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM products').fetchone()[0],count)
            legacy=c.execute("SELECT total,currency FROM orders WHERE id='LEGACY'").fetchone()
            self.assertEqual(tuple(legacy),(14400,'CNY'))
    def test_price_and_coupon_are_server_calculated(self):
        _,q=self.req('/quote','POST',{'items':[{'id':2001,'variant_id':200101,'qty':1,'price':1}],'coupon':'WELCOME10','total':1})
        self.assertEqual(q['currency'],'USD');self.assertEqual(q['subtotal'],8550);self.assertEqual(q['discount'],855);self.assertEqual(q['total'],9195)
        self.assertEqual(self.req('/quote','POST',{'items':[{'id':2001,'variant_id':200101,'qty':1}],'coupon':'INVALID'})[0],400)
    def test_invalid_cart_and_auth(self):
        for items in [[],[{'id':2001,'variant_id':200101,'qty':-1}],[{'id':2001,'variant_id':200101,'qty':1.5}],[{'id':2001,'variant_id':200101,'qty':True}],[{'id':2001,'variant_id':200101,'qty':1},{'id':2001,'variant_id':200101,'qty':1}],[{'id':999,'qty':1}]]:
            self.assertEqual(self.req('/quote','POST',{'items':items})[0],400)
        self.assertEqual(self.req('/orders',cookie='')[0],401)
        self.assertEqual(self.req('/admin/products')[0],403)
        self.assertEqual(self.req('/logout','POST',{},origin='https://evil.test')[0],403)
    def test_cancel_restores_stock_once_and_enforces_owner(self):
        _,p=self.req('/products');stock=p[0]['stock']
        status,o=self.order(2);self.assertEqual(status,201)
        self.assertEqual(self.req('/products')[1][0]['stock'],stock-2)
        owner=self.cookie
        self.req('/register','POST',{'name':'Other','email':os.urandom(8).hex()+'@example.test','password':'test-password'})
        self.assertEqual(self.req('/orders/'+o['id']+'/cancel','POST',{})[0],404)
        self.cookie=owner
        self.assertEqual(self.req('/orders/'+o['id']+'/cancel','POST',{})[0],200)
        self.assertEqual(self.req('/orders/'+o['id']+'/cancel','POST',{})[0],400)
        self.assertEqual(self.req('/products')[1][0]['stock'],stock)
    def test_order_payment_shipment_receipt(self):
        status,o=self.order();self.assertEqual(status,201)
        path='/orders/'+o['id']
        self.assertEqual(self.req(path+'/receive','POST',{})[0],400)
        self.assertEqual(self.req('/admin/confirm-payment','POST',{'id':o['id']})[0],403)
        customer=self.cookie
        self.req('/login','POST',{'email':'admin@example.test','password':'test-admin-password'})
        self.assertEqual(self.req('/admin/confirm-payment','POST',{'id':o['id']})[0],200)
        self.assertEqual(self.req('/admin/confirm-payment','POST',{'id':o['id']})[0],400)
        self.cookie=customer
        self.assertEqual(self.req(path+'/cancel','POST',{})[0],400)
        customer=self.cookie
        self.req('/login','POST',{'email':'admin@example.test','password':'test-admin-password'})
        self.assertEqual(self.req('/admin/orders','PATCH',{'id':o['id'],'tracking':'SF-TEST'})[0],200)
        self.cookie=customer
        self.assertEqual(self.req(path+'/receive','POST',{})[0],200)
        self.assertEqual(self.req('/orders')[1][0]['status'],'已完成')
        self.assertEqual(self.req('/orders')[1][0]['currency'],'USD')
    def test_refund_requires_admin_and_restores_stock_once(self):
        stock=self.req('/products')[1][0]['stock']
        _,o=self.order()
        path='/orders/'+o['id']
        customer=self.cookie
        self.req('/login','POST',{'email':'admin@example.test','password':'test-admin-password'})
        self.req('/admin/confirm-payment','POST',{'id':o['id']})
        self.cookie=customer
        self.assertEqual(self.req(path+'/refund','POST',{})[0],200)
        self.assertEqual(self.req('/admin/refund','POST',{'id':o['id']})[0],403)
        self.req('/login','POST',{'email':'admin@example.test','password':'test-admin-password'})
        self.assertEqual(self.req('/admin/refund','POST',{'id':o['id']})[0],200)
        self.assertEqual(self.req('/admin/refund','POST',{'id':o['id']})[0],400)
        self.assertEqual(self.req('/products')[1][0]['stock'],stock)
    def test_whatsapp_redirect_does_not_mark_paid(self):
        _,o=self.order()
        with patch.dict(os.environ,{'WHATSAPP_NUMBER':'+1 202 555 0123'}):
            status,r=self.req('/orders/'+o['id']+'/pay','POST',{})
            self.assertEqual(status,200)
            url=urlparse(r['url']);self.assertEqual(url.netloc,'wa.me');self.assertEqual(url.path,'/12025550123')
            message=parse_qs(url.query)['text'][0]
            self.assertIn(o['id'],message);self.assertIn('SLU-PP-332',message);self.assertIn('100.50',message)
            self.assertNotIn('13800000000',message)
            self.assertEqual(self.req('/orders')[1][0]['status'],'待付款')
            self.assertEqual(self.req('/orders/'+o['id']+'/pay','POST',{},cookie='')[0],401)
        with patch.dict(os.environ,{'WHATSAPP_NUMBER':'invalid'}):
            self.assertEqual(self.req('/orders/'+o['id']+'/pay','POST',{})[0],503)

    def test_welcome_coupon_is_first_order_only(self):
        self.assertEqual(self.order(coupon='WELCOME10')[0],201)
        self.assertEqual(self.order(coupon='WELCOME10')[0],400)
    def test_concurrent_purchase_cannot_oversell(self):
        with server.connect() as c:c.execute('UPDATE products SET stock=1 WHERE id=2030');c.execute('UPDATE product_variants SET stock=1 WHERE id=203001')
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda _:self.order(pid=2030),range(2)))
        self.assertEqual(sorted(s for s,_ in results),[201,400])
        self.assertEqual(self.req('/products')[1][-1]['stock'],0)
    def test_address_favorites_and_logout(self):
        status,a=self.req('/addresses','POST',{'name':'测试','phone':'13800000000','detail':'测试地址一号'})
        self.assertEqual(status,200);self.assertEqual(len(self.req('/addresses')[1]),1)
        self.assertEqual(self.req('/favorites','POST',{'product_id':2001})[0],200)
        self.assertIn(2001,self.req('/favorites')[1])
        self.req('/favorites','DELETE',{'product_id':2001});self.assertEqual(self.req('/favorites')[1],[])
        self.req('/addresses','DELETE',{'id':a['id']});self.assertEqual(self.req('/addresses')[1],[])
        cookie=self.cookie;self.req('/logout','POST',{})
        self.assertIsNone(self.req('/me',cookie=cookie)[1])
    def test_admin_product_and_coupon(self):
        self.req('/login','POST',{'email':'admin@example.test','password':'test-admin-password'})
        p=next(p for p in self.req('/admin/products')[1] if p['id']==2001)
        p.update(stock=25,active=0)
        self.assertEqual(self.req('/admin/products','PATCH',p)[0],200)
        self.assertNotIn(p['id'],[p['id'] for p in self.req('/products')[1]])
        p['active']=1;self.req('/admin/products','PATCH',p)
        self.assertEqual(self.req('/admin/coupons','POST',{'code':'TEST20','percent':20,'minimum':8000})[0],200)
        self.assertEqual(self.req('/quote','POST',{'items':[{'id':2001,'variant_id':200101,'qty':1}],'coupon':'TEST20'})[1]['discount'],1710)

    def test_catalog_prices_match_all_82_source_specifications(self):
        products=self.req('/products')[1]
        reference=json.loads((server.ROOT/'sources/yuantid-2026-10-23.json').read_text())['products']
        self.assertEqual(len(products),30)
        self.assertEqual(sum(len(p['variants']) for p in products),82)
        for expected in reference:
            actual=next(p for p in products if p['id']==expected['id'])
            self.assertEqual(actual['name'],expected['name'])
            self.assertEqual(actual['source_url'],expected['source_url'])
            self.assertEqual([(v['label'],v['price']) for v in actual['variants']],[(v['label'],v['price']) for v in expected['variants']])
    def test_variant_price_is_not_client_controlled(self):
        status,q=self.req('/quote','POST',{'items':[{'id':2001,'variant_id':200102,'qty':2,'price':1,'variant_label':'fake'}]})
        self.assertEqual(status,200)
        self.assertEqual(q['subtotal'],27000)
        self.assertEqual(q['items'][0]['price'],13500)
        self.assertEqual(q['items'][0]['variant_label'],'332 10mg*10vials')
        for variant in [None,200201,999999,True]:
            self.assertEqual(self.req('/quote','POST',{'items':[{'id':2001,'variant_id':variant,'qty':1}]})[0],400)
    def test_two_specifications_are_distinct_order_lines(self):
        variants=self.req('/products')[1][0]['variants'];before={v['id']:v['stock'] for v in variants}
        items=[{'id':2001,'variant_id':200101,'qty':1},{'id':2001,'variant_id':200102,'qty':2}]
        status,o=self.order(items=items);self.assertEqual(status,201)
        self.assertEqual(len(o['items']),2);self.assertEqual(o['subtotal'],35550)
        self.req('/orders/'+o['id']+'/cancel','POST',{})
        after={v['id']:v['stock'] for v in self.req('/products')[1][0]['variants']}
        self.assertEqual(before,after)
        self.assertEqual(self.order(items=[items[0],items[0]])[0],400)
    def test_admin_variant_edits_and_cross_product_protection(self):
        self.req('/login','POST',{'email':'admin@example.test','password':'test-admin-password'})
        original=next(p for p in self.req('/admin/products')[1] if p['id']==2001)
        edited=json.loads(json.dumps(original));edited['variants'][0]['price']=9000
        self.assertEqual(self.req('/admin/products','PATCH',edited)[0],200)
        self.assertEqual(self.req('/products')[1][0]['price'],9000)
        edited['variants'][0]['id']=200201;edited['name']='SHOULD ROLLBACK'
        self.assertEqual(self.req('/admin/products','PATCH',edited)[0],400)
        self.assertEqual(self.req('/products')[1][0]['name'],original['name'])
        self.req('/admin/products','PATCH',original)
    def test_zero_inventory_variant_does_not_borrow_other_variant_stock(self):
        with server.connect() as c:
            before=c.execute('SELECT stock FROM product_variants WHERE id=200102').fetchone()[0]
            c.execute('UPDATE product_variants SET stock=0 WHERE id=200102')
        try:
            self.assertEqual(self.req('/quote','POST',{'items':[{'id':2001,'variant_id':200102,'qty':1}]})[0],400)
            self.assertEqual(self.req('/quote','POST',{'items':[{'id':2001,'variant_id':200101,'qty':1}]})[0],200)
        finally:
            with server.connect() as c:c.execute('UPDATE product_variants SET stock=? WHERE id=200102',(before,))

if __name__=='__main__':unittest.main()
