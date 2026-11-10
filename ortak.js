// Shared by every page: daily seed, challenge link, storage, sound, toast, share, end screen, canvas helpers.
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){let a=7;for(const ch of seed)a=Math.imul(a^ch.charCodeAt(0),2654435761);
  return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const store={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};

// challenge link ?g=YYYY-MM-DD&h=score — untrusted input, validated here
const Q=new URLSearchParams(location.search);
const TODAY=new Date().toLocaleDateString('sv');
const DAY=/^\d{4}-\d{2}-\d{2}$/.test(Q.get('g')||'')?Q.get('g'):TODAY;
const TARGET=(h=>h>0&&h<1e7?h:0)(parseInt(Q.get('h'),10)||0);
const DAY_LABEL=new Date(DAY+'T12:00').toLocaleDateString('tr',{day:'numeric',month:'long'});
const bestOf=key=>+store.get(key+'-best-'+DAY)||0;

let ac,muted=store.get('mute')==='1';
function sweep(f0,f1,d=.2,type='sine',v=.12){if(muted)return;try{ac??=new AudioContext();const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime;
  o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+d);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g).connect(ac.destination);o.start();o.stop(t+d)}catch{}}
const beep=(f,d=.08,type='sine',v=.12)=>sweep(f,f,d,type,v);
// a short filtered noise burst: sounds like a balloon pop / crack (freq sets how bright it is)
let noiseBuf;
function popSfx(v=.3,freq=1800,d=.08){if(muted)return;try{ac??=new AudioContext();
  if(!noiseBuf){noiseBuf=ac.createBuffer(1,ac.sampleRate*.5|0,ac.sampleRate);const a=noiseBuf.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1}
  const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain(),t=ac.currentTime;s.buffer=noiseBuf;f.type='bandpass';f.frequency.value=freq;f.Q.value=.7;
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(f).connect(g).connect(ac.destination);s.start(t,Math.random()*.3,d)}catch{}}
// browsers only allow audio to start inside a user gesture: unlock it on the first touch
addEventListener('pointerdown',()=>{if(muted)return;try{ac??=new AudioContext();if(ac.state==='suspended')ac.resume()}catch{}},{capture:true});
const buzz=ms=>{try{navigator.vibrate?.(ms)}catch{}};
let toastT;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),1500)}
function shake(el=$('.stage')){el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake')}

async function share(text){
  try{if(navigator.share){await navigator.share({text});return}}catch(e){if(e.name==='AbortError')return}
  try{await navigator.clipboard.writeText(text);toast('📋 Kopyalandı, arkadaşına yapıştır');return}catch{}
  open('https://wa.me/?text='+encodeURIComponent(text),'_blank')}

if($('#app'))document.body.classList.add('game'); // game pages, also when served inside a host page skeleton
if(document.body.classList.contains('game')){
  $('#app').insertAdjacentHTML('afterbegin',`<div class="top"><a href="./" aria-label="Tüm oyunlar">‹</a><span class="t"><b>${document.title}</b> · ${DAY_LABEL}${DAY===TODAY?' · Günlük':''}</span><button id="mute" aria-label="Sesi aç/kapat"></button></div>`);
  document.body.insertAdjacentHTML('beforeend',`<div id="toast"></div><div id="over" class="ov" hidden><div class="card"><p id="oTitle"></p><b id="oScore"></b><span id="oUnit"></span><div class="chips" id="oChips"></div><p id="oMsg"></p><button id="share" class="btn pri">Meydan oku 📤</button><button id="again" class="btn">Tekrar oyna ↻</button><a class="lnk" href="./">‹ Diğer oyunlar</a></div></div>`);
  const m=$('#mute'),set=()=>m.textContent=muted?'🔇':'🔊';set();m.onclick=()=>{muted=!muted;store.set('mute',muted?'1':'0');set()};
}

// end screen: saves the day's best, compares with the friend's target, wires share/again
function finish({key,score,title,chips,fmt=String,unit='puan',card='',again}){
  const show=x=>fmt(x)+(unit?' '+unit:''),prev=bestOf(key);if(score>prev)store.set(key+'-best-'+DAY,score);
  $('#oTitle').textContent=title;$('#oScore').textContent=fmt(score);$('#oUnit').textContent=unit;
  $('#oChips').innerHTML=chips.map(c=>`<span>${c}</span>`).join('');
  const vs=!TARGET?'':score>TARGET?`🏆 Arkadaşını <b>${show(score-TARGET)}</b> farkla geçtin!`:score===TARGET?'🤝 Berabere!':`😬 Hedefe <b>${show(TARGET-score)}</b> kaldı. Bir daha?`;
  const rec=score>prev?'⭐ Bugünün yeni rekoru!':`Bugünkü rekorun: <b>${show(prev)}</b>`;
  $('#oMsg').innerHTML=[vs,rec].filter(Boolean).join('<br>');
  const url=`${location.origin}${location.pathname}?g=${DAY}&h=${score}`;
  $('#share').onclick=()=>share(`${document.title} · ${DAY_LABEL}\n${card}${show(score)}\nBeni geçebilir misin? 👉 ${url}`);
  $('#again').onclick=()=>{$('#over').hidden=true;again()};
  $('#over').hidden=false;beep(score>prev?784:330,.25,'triangle')}

// fixed 60 Hz simulation whatever the screen refresh rate, so every phone plays the same game
function loop(step,draw){let acc=0,last=performance.now();const f=t=>{acc+=Math.min(100,t-last);last=t;while(acc>=1000/60){step();acc-=1000/60}draw();requestAnimationFrame(f)};requestAnimationFrame(f)}
// keeps a canvas crisp at its CSS size; view.s/ox/oy map a fixed W×H world into it (H=0: fit width only; pad = world-unit margin kept visible around it)
function watchCanvas(cv,W,H,pad=0){const view={},fit=()=>{const r=cv.getBoundingClientRect(),d=devicePixelRatio||1;cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d);
  const s=H?Math.min(r.width/(W+2*pad),r.height/(H+2*pad)):r.width/(W+2*pad);Object.assign(view,{s,d,r,ox:(r.width-W*s)/2,oy:H?(r.height-H*s)/2:0})};
  fit();new ResizeObserver(fit).observe(cv);return view}
