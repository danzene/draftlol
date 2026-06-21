'use strict';
/* =======================================================================
   scripts/test-contextual-wr.js — testes da função contextualWinrate
   com 3 exemplos concretos de matchup usando números reais.

   Replica as funções puras de index.html para rodar em Node isolado.
   Uso: node scripts/test-contextual-wr.js
   ======================================================================= */

/* ── utilitários mínimos ─────────────────────────────────────────────── */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=(h*16777619)>>>0;}return h;}
function seeded(seed){let x=hashStr(String(seed))||123456789;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}

/* ── ARCH_CTR (idêntico ao index.html) ──────────────────────────────── */
const ARCH_CTR={
  engage:   {engage:0, dive:0,  burst:-1, poke:2,  sustain:0,  peel:-1, scaling:1, teamfight:-1},
  dive:     {engage:0, dive:0,  burst:0,  poke:1,  sustain:-1, peel:-2, scaling:1, teamfight:-1},
  burst:    {engage:1, dive:0,  burst:0,  poke:1,  sustain:-2, peel:-1, scaling:1, teamfight:-1},
  poke:     {engage:-2,dive:-1, burst:-1, poke:0,  sustain:1,  peel:0,  scaling:1, teamfight:-1},
  sustain:  {engage:0, dive:1,  burst:2,  poke:-1, sustain:0,  peel:0,  scaling:-1,teamfight:0},
  peel:     {engage:1, dive:2,  burst:1,  poke:0,  sustain:0,  peel:0,  scaling:0, teamfight:1},
  scaling:  {engage:-1,dive:-1, burst:-1, poke:-1, sustain:1,  peel:0,  scaling:0, teamfight:1},
  teamfight:{engage:1, dive:1,  burst:1,  poke:1,  sustain:0,  peel:-1, scaling:-1,teamfight:0},
};

const ARCH_ALLY_SYN={
  'engage-dive':2,'engage-teamfight':1,'engage-burst':1,
  'poke-scaling':1,'poke-peel':1,
  'peel-sustain':1,'peel-scaling':1,
  'dive-burst':1,
};

const MIN_MU_GAMES=15;
const MIN_PRO_MU_GAMES=5;

/* ── estStats simplificado (sem Data Dragon) ─────────────────────────── */
function estStats(champ,ctxLabel=''){
  const rnd=seeded(champ.id+'|'+ctxLabel);
  if(STATS_SNAPSHOT?.byChampion?.[champ.id]){
    let g=0,w=0;
    Object.values(STATS_SNAPSHOT.byChampion[champ.id]).forEach(d=>{g+=d.games;w+=d.wins;});
    if(g>=30)return{wr:+clamp(w/g*100,42,58).toFixed(1),pr:4+Math.round(rnd()*16),source:'real',games:g};
  }
  // fallback simples (sem powerCurveStats — só noise)
  const noise=(rnd()-0.5)*2;
  const wr=clamp(50+noise,44,57);
  return{wr:+wr.toFixed(1),pr:4+Math.round(rnd()*16),source:'estimado',games:0};
}

/* ── contextualWinrate (idêntico ao index.html) ──────────────────────── */
let STATS_SNAPSHOT=null;
let PRO_MATCHUPS=null;

function contextualWinrate(champ,role,ctx,enemyPicksByRole,allyPicks){
  const base=estStats(champ,ctx?.label||'');
  let delta=0,source=base.source,games=base.games;
  const enemy=(enemyPicksByRole||{})[role];
  if(enemy){
    const mu=STATS_SNAPSHOT?.byMatchup?.[role];
    const pm=PRO_MATCHUPS?.byMatchup?.[role];
    const k1=`${champ.id}-${enemy.id}`;
    const k2=`${enemy.id}-${champ.id}`;
    let adj=null;
    if(mu?.[k1]?.games>=MIN_MU_GAMES){adj=(mu[k1].winsA/mu[k1].games-0.5)*20;source='real';games=mu[k1].games;}
    else if(mu?.[k2]?.games>=MIN_MU_GAMES){adj=(0.5-mu[k2].winsA/mu[k2].games)*20;source='real';games=mu[k2].games;}
    else if(pm?.[k1]?.games>=MIN_PRO_MU_GAMES){adj=(pm[k1].winsA/pm[k1].games-0.5)*18;source='pro';games=pm[k1].games;}
    else if(pm?.[k2]?.games>=MIN_PRO_MU_GAMES){adj=(0.5-pm[k2].winsA/pm[k2].games)*18;source='pro';games=pm[k2].games;}
    else{adj=(ARCH_CTR[champ.arch]?.[enemy.arch]||0)*1.5;}
    delta+=adj;
  }
  (allyPicks||[]).forEach(ally=>{
    if(!ally||ally.id===champ.id)return;
    const k1=`${champ.arch}-${ally.arch}`;
    const k2=`${ally.arch}-${champ.arch}`;
    delta+=(ARCH_ALLY_SYN[k1]||ARCH_ALLY_SYN[k2]||0)*0.4;
  });
  return{wr:+clamp(base.wr+delta,35,65).toFixed(1),source,games,pr:base.pr};
}

