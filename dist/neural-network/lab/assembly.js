'use strict';
let assemblyTimer=null,assemblyStage=0,assemblyNeuron=0;
const assemblyPanel=document.createElement('section');assemblyPanel.id='assembly';assemblyPanel.className='card assembly';assemblyPanel.hidden=true;
assemblyPanel.innerHTML=`<div class="assembly-heading"><div><span class="eyebrow">Вот что ты создал</span><h2 tabindex="-1" id="assembly-title">Твоя нейросеть</h2></div><span class="tag">Создана · ещё не обучена</span></div><p class="note">Сеть уже создана в памяти. Анимация по очереди раскрывает её части — обучение пока не запускается.</p><div class="assembly-steps" aria-label="Части созданной сети"><button data-assembly="0">1 · Вход</button><button data-assembly="1">2 · Нейроны</button><button data-assembly="2">3 · Выход</button><button data-assembly="3">4 · Веса</button></div><svg id="assembly-svg" viewBox="0 0 720 330" role="img" aria-label="Схема созданной нейросети"></svg><div class="assembly-caption" aria-live="polite"><b id="assembly-caption-title"></b><p id="assembly-caption-text"></p></div><div id="assembly-inspect" hidden><label for="assembly-neuron">Рассмотреть связи нейрона</label> <select id="assembly-neuron"></select><p id="assembly-weight" class="note"></p></div><div class="assembly-footer"><button id="assembly-replay">Повторить сборку</button><button id="assembly-next" class="primary">Теперь проверим её →</button></div>`;
document.querySelector('#experience').before(assemblyPanel);
const assemblyCaptions=[['64 входа: по одному на клетку','Каждая клетка рисунка передаст число от 0 до 1. Входы — это данные, а не готовый ответ.'],['Скрытый слой: блоки вычислений','Каждый нейрон получает все 64 входа. Умножает числа на веса, складывает со смещением и вычисляет свой выход.'],['10 выходов: по одному на цифру','Каждый выход получает значения всех скрытых нейронов. Затем softmax преобразует 10 результатов в оценки. Пока ответ не вычислялся.'],['Связям присвоены начальные веса','У каждой связи есть своё число — вес. Начальные веса случайные; обучение будет их менять. Смещения сейчас равны нулю.']];
function assemblyDraw(){
 const h=net.hidden,n=assemblyNeuron,inputs=Array.from({length:64},(_,i)=>({x:40+(i%8)*13,y:105+Math.floor(i/8)*13})),hidden=Array.from({length:h},(_,j)=>({x:322+(j%2)*44,y:65+Math.floor(j/2)*(205/Math.max(1,Math.ceil(h/2)-1))})),outputs=Array.from({length:10},(_,k)=>({x:636,y:58+k*24}));
 const color=w=>w>=0?'#258d7e':'#bd7249';let svg='';
 if(assemblyStage>=1){for(let i=0;i<64;i++){const w=net.w1[n][i];svg+=`<line x1="${inputs[i].x}" y1="${inputs[i].y}" x2="${hidden[n].x}" y2="${hidden[n].y}" stroke="${color(w)}" stroke-width="${.5+Math.abs(w)*3}" opacity=".24"/>`;}}
 if(assemblyStage>=2){for(let k=0;k<10;k++){const w=net.w2[k][n];svg+=`<line x1="${hidden[n].x}" y1="${hidden[n].y}" x2="${outputs[k].x}" y2="${outputs[k].y}" stroke="${color(w)}" stroke-width="${.8+Math.abs(w)*3}" opacity=".45"/>`;}}
 svg+='<g fill="#173638" font-family="Segoe UI,Arial" text-anchor="middle"><text x="86" y="26" font-size="17" font-weight="600">64 входа</text>';
 if(assemblyStage>=1)svg+=`<text x="344" y="26" font-size="17" font-weight="600">${h} нейронов</text>`;
 if(assemblyStage>=2)svg+='<text x="636" y="26" font-size="17" font-weight="600">10 выходов</text>';
 svg+='</g>';
 for(const p of inputs)svg+=`<rect x="${p.x-4}" y="${p.y-4}" width="8" height="8" rx="2" fill="#8fc3b0"/>`;
 if(assemblyStage>=1)for(let j=0;j<h;j++)svg+=`<circle cx="${hidden[j].x}" cy="${hidden[j].y}" r="10" fill="${j===n?'#147d70':'#eef5ef'}" stroke="${j===n?'#c68a32':'#92b5a6'}" stroke-width="${j===n?3:1}"/><text x="${hidden[j].x}" y="${hidden[j].y+3}" font-size="9" text-anchor="middle" fill="${j===n?'white':'#173638'}">${j+1}</text>`;
 if(assemblyStage>=2)for(let k=0;k<10;k++)svg+=`<circle cx="636" cy="${outputs[k].y}" r="10" fill="#eef5ef" stroke="#92b5a6"/><text x="636" y="${outputs[k].y+4}" font-size="12" text-anchor="middle" fill="#173638">${k}</text>`;
 svg+='<text x="86" y="309" font-size="13" text-anchor="middle" fill="#53696b">яркость клеток</text>';
 if(assemblyStage>=1)svg+='<text x="344" y="309" font-size="13" text-anchor="middle" fill="#53696b">умножить → сложить → tanh</text>';
 if(assemblyStage>=2)svg+='<text x="636" y="309" font-size="13" text-anchor="middle" fill="#53696b">оценки цифр</text>';
 $('#assembly-svg').innerHTML=svg;
 $('#assembly-svg').setAttribute('aria-label',`Созданная сеть: 64 входа, ${h} скрытых нейронов, 10 выходов. Выделены связи нейрона ${n+1}.`);
 $('#assembly-title').textContent=`Твоя сеть: 64 → ${h} → 10`;
 $('#assembly-caption-title').textContent=assemblyCaptions[assemblyStage][0];$('#assembly-caption-text').textContent=assemblyCaptions[assemblyStage][1];
 $('#assembly-inspect').hidden=assemblyStage!==3;
 $('#assembly-weight').textContent=`Всего ${74*h} весов (${64*h} + ${10*h}) и ${h+10} смещений. Показаны только связи нейрона ${n+1}, чтобы схема читалась. Например: клетка 1 → нейрон ${n+1}, вес ${net.w1[n][0].toFixed(4)}; нейрон ${n+1} → выход «0», вес ${net.w2[0][n].toFixed(4)}. Зелёный — положительный, рыжий — отрицательный вес; толщина зависит от его величины.`;
 $$('[data-assembly]').forEach(b=>{b.classList.toggle('active',+b.dataset.assembly===assemblyStage);b.setAttribute('aria-pressed',+b.dataset.assembly===assemblyStage);});
}
function startAssembly(){clearTimeout(assemblyTimer);assemblyStage=0;assemblyNeuron=0;$('#experience').hidden=true;assemblyPanel.hidden=false;$('#assembly-neuron').innerHTML=Array.from({length:net.hidden},(_,i)=>`<option value="${i}">Нейрон ${i+1}</option>`).join('');assemblyDraw();assemblyPanel.scrollIntoView({behavior:'smooth',block:'start'});$('#assembly-title').focus({preventScroll:true});if(matchMedia('(prefers-reduced-motion: reduce)').matches){assemblyStage=3;assemblyDraw();return;}const advance=()=>{if(assemblyStage<3){assemblyStage++;assemblyDraw();assemblyTimer=setTimeout(advance,1800);}};assemblyTimer=setTimeout(advance,1800);}
$$('[data-assembly]').forEach(b=>b.onclick=()=>{clearTimeout(assemblyTimer);assemblyStage=+b.dataset.assembly;assemblyDraw();});
$('#assembly-neuron').onchange=()=>{assemblyNeuron=+$('#assembly-neuron').value;assemblyDraw();};
$('#assembly-replay').onclick=startAssembly;
$('#assembly-next').onclick=()=>{clearTimeout(assemblyTimer);assemblyPanel.hidden=true;$('#experience').hidden=false;$('#experience').scrollIntoView({behavior:'smooth',block:'start'});$('#recognize').focus({preventScroll:true});};
