"""Create a store administrator without storing a plaintext password."""
import argparse, getpass, re
import server

parser=argparse.ArgumentParser(description='森野商店账户管理')
parser.add_argument('command',choices=['create-admin'])
parser.add_argument('--email',required=True)
args=parser.parse_args()
email=args.email.strip().lower()
if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):parser.error('邮箱格式错误')
password=getpass.getpass('管理员密码（至少 10 位）：')
if len(password)<10:parser.error('密码至少需要 10 位')
if getpass.getpass('再次输入密码：')!=password:parser.error('两次密码不一致')
server.init_db()
with server.connect() as c:
    if c.execute('SELECT 1 FROM users WHERE email=?',(email,)).fetchone():parser.error('邮箱已存在，请使用新的管理员邮箱')
    c.execute("INSERT INTO users(name,email,password,role) VALUES (?,?,?,'admin')",('管理员',email,server.password_hash(password)))
print('管理员已创建。前往 http://localhost:3000/#admin 登录。')
