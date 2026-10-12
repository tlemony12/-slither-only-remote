// Slither Online — authoritative game server (Node.js + ws). Serves index.html and the WebSocket on the same port.
const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000,W=2400,TAU=Math.PI*2,R=Math.random,MAXP=10,TICK=50,K=TICK/16.667,FOODS=800,MINSN=6;
const HUE=[0,215,130,300,25,200,170,50];
const NAMES=['Naga','Mint','Ploy','Beam','Tiger','Pro','Noob','Ninja','Zed','Luna','Kai','Fern','Boss','Toon','Ice','Nok'];
const rad=m=>8+Math.sqrt(m)*.55,nrm=a=>Math.atan2(Math.sin(a),Math.cos(a));
const page=fs.readFileSync(path.join(__dirname,'index.html'));
const server=http.createServer((q,s)=>{if(q.url==='/health'){s.end('ok');return}s.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});s.end(page)});
const wss=new WebSocketServer({server,maxPayload:1024});
const rooms=new Map();let nid=1,fid=1;
const send=(ws,o)=>{if(ws.readyState===1)ws.send(JSON.stringify(o))};

class Room{
  constructor(code,auto){this.code=code;this.auto=auto;this.clients=new Set();this.sn=new Map();this.foods=[];this.rem=[];this.add=[];this.idle=0;
    for(let i=0;i<FOODS;i++)this.spawn();this.add=[];this.timer=setInterval(()=>this.tick(),TICK)}
  spawn(){const a=R()*TAU,d=Math.sqrt(R())*(W-60),r=3+R()*3.5;this.addFood(Math.cos(a)*d,Math.sin(a)*d,R()*360|0,(r-2)*.45,r)}
  addFood(x,y,h,v,r){const f={id:fid++,x,y,h,v,r};this.foods.push(f);this.add.push([f.id,Math.round(x),Math.round(y),h,+v.toFixed(2),+r.toFixed(1)])}
  newSnake(name,bot,pal){const a=R()*TAU,d=R()*(W-600),ang=R()*TAU;
    const s={id:nid++,name,bot,pal,x:Math.cos(a)*d,y:Math.sin(a)*d,ang,ta:ang,mass:bot?10+R()*40:10,segs:[],boost:false,alive:true,inv:bot?0:40,bt:0,wa:R()*TAU,ft:0,tf:null,ws:null};
    for(let i=0;i<10;i++)s.segs.push({x:s.x-Math.cos(ang)*i*6,y:s.y-Math.sin(ang)*i*6});
    this.sn.set(s.id,s);return s}
  ai(s,list){
    const r=rad(s.mass);let want=s.wa;s.wa+=(R()-.5)*.15*K;s.boost=false;
    if(--s.ft<=0){s.ft=6+(R()*8|0);let best=null,bd=1e9;for(const f of this.foods){const dx=f.x-s.x,dy=f.y-s.y,d=dx*dx+dy*dy;if(d<420*420){const sc=d/(f.v+.3);if(sc<bd){bd=sc;best=f}}}s.tf=best}
    if(s.tf)want=Math.atan2(s.tf.y-s.y,s.tf.x-s.x);
    for(const o of list){if(o===s||!o.alive||o.mass>s.mass*.8)continue;const dx=o.x-s.x,dy=o.y-s.y,d=Math.hypot(dx,dy);
      if(d<450){want=Math.atan2(o.y+Math.sin(o.ang)*140-s.y,o.x+Math.cos(o.ang)*140-s.x);if(d<330&&s.mass>20)s.boost=true;break}}
    const L=r*5+45,px=s.x+Math.cos(s.ang)*L,py=s.y+Math.sin(s.ang)*L;let th=null,td=1e9;
    for(const o of list){if(o===s||!o.alive)continue;const ro=rad(o.mass),hx=o.x-px,hy=o.y-py,reach=o.segs.length*Math.max(5,ro*.6)+L+100;if(hx*hx+hy*hy>reach*reach)continue;
      const sg=o.segs,lim=(ro+r+25)**2;for(let i=0;i<sg.length;i+=2){const dx=sg[i].x-px,dy=sg[i].y-py,d=dx*dx+dy*dy;if(d<lim&&d<td){td=d;th=sg[i]}}}
    if(th){const diff=nrm(Math.atan2(th.y-s.y,th.x-s.x)-s.ang);want=s.ang-Math.sign(diff||1)*1.4;s.boost=false}
    if(Math.hypot(s.x,s.y)>W-380){want=Math.atan2(-s.y,-s.x);s.boost=false}
    s.ta=want}
  step(s){
    const r=rad(s.mass),diff=nrm(s.ta-s.ang),tr=.085*K/(1+r*.02);s.ang+=Math.max(-tr,Math.min(tr,diff));
    const can=s.boost&&s.mass>12;
    if(can){s.mass-=.1*K;s.bt+=K;if(s.bt>6){s.bt=0;const t=s.segs[s.segs.length-1];this.addFood(t.x+R()*6-3,t.y+R()*6-3,HUE[s.pal],.6,3.6)}}
    const sp=(can?4.6:2.7)*K;s.x+=Math.cos(s.ang)*sp;s.y+=Math.sin(s.ang)*sp;
    const sg=s.segs;sg[0].x=s.x;sg[0].y=s.y;const gap=Math.max(5,r*.6);
    for(let i=1;i<sg.length;i++){const p=sg[i-1],q=sg[i],dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);if(d>gap){const f=(d-gap)/d;q.x+=dx*f;q.y+=dy*f}}
    const want=Math.floor(10+s.mass*.55);
    while(sg.length<want){const t=sg[sg.length-1];sg.push({x:t.x,y:t.y})}
    while(sg.length>want&&sg.length>8)sg.pop();
    if(s.inv>0)s.inv--;
    const fl=this.foods,m=r+14;
    for(let i=fl.length-1;i>=0;i--){const f=fl[i],dx=s.x-f.x,dy=s.y-f.y;if(dx*dx+dy*dy<(m+f.r)**2){s.mass+=f.v;this.rem.push(f.id);fl[i]=fl[fl.length-1];fl.pop()}}}
  hit(s,list){
    const r=rad(s.mass);if(Math.hypot(s.x,s.y)>W-r*.3)return true;
    for(const o of list){if(o===s||!o.alive)continue;const ro=rad(o.mass),sg=o.segs,hx=o.x-s.x,hy=o.y-s.y,reach=sg.length*Math.max(5,ro*.6)+r+ro;if(hx*hx+hy*hy>reach*reach)continue;
      const lim=(r*.7+ro*.85)**2;for(let i=0;i<sg.length;i++){const dx=sg[i].x-s.x,dy=sg[i].y-s.y;if(dx*dx+dy*dy<lim)return true}}
    return false}
  kill(s,leaving){
    if(!s.alive)return;s.alive=false;this.sn.delete(s.id);const sg=s.segs,v=1+s.mass/sg.length*1.2;
    for(let i=0;i<sg.length;i+=2)this.addFood(sg[i].x+R()*10-5,sg[i].y+R()*10-5,HUE[s.pal],v,5+R()*3);
    if(this.foods.length>2400){for(const f of this.foods.splice(0,300))this.rem.push(f.id)}
    if(s.ws){s.ws.sn=null;if(!leaving)send(s.ws,{t:'dead',score:Math.floor(s.mass*8)})}}
  tick(){
    const list=[...this.sn.values()],hum=this.clients.size,bots=list.filter(s=>s.bot),want=hum>0?Math.max(0,MINSN-hum):0;
    if(bots.length<want)this.newSnake(NAMES[nid%NAMES.length],true,R()*8|0);
    else if(bots.length>want){bots[0].alive=false;this.sn.delete(bots[0].id)}
    for(const s of list){if(!s.alive)continue;if(s.bot)this.ai(s,list);this.step(s)}
    for(const s of list.filter(s=>s.alive&&s.inv<=0&&this.hit(s,list)))this.kill(s);
    while(this.foods.length<FOODS)this.spawn();
    if(hum){
      const sn=[];
      for(const s of this.sn.values()){const g=s.segs,n=Math.max(1,Math.ceil(g.length/40)),p=[];
        for(let i=0;i<g.length;i+=n)p.push(Math.round(g[i].x),Math.round(g[i].y));
        const l=g[g.length-1];p.push(Math.round(l.x),Math.round(l.y));
        sn.push([s.id,s.name,s.pal,Math.round(s.mass),+s.ang.toFixed(2),s.boost&&s.mass>12?1:0,p])}
      const msg=JSON.stringify({t:'s',h:hum,sn,e:this.rem,a:this.add});
      for(const c of this.clients)if(c.readyState===1)c.send(msg);
      this.idle=0}
    else if(++this.idle>200){clearInterval(this.timer);rooms.delete(this.code)}
    this.rem=[];this.add=[]}
}
function pickRoom(code){
  if(code){let r=rooms.get(code);if(!r){r=new Room(code,false);rooms.set(code,r)}return r.clients.size<MAXP?r:null}
  let best=null;for(const r of rooms.values())if(r.auto&&r.clients.size<MAXP&&(!best||r.clients.size>best.clients.size))best=r;
  if(!best){const c='p'+Math.random().toString(36).slice(2,6);best=new Room(c,true);rooms.set(c,best)}
  return best}
