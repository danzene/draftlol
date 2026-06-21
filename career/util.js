'use strict';
/* =======================================================================
   career/util.js — utilidades puras (PRNG determinístico, helpers)
   Replicadas do index.html para que a camada de carreira seja autossuficiente
   e testável em Node sem depender do site. A MESMA implementação de hashStr/
   seeded garante que sementes batam quando a integração com genTimeline vier.
   ======================================================================= */

function hashStr(s){let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function seeded(seed){let x=hashStr(String(seed))||123456789;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rint=(rnd,a,b)=>a+Math.floor(rnd()*(b-a+1));
const pick=(rnd,arr)=>arr[Math.floor(rnd()*arr.length)];
const mean=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
const round1=x=>Math.round(x*10)/10;
const round2=x=>Math.round(x*100)/100;
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');

const __api={hashStr,seeded,clamp,rint,pick,mean,round1,round2,slug};
if(typeof module!=='undefined'&&module.exports)module.exports=__api;
if(typeof globalThis!=='undefined'){(globalThis.Career=globalThis.Career||{}).util=__api;}