const toWorld=(e,v)=>({x:(e.clientX-v.r.left-v.ox)/v.s,y:(e.clientY-v.r.top-v.oy)/v.s});
function worldView(ctx,cv,v,ty=0){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.setTransform(v.d*v.s,0,0,v.d*v.s,v.d*v.ox,v.d*(v.oy-ty*v.s))}

// glowing ball sprite, pre-rendered once (per-frame shadowBlur is slow on phones)
function ballSprite(color){const z=128,c=document.createElement('canvas');c.width=c.height=z;const g=c.getContext('2d'),gr=g.createRadialGradient(z*.42,z*.4,4,z/2,z/2,40);
  gr.addColorStop(0,'#fff');gr.addColorStop(.3,color);gr.addColorStop(1,color);g.shadowColor=color;g.shadowBlur=24;g.fillStyle=gr;g.beginPath();g.arc(z/2,z/2,40,0,6.283);g.fill();return c}
const drawBall=(ctx,spr,x,y,r)=>ctx.drawImage(spr,x-r*1.6,y-r*1.6,r*3.2,r*3.2);

// glossy rounded tile sprite with an optional symbol (shapes keep colours tellable apart), cached per colour
const tileCache={};
function tileSprite(color,sym=''){const key=color+sym;if(tileCache[key])return tileCache[key];const z=128,c=document.createElement('canvas');c.width=c.height=z;const g=c.getContext('2d'),r=24;
  g.fillStyle=color;g.beginPath();g.roundRect(2,2,z-4,z-4,r);g.fill();
  const gr=g.createLinearGradient(0,0,0,z);gr.addColorStop(0,'rgba(255,255,255,.38)');gr.addColorStop(.45,'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(0,0,0,.28)');
  g.fillStyle=gr;g.beginPath();g.roundRect(2,2,z-4,z-4,r);g.fill();
  g.fillStyle='rgba(255,255,255,.4)';g.beginPath();g.roundRect(16,10,z-32,16,8);g.fill();
  if(sym){g.fillStyle='rgba(255,255,255,.55)';g.font='700 44px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(sym,z/2,z/2+4)}
  return tileCache[key]=c}
const SYMS=['●','▲','■','◆','♥'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PRAISE=[['Güzel!','#3ddc84'],['Harika!','#26c6da'],['Süper!','#ffcc33'],['Muhteşem!','#ff7ad9'],['İNANILMAZ!','#ff5d73']];
function praise(i,x,y){const[t,c]=PRAISE[clamp(i,0,4)];float(t,x,y,c,30+clamp(i,0,4)*3)}

// cosmetic particles and floating texts, in world coordinates
const sparks=[],floats=[];
function burst(x,y,color,n=8){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=1+Math.random()*3;sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,color})}}
const float=(text,x,y,color='#fff',size=22)=>floats.push({text,x,y,color,size,t:0});
function drawFx(ctx){
  for(const p of sparks){p.x+=p.vx;p.y+=p.vy;p.vx*=.94;p.vy*=.94;p.life-=.035;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,2+p.life*2.5,0,6.283);ctx.fill()}
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=8;
  for(const f of floats){f.t++;const k=f.t/56;ctx.globalAlpha=Math.max(0,1-k*k);ctx.font=`800 ${f.size*(k<.15?.6+k/.15*.4:1)}px system-ui,sans-serif`;ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y-k*50)}
  ctx.globalAlpha=1;ctx.shadowBlur=0;
  for(let i=sparks.length;i--;)if(sparks[i].life<=0)sparks.splice(i,1);
  for(let i=floats.length;i--;)if(floats[i].t>56)floats.splice(i,1)}