/* ── harness ─────────────────────────────────────────────────────────── */
let passed=0,failed=0;
function expect(label,actual,expected,tol=0.05){
  const ok=Math.abs(actual-expected)<=tol;
  if(ok){passed++;console.log(`  ✓ ${label}: ${actual}`);}
  else{failed++;console.error(`  ✗ ${label}: esperado ${expected} ± ${tol}, obtido ${actual}`);}
}

/* ══════════════════════════════════════════════════════════════════════
   Exemplo 1 — DADOS REAIS: Aatrox vs Darius no topo
   Stats mock: Aatrox vence 55/100 games contra Darius
   Delta esperado: (0.55 - 0.5) * 20 = +1.0
   Base WR Aatrox = 50 ± noise; resultado final clampado em [35,65]
   ══════════════════════════════════════════════════════════════════════ */
console.log('\n── Exemplo 1: Dados reais (Aatrox x Darius, top) ──');
STATS_SNAPSHOT={byMatchup:{top:{'Aatrox-Darius':{games:100,winsA:55}}}};
PRO_MATCHUPS=null;
const aatrox={id:'Aatrox',arch:'dive',roles:['top']};
const darius ={id:'Darius',arch:'sustain',roles:['top']};
const r1=contextualWinrate(aatrox,'top',null,{top:darius},[]);
console.log(`  WR Aatrox vs Darius: ${r1.wr}% (source: ${r1.source}, games: ${r1.games})`);
expect('source === real', r1.source==='real'?1:0, 1, 0);
expect('games === 100',   r1.games, 100, 0);
// base ≈ 50, delta = +1.0 → esperado ≈ 51
expect('WR ≈ 51', r1.wr, 51, 1.5);

/* ══════════════════════════════════════════════════════════════════════
   Exemplo 2 — HEURÍSTICA: Lux (poke) vs Leona (engage) no suporte
   ARCH_CTR.poke.engage = -2 → adj = -2 * 1.5 = -3.0
   Base WR Lux ≈ 50; resultado esperado ≈ 47
   ══════════════════════════════════════════════════════════════════════ */
console.log('\n── Exemplo 2: Heurística de arquétipo (Lux x Leona, support) ──');
STATS_SNAPSHOT=null;
PRO_MATCHUPS=null;
const lux  ={id:'Lux',   arch:'poke',   roles:['support','mid']};
const leona={id:'Leona', arch:'engage', roles:['support']};
const r2=contextualWinrate(lux,'support',null,{support:leona},[]);
console.log(`  WR Lux vs Leona: ${r2.wr}% (source: ${r2.source})`);
expect('source === estimado', r2.source==='estimado'?1:0, 1, 0);
// base ≈ 50, delta = -3.0 → esperado ≈ 47
expect('WR ≈ 47', r2.wr, 47, 2.0);

/* ══════════════════════════════════════════════════════════════════════
   Exemplo 3 — PRO PLAY + SINERGIA: Jinx (scaling) adc
   Pro data: Jinx vence 7/10 games vs Caitlyn
   Delta counter: (0.7 - 0.5) * 18 = +3.6
   Aliados: Thresh (peel) e Orianna (teamfight)
   ARCH_ALLY_SYN: 'peel-scaling'=1 → +0.4; 'teamfight-scaling'=0 → +0
   Total delta: +3.6 + 0.4 = +4.0 → base ≈ 50, resultado ≈ 54
   ══════════════════════════════════════════════════════════════════════ */
console.log('\n── Exemplo 3: Pro play + sinergia (Jinx vs Caitlyn, adc) ──');
STATS_SNAPSHOT=null;
PRO_MATCHUPS={byMatchup:{adc:{'Jinx-Caitlyn':{games:10,winsA:7}}}};
const jinx    ={id:'Jinx',     arch:'scaling',    roles:['adc']};
const caitlyn ={id:'Caitlyn',  arch:'poke',       roles:['adc']};
const thresh  ={id:'Thresh',   arch:'peel',       roles:['support']};
const orianna ={id:'Orianna',  arch:'teamfight',  roles:['mid']};
const r3=contextualWinrate(jinx,'adc',null,{adc:caitlyn},[thresh,orianna]);
console.log(`  WR Jinx vs Caitlyn + allies: ${r3.wr}% (source: ${r3.source}, games: ${r3.games})`);
expect('source === pro', r3.source==='pro'?1:0, 1, 0);
expect('games === 10',   r3.games, 10, 0);
// base ≈ 50, counter +3.6, syn +0.4 → esperado ≈ 54
expect('WR ≈ 54', r3.wr, 54, 2.0);

/* ── resumo ──────────────────────────────────────────────────────────── */
console.log(`\n── Resultado: ${passed} ✓ / ${failed} ✗ ──`);
if(failed)process.exit(1);
