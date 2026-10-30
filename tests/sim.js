const Mark = require('./mark_sim.js');
const fs=require('fs');const S=JSON.parse(fs.readFileSync('app/strokes.json'));const W=JSON.parse(fs.readFileSync('app/words.json'));
let seed=1;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};const g=()=>(rnd()+rnd()+rnd()-1.5)/1.5;
function mess(med, amt){ // amt 1 = typical messy handwriting
  const off={x:g()*50*amt,y:g()*50*amt}, sc=1+g()*0.2*amt, th=g()*0.15*amt;
  const c=med.reduce((a,[x,y])=>({x:a.x+x/med.length,y:a.y+y/med.length}),{x:0,y:0});
  let pts=[];for(let i=1;i<med.length;i++){const [x0,y0]=med[i-1],[x1,y1]=med[i];for(let t=0;t<1;t+=0.1)pts.push({x:x0+(x1-x0)*t,y:y0+(y1-y0)*t});}pts.push({x:med[med.length-1][0],y:med[med.length-1][1]});
  const ph=rnd()*6, wob=30*amt*rnd();
  return pts.map((p,i)=>{let x=(p.x-c.x)*sc,y=(p.y-c.y)*sc;const X=x*Math.cos(th)-y*Math.sin(th),Y=x*Math.sin(th)+y*Math.cos(th);
    return {x:c.x+X+off.x+Math.sin(i/4+ph)*wob,y:c.y+Y+off.y+Math.cos(i/5+ph)*wob};});
}
const chars=[...new Set(W.slice(0,300).flatMap(w=>[...w.t]))].slice(0,150);
for (const amt of [0.5,1,1.5,2]) {
  const r={};
  for (const mode of ['standard','lenient','free']) { let ok=0,tot=0;
    for (const c of chars){ const d=S[c]; const cs=1+g()*0.25*amt, co={x:g()*90*amt,y:g()*90*amt}; const user=d.medians.map(m=>mess(m,amt).map(p=>({x:512+(p.x-512)*cs+co.x,y:388+(p.y-388)*cs+co.y}))); const res=Mark.character(user,d,mode); tot++; if(res.correct) ok++; }
    r[mode]=(100*ok/tot).toFixed(0)+'%'; }
  // wrong-character false accept: write char A's strokes, check against char B with same stroke count
  console.log('mess',amt,JSON.stringify(r));
}
// false accept test
let fa={standard:0,lenient:0,free:0},n=0;
for (let i=0;i<chars.length;i++){const a=S[chars[i]];const b=chars.find((c,j)=>j!==i&&S[c].medians.length===a.medians.length);if(!b)continue;n++;
 for(const mode in fa){ if(Mark.character(a.medians.map(m=>mess(m,0.5)),S[b],mode).correct) fa[mode]++; }}
console.log('false accept of a different char with same stroke count',n,JSON.stringify(fa));
