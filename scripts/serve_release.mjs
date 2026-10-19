// Local-only QA harness for built assets; not needed by the desktop application.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { spawn } from "node:child_process";
const root=resolve("dist"),port=1421;
http.createServer(async(req,res)=>{
  res.setHeader("Content-Security-Policy","default-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'");
  if(req.url?.startsWith("/api/")) {
    if(req.method!=="POST"||(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${port}`)){res.writeHead(403).end();return;}
    let body="";for await(const chunk of req){body+=chunk;if(body.length>4_000_000){res.writeHead(413).end();return;}}
    const streaming=req.url==="/api/compute-progress",child=spawn(resolve("target/release/oos-cli.exe"),[req.url==="/api/examples"?"examples":streaming?"--request-progress":"--request"]);
    let out="",err="";res.setHeader("Content-Type",streaming?"application/x-ndjson":"application/json");
    child.stdout.on("data",d=>streaming?res.write(d):out+=d);child.stderr.on("data",d=>err+=d);
    child.on("error",e=>res.writeHead(503).end(JSON.stringify({error:e.message})));
    child.on("close",code=>{if(res.writableEnded)return;res.statusCode=code?422:200;if(streaming){if(code)res.write(JSON.stringify({error:err})+"\n");res.end();}else res.end(code?err:out);});
    res.on("close",()=>child.kill());child.stdin.on("error",()=>{});child.stdin.end(body);return;
  }
  const name=new URL(req.url,"http://127.0.0.1").pathname;
  const path=resolve(root,"."+(name==="/"?"/index.html":decodeURIComponent(name)));
  if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{const bytes=await readFile(path);res.setHeader("Content-Type",({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".ttf":"font/ttf"})[extname(path)]??"application/octet-stream");res.end(bytes);}catch{res.writeHead(404).end();}
}).listen(port,"127.0.0.1",()=>console.log(`Built OOS QA: http://127.0.0.1:${port}`));
