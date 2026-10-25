import catalog from '../data/catalog.json';
import type {Product, User, Quote, Order, Address, Coupon} from './types';

const key = (name:string) => `aurelis-frontend-${name}`;
const read = <T>(name:string, fallback:T):T => { try { return JSON.parse(localStorage.getItem(key(name)) || JSON.stringify(fallback)); } catch { return fallback; } };
const write = (name:string, value:unknown) => localStorage.setItem(key(name), JSON.stringify(value));
export async function api<T>(path:string, method='GET', data?:any):Promise<T>{
  const products = catalog as Product[];
  if(path==='/products') return products as T;
  if(path==='/me') return read<User|null>('user', null) as T;
  if(path==='/favorites'){const ids=read<number[]>('favorites',[]);if(method==='GET')return ids as T;const next=method==='POST'?[...new Set([...ids,Number(data.product_id)])]:ids.filter(id=>id!==Number(data.product_id));write('favorites',next);return {ok:true} as T;}
  if(path==='/addresses'){const list=read<Address[]>('addresses',[]);if(method==='GET')return list as T;if(method==='POST'){const value={...data,id:Date.now()};write('addresses',[...list,value]);return value as T}write('addresses',list.filter(a=>a.id!==Number(data.id)));return {ok:true} as T;}
  if(path==='/subscribe'){write('subscribers',[...read<string[]>('subscribers',[]),data.email]);return {ok:true} as T;}
  if(path==='/register'||path==='/login'){const user={id:1,name:data.name||'Customer',email:data.email,role:'customer'} as User;write('user',user);return user as T;}
  if(path==='/logout'){localStorage.removeItem(key('user'));return {ok:true} as T;}
  if(path==='/quote'){return quote(data.items,data.coupon) as T;}
  if(path==='/orders'&&method==='POST'){const q=quote(data.items,data.coupon);const order={...q,id:'AL'+Date.now(),address:data.address,status:'待付款',created:Math.floor(Date.now()/1000),tracking:'',payment:'whatsapp'} as Order;write('orders',[order,...read<Order[]>('orders',[])]);return order as T;}
  if(path==='/orders'&&method==='GET')return read<Order[]>('orders',[]) as T;
  if(path.startsWith('/orders/')&&path.endsWith('/pay')){const id=path.split('/')[2];const phone=read<string>('whatsapp','');if(!/^[1-9][0-9]{6,14}$/.test(phone.replace(/[+ ()-]/g,'')))throw new Error('请先在配置文件中填写 WhatsApp 号码。');return {url:`https://wa.me/${phone.replace(/[+ ()-]/g,'')}?text=${encodeURIComponent('Hello, I would like to arrange payment for AURELIS order '+id+'.')}`} as T;}
  if(path.startsWith('/orders/')&&method==='POST'){const id=path.split('/')[2],action=path.split('/')[3];const all=read<Order[]>('orders',[]);const next=all.map(o=>o.id===id?{...o,status:action==='cancel'?'已取消':action==='receive'?'已完成':action==='refund'?'退款申请中':o.status}:o);write('orders',next);return {ok:true} as T;}
  return [] as T;
}
function quote(items:any[], code=''):Quote{const lines=items.map(i=>{const p=products.find(p=>p.id===i.id)!;const v=p.variants.find(v=>v.id===i.variant_id);return {id:p.id,name:p.name,price:v?.price??p.price,image:p.image,qty:i.qty,variant_id:i.variant_id,variant_label:v?.label||''}});const subtotal=lines.reduce((n,i)=>n+i.price*i.qty,0);const discount=code.toUpperCase()==='WELCOME10'?Math.floor(subtotal*.1):0;const shipping=subtotal-discount>=29900?0:1500;return {currency:'USD',items:lines,subtotal,discount,shipping,total:subtotal-discount+shipping};}
export const money=(value:number,currency='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(value/100);
export const categories=['GLP Series','Single Peptides','Peptide Blends','Reagents'];
export const statusLabel=(status:string)=>({'待付款':'Awaiting payment','待发货':'Processing','已发货':'Shipped','已完成':'Completed','已取消':'Cancelled','退款申请中':'Refund requested','已退款':'Refunded'}[status]||status);
