import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.enc':'application/octet-stream','.svg':'image/svg+xml'};
createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');const path=resolve(root,`.${decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)}`);if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw Error();const bytes=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));
