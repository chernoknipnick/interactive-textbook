(() => {
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const pause=widget=>{widget.classList.remove('is-playing');widget.classList.add('is-paused');widget.getAnimations({subtree:true}).forEach(a=>{if(!(a instanceof CSSAnimation))a.cancel();});};
 const step=(widget,nodes)=>{if(reduced())return;for(const node of nodes.filter(Boolean)){node.getAnimations().forEach(a=>{if(!(a instanceof CSSAnimation))a.cancel();});node.animate([{transform:'translateY(2px)'},{transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.22,.61,.36,1)'});}};
 const reserve=(widget,code,examples)=>{
  const block=code.closest('pre')||code,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');let previousWidth=0;
  const measure=()=>{const style=getComputedStyle(block),width=block.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);if(width<=0||width===previousWidth)return;previousWidth=width;const font=getComputedStyle(code);ctx.font=font.fontStyle+' '+font.fontWeight+' '+font.fontSize+' '+font.fontFamily;const rows=Math.max(...examples.map(text=>text.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(ctx.measureText(line).width/width)),0)));block.style.minHeight=Math.ceil(rows*parseFloat(font.lineHeight)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+2)+'px';};
  new ResizeObserver(measure).observe(widget);measure();
 };
 window.lessonMotion={pause,step,reduced,reserve};
 matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{if(reduced())document.querySelectorAll('.course-trace,.oop-widget,.lesson-visual').forEach(widget=>{widget.dispatchEvent(new Event('lesson-pause'));pause(widget);});});
})();
