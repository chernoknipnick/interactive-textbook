(function(root){
'use strict';
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const patterns=['01110/10001/10011/10101/11001/10001/01110','00100/01100/00100/00100/00100/00100/01110','01110/10001/00001/00010/00100/01000/11111','11110/00001/00001/01110/00001/00001/11110','00010/00110/01010/10010/11111/00010/00010','11111/10000/10000/11110/00001/00001/11110','01110/10000/10000/11110/10001/10001/01110','11111/00001/00010/00100/01000/01000/01000','01110/10001/10001/01110/10001/10001/01110','01110/10001/10001/01111/00001/00001/01110'];
function sample(label,dx=0,dy=0){const x=Array(64).fill(0);patterns[label].split('/').forEach((row,y)=>[...row].forEach((v,j)=>{const xx=j+1+dx,yy=y+dy;if(xx>=0&&xx<8&&yy>=0&&yy<8)x[yy*8+xx]=+v;}));return x;}
function shift(x,dx,dy){return x.map((_,i)=>{const xx=i%8-dx,yy=Math.floor(i/8)-dy;return xx>=0&&xx<8&&yy>=0&&yy<8?x[yy*8+xx]:0;});}
class Network{
 constructor(seed=42,hidden=16){if(![8,16,24].includes(hidden))throw new Error("Hidden size must be 8, 16 or 24");this.hidden=hidden;const r=rng(seed);this.w1=Array.from({length:hidden},()=>Array.from({length:64},()=>(r()-.5)*.4));this.b1=Array(hidden).fill(0);this.w2=Array.from({length:10},()=>Array.from({length:hidden},()=>(r()-.5)*.7));this.b2=Array(10).fill(0);this.steps=0;}
 forward(x){const z=this.w1.map((w,j)=>w.reduce((s,v,i)=>s+v*x[i],this.b1[j]));const h=z.map(Math.tanh);const logits=this.w2.map((w,k)=>w.reduce((s,v,j)=>s+v*h[j],this.b2[k]));const max=Math.max(...logits),e=logits.map(v=>Math.exp(v-max)),sum=e.reduce((a,b)=>a+b,0);return {z,h,p:e.map(v=>v/sum)};}
 train(x, label, rate = .04) {
   const f = this.forward(x);
   const d = f.p.map((v,k) => v - (k === label ? 1 : 0));
   const dh = f.h.map((v,j) => (1 - v*v) * d.reduce((s,dk,k) => s + dk*this.w2[k][j], 0));
   const before = this.w1[0].slice();
   const b = this.b1[0];
   for (let k = 0; k < 10; k++) {
     for (let j = 0; j < this.hidden; j++) this.w2[k][j] -= rate * d[k] * f.h[j];
     this.b2[k] -= rate * d[k];
   }
   for (let j = 0; j < this.hidden; j++) {
     for (let i = 0; i < 64; i++) this.w1[j][i] -= rate * dh[j] * x[i];
     this.b1[j] -= rate * dh[j];
   }
   this.steps++;
   const after = this.forward(x);
   return {
     loss: -Math.log(Math.max(f.p[label], 1e-12)),
     afterLoss: -Math.log(Math.max(after.p[label], 1e-12)),
     probabilities: f.p, afterProbabilities: after.p,
     before, b, dh: dh[0], rate
   };
 }
}
const shifts = [
  {dx: 0, dy: 0, label: 'Исходные рисунки'},
  {dx: -1, dy: 0, label: 'На клетку влево'},
  {dx: 1, dy: 0, label: 'На клетку вправо'},
  {dx: 0, dy: 1, label: 'На клетку вниз'}
];
function dataset(diverse = false) {
  const variants = diverse ? shifts : shifts.slice(0, 1);
  return Array.from({length: 10}, (_, y) => variants.map(({dx, dy, label}) =>
    ({x: sample(y, dx, dy), y, variant: label})
  )).flat();
}
function evaluate(net) {
  const random = rng(917);
  const results = [];
  for (let digit = 0; digit < 10; digit++) {
    for (let variation = 0; variation < 6; variation++) {
      const pixels = sample(digit, variation % 3 - 1, variation % 2)
        .map(value => Math.max(0, Math.min(1, value + (random() - .5) * .3)));
      const estimates = net.forward(pixels).p;
      const prediction = estimates.indexOf(Math.max(...estimates));
      results.push({pixels, digit, prediction, correct: prediction === digit});
    }
  }
  return results;
}
function score(net) {
  return evaluate(net).filter(result => result.correct).length;
}
const api={Network,sample,shift,dataset,evaluate,score,rng};root.DigitLab=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
