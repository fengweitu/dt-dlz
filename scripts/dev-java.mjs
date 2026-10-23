import {spawn} from 'node:child_process';
import path from 'node:path';
const root=process.cwd();
const backend=path.join(root,'java-backend');
const java=spawn('mvn',['spring-boot:run','-DAURELIS_ROOT='+root],{cwd:backend,stdio:'inherit'});
const vite=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','dev'],{cwd:path.join(root,'frontend'),env:{...process.env,API_PROXY_TARGET:'http://127.0.0.1:8081'},stdio:'inherit'});
let stopping=false;function stop(code=0){if(stopping)return;stopping=true;java.kill('SIGTERM');vite.kill('SIGTERM');process.exitCode=code}java.on('error',e=>{console.error('Java backend failed:',e.message);stop(1)});vite.on('error',e=>{console.error('Frontend failed:',e.message);stop(1)});process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