wss.on('connection',ws=>{
  ws.room=null;ws.sn=null;ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}
    if(m.t==='join'){
      if(ws.sn)return;
      const name=String(m.name||'Player').replace(/[\u0000-\u001f<>]/g,'').slice(0,14)||'Player',pal=((+m.pal)|0)&7;
      if(!ws.room){
        const code=String(m.room||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,12),room=pickRoom(code);
        if(!room){send(ws,{t:'full'});return}
        ws.room=room;room.clients.add(ws);
        send(ws,{t:'init',room:room.code,W,foods:room.foods.map(f=>[f.id,Math.round(f.x),Math.round(f.y),f.h,+f.v.toFixed(2),+f.r.toFixed(1)])})}
      const s=ws.room.newSnake(name,false,pal);s.ws=ws;ws.sn=s;send(ws,{t:'play',id:s.id})}
    else if(m.t==='in'&&ws.sn){const a=+m.a;if(Number.isFinite(a))ws.sn.ta=a;ws.sn.boost=!!m.b}});
  ws.on('close',()=>{if(ws.room){ws.room.clients.delete(ws);if(ws.sn)ws.room.kill(ws.sn,true)}});
  ws.on('error',()=>{})});
setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue}ws.isAlive=false;ws.ping()}},30000);
server.listen(PORT,()=>console.log('Slither Online running on port '+PORT));
