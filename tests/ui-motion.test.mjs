import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import postcss from 'postcss';
const source=await readFile(new URL('../ui-motion.js',import.meta.url),'utf8');
const css=await readFile(new URL('../ui-motion.css',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
async function setup({reduced=false,paused=false,animations=true}={}){
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const mq={matches:reduced,addEventListener(type,fn){this.change=fn;}};w.matchMedia=()=>mq;
 if(paused)w.localStorage.setItem('mapletools-motion-paused','true');
 const plays=[];
 if(animations)w.Element.prototype.animate=function(frames,options){let resolve,reject;const a={node:this,frames,options,finished:new Promise((r,j)=>{resolve=r;reject=j;}),finish:()=>resolve(),cancel:()=>reject(new Error('cancelled'))};plays.push(a);return a;};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.eval(source);return {dom,w,mq,plays,M:w.MapleMotion,d:w.document};
}
test('motion preference persists across pages and OS reduction overrides it immediately',async()=>{
 const {dom,w,mq,plays,M,d}=await setup();
 const play=M.enter(d.querySelector('main'));assert.equal(plays.length,1);
 d.getElementById('motion-toggle').click();assert.equal(await play,false);assert.equal(M.enabled(),false);assert.equal(w.localStorage.getItem('mapletools-motion-paused'),'true');
 d.getElementById('motion-toggle').click();mq.matches=true;mq.change();assert.equal(M.enabled(),false);assert.equal(d.getElementById('motion-toggle').disabled,true);
 assert.equal(await M.enter(d.querySelector('main')),false);assert.equal(plays.length,1);
 mq.matches=false;mq.change();w.localStorage.setItem('mapletools-motion-paused','true');w.dispatchEvent(new w.StorageEvent('storage',{key:'mapletools-motion-paused'}));assert.equal(M.enabled(),false);dom.window.close();
 const next=await setup({paused:true});assert.equal(next.M.enabled(),false);assert.equal(next.d.getElementById('motion-toggle').textContent,'모션 켜기');next.dom.window.close();
});
test('rapid dialog close, Escape, and motion cancellation preserve native close and focus flow',async()=>{
 const {dom,w,d,M,plays}=await setup();const dialog=d.createElement('dialog');d.body.append(dialog);dialog.showModal();await flush();plays.at(-1).finish();await flush();
 let closed=0;dialog.addEventListener('close',()=>closed++);
 dialog.dispatchEvent(new w.Event('cancel',{cancelable:true}));M.closeDialog(dialog);assert.equal(closed,0);plays.at(-1).finish();await flush();assert.equal(closed,1);
 dialog.showModal();await flush();M.closeDialog(dialog);d.getElementById('motion-toggle').click();await flush();assert.equal(dialog.open,false);assert.equal(closed,2);dom.window.close();
});
test('fast FAQ reversal and pausing while it moves leave the last requested state readable',async()=>{
 const {dom,d,plays}=await setup();const details=d.querySelector('.faq details'),summary=details.querySelector('summary');
 summary.click();summary.click();plays.at(-1).finish();await flush();assert.equal(details.open,false);assert.equal(details.style.overflow,'');
 summary.click();d.getElementById('motion-toggle').click();await flush();assert.equal(details.open,true);assert.equal(details.style.overflow,'');dom.window.close();
});
test('without animation support interactions remain immediate and no decorative delays run',async()=>{
 const {dom,d,M}=await setup({animations:false});const dialog=d.createElement('dialog');d.body.append(dialog);dialog.open=true;M.closeDialog(dialog);assert.equal(dialog.open,false);
 const summary=d.querySelector('.faq summary');summary.click();await flush();assert.equal(summary.parentElement.open,true);dom.window.close();
});
test('every interactive page shares motion assets and reduced-motion rules cover decoration',async()=>{
 postcss.parse(css);
 for(const page of ['index','mystery','demo','coordi','terms','privacy','updates']){
  const html=await readFile(new URL('../'+page+'.html',import.meta.url),'utf8');
  assert.equal((html.match(/src="ui-motion.js/g)||[]).length,1);assert.match(html,/href="ui-motion.css/);
 }
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/\.motion-paused \*::before/);
});
