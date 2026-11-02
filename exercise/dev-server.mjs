import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {makeExerciseHandler} from '../server/exercise-service.mjs';
import {makeRoomHandler} from '../server/command-room-service.mjs';
const db=new DatabaseSync(process.env.DREX_EXERCISE_DB||'/tmp/drex-objective-exercises.sqlite');
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, revision INTEGER, payload TEXT, expires_at TEXT)');
const store={health:async()=>true,insert:async r=>db.prepare('INSERT INTO rooms VALUES(?,?,?,?)').run(r.id,r.revision,JSON.stringify(r.payload),r.expires_at),get:async id=>{const r=db.prepare('SELECT * FROM rooms WHERE id=?').get(id);return r?{...r,payload:JSON.parse(r.payload)}:null;},update:async(id,revision,payload)=>db.prepare('UPDATE rooms SET payload=?,revision=revision+1 WHERE id=? AND revision=?').run(JSON.stringify(payload),id,revision).changes===1};
const exercise=makeExerciseHandler(store),legacy=makeRoomHandler(store),root=path.resolve(import.meta.dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const argPort=process.argv.indexOf('--port'),port=Number(argPort>=0?process.argv[argPort+1]:process.env.PORT||3000);
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://'+req.headers.host);
    if(['/api/exercise','/api/command-room'].includes(url.pathname)){
      const bufs=[];let size=0;for await(const b of req){size+=b.length;if(size>60000){res.writeHead(413);res.end();return;}bufs.push(b);}
      // The managed preview proxy terminates TLS. Forwarded origin is only used by this local development server.
      const forwarded=req.headers['x-forwarded-proto'];if(forwarded==='https')url.protocol='https:';
      const out=await(url.pathname==='/api/exercise'?exercise:legacy)(new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(bufs)}:{})}));res.writeHead(out.status,Object.fromEntries(out.headers));res.end(await out.text());return;
    }
    let rel=decodeURIComponent(url.pathname);if(rel==='/')rel='/exercise/index.html';if(rel.endsWith('/'))rel+='index.html';
    const file=path.resolve(root,'.'+rel);const allowed=['/exercise/index.html','/exercise/app.mjs','/exercise/catalog.mjs','/exercise/style.css'].includes(rel)||rel.startsWith('/command-sim/vendor/')||['/index.html'].includes(rel);
    if(!allowed||!file.startsWith(root+path.sep)||!mime[path.extname(file)]){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,process.env.DREX_BIND||'0.0.0.0',()=>console.log('DREX exercise server listening on '+port));
