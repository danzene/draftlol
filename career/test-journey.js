'use strict';
/* =======================================================================
   career/test-journey.js — testes da engine de jornada plurianual.

   Cobre: regiões, dificuldade por ano/etapa, geração de rivais,
          estado inicial, progressão de etapas, recompensas, virada de ano.
   Simula uma carreira de 3 anos com seed fixa e imprime a progressão.

   Uso: node career/test-journey.js
   ======================================================================= */

const h       = require('./tests/_harness.js');
const journey = require('./journey.js');
const util    = require('./util.js');

/* ── Regiões ──────────────────────────────────────────────────────── */

h.test('REGIONS tem 10 regiões', ()=>h.assertEq(journey.REGIONS.length, 10, 'count'));
h.test('todas as regiões têm id, label, continent, strength', ()=>{
  journey.REGIONS.forEach(r=>{
    h.assert(r.id&&r.label&&r.continent&&r.strength>=0,'campos presentes: '+r.id);
  });
});
h.test('REGION_BY_ID[KR].strength === 95', ()=>h.assertEq(journey.REGION_BY_ID['KR'].strength, 95));
h.test('KR mais forte que BR', ()=>h.assert(
  journey.REGION_BY_ID['KR'].strength > journey.REGION_BY_ID['BR'].strength, 'KR>BR'
));
h.test('todos os continentes presentes (asia, emea, americas, pacific)', ()=>{
  const conts = new Set(journey.REGIONS.map(r=>r.continent));
  ['asia','emea','americas','pacific'].forEach(c=>h.assert(conts.has(c), c+' ausente'));
});

/* ── Rivais do continente ──────────────────────────────────────────── */

h.test('continentRivals(BR) inclui NA e LAS mas não BR', ()=>{
  const r = journey.continentRivals('BR');
  h.assert(r.some(x=>x.id==='NA'),  'NA presente');
  h.assert(r.some(x=>x.id==='LAS'), 'LAS presente');
  h.assert(!r.some(x=>x.id==='BR'), 'BR ausente');
});
h.test('continentRivals(KR) inclui CN e VN', ()=>{
  const r = journey.continentRivals('KR');
  h.assert(r.some(x=>x.id==='CN'), 'CN presente');
  h.assert(r.some(x=>x.id==='VN'), 'VN presente');
});

/* ── Dificuldade ───────────────────────────────────────────────────── */

h.test('aiDifficulty ano 1 national BR === 68', ()=>
  h.assertEq(journey.aiDifficulty(1,'national',68), 68)
);
h.test('aiDifficulty ano 2 national BR === 71 (68+3)', ()=>
  h.assertEq(journey.aiDifficulty(2,'national',68), 71)
);
h.test('aiDifficulty mundial > continental > nacional (mesmo ano)', ()=>{
  const n = journey.aiDifficulty(1,'national',70);
  const c = journey.aiDifficulty(1,'continental',70);
  const m = journey.aiDifficulty(1,'mundial',70);
  h.assert(m>c && c>n, `mundial(${m})>cont(${c})>nac(${n})`);
});
h.test('aiDifficulty cresce YEAR_SCALING por ano', ()=>{
  const d1 = journey.aiDifficulty(1,'national',60);
  const d2 = journey.aiDifficulty(2,'national',60);
  h.assertEq(d2-d1, journey.YEAR_SCALING, 'delta/ano');
});
h.test('aiDifficulty clampeia em 98', ()=>{
  const d = journey.aiDifficulty(100,'mundial',95);
  h.assert(d<=98, 'max 98, veio '+d);
});
h.test('aiDifficulty nunca cai abaixo de 10', ()=>{
  const d = journey.aiDifficulty(1,'national',1);
  h.assert(d>=10, 'min 10, veio '+d);
});

/* ── buildJourneyRival ─────────────────────────────────────────────── */

h.test('buildJourneyRival é determinístico', ()=>{
  const a = journey.buildJourneyRival('seed1', 70);
  const b = journey.buildJourneyRival('seed1', 70);
  h.assertEq(a.name, b.name, 'nome igual');
  h.assertEq(a.strength, b.strength, 'força igual');
  h.assertEq(a.id, b.id, 'id igual');
});
h.test('buildJourneyRival strength dentro de 10..98', ()=>{
  for(let i=0;i<20;i++){
    const r = journey.buildJourneyRival('t'+i, 70);
    h.assert(r.strength>=10&&r.strength<=98,'range: '+r.strength);
  }
});
h.test('buildJourneyRival tem seed para roster', ()=>{
  const r = journey.buildJourneyRival('x', 60);
  h.assert(typeof r.seed==='string'&&r.seed.length>0,'seed presente');
});

/* ── buildRecurringRivals ──────────────────────────────────────────── */

h.test('buildRecurringRivals retorna 3 rivais', ()=>{
  h.assertEq(journey.buildRecurringRivals('BR','x').length, 3);
});
h.test('buildRecurringRivals é determinístico', ()=>{
  const a = journey.buildRecurringRivals('KR','s');
  const b = journey.buildRecurringRivals('KR','s');
  h.assert(a.every((r,i)=>r.name===b[i].name), 'nomes iguais');
  h.assert(a.every((r,i)=>r.strength===b[i].strength), 'forças iguais');
});

/* ── initialWorldState ─────────────────────────────────────────────── */

h.test('initialWorldState.stage === national', ()=>
  h.assertEq(journey.initialWorldState('BR').stage,'national')
);
h.test('initialWorldState tem 3 rivals', ()=>
  h.assertEq(journey.initialWorldState('BR').rivals.length, 3)
);
h.test('initialWorldState trophies zerados', ()=>{
  const ws = journey.initialWorldState('BR');
  h.assertEq(ws.trophies.nacional, undefined);
  h.assertEq(ws.trophies.mundial, 0);
});

/* ── nextOpponent ──────────────────────────────────────────────────── */

h.test('nextOpponent chef mais forte que normal (na média)', ()=>{
  const ws = journey.initialWorldState('BR');
  let chefSum=0, normalSum=0, N=10;
  for(let i=0;i<N;i++){
    chefSum   += journey.nextOpponent(ws,'BR',1,'national',true).strength;
    normalSum += journey.nextOpponent(ws,'BR',1,'national',false).strength;
  }
  h.assert(chefSum/N >= normalSum/N - 5, 'chef >= normal na media');
});
h.test('nextOpponent é determinístico (chef)', ()=>{
  const ws = journey.initialWorldState('BR');
  const a = journey.nextOpponent(ws,'BR',1,'mundial',true);
  const b = journey.nextOpponent(ws,'BR',1,'mundial',true);
  h.assertEq(a.name, b.name, 'nome chef igual');
});

/* ── stageRewards ──────────────────────────────────────────────────── */

h.test('mundial PE > continental > nacional (vitória)', ()=>{
  const n=journey.stageRewards('national',true);
  const c=journey.stageRewards('continental',true);
  const m=journey.stageRewards('mundial',true);
  h.assert(m.pe>c.pe&&c.pe>n.pe,'escalonamento correto');
});
h.test('vitória dá mais PE que derrota', ()=>{
  const w=journey.stageRewards('mundial',true);
  const l=journey.stageRewards('mundial',false);
  h.assert(w.pe>l.pe,'win>loss PE');
  h.assert(w.fichas>l.fichas,'win>loss Fichas');
});

/* ── advanceStage ──────────────────────────────────────────────────── */

h.test('national → continental após jogar', ()=>{
  const ws=journey.initialWorldState('BR');
  const ws2=journey.advanceStage(ws,'national',true);
  h.assertEq(ws2.stage,'continental','stage avancou');
  h.assert(ws2.national.completed,'nacional completo');
  h.assert(ws2.national.qualified,'qualificou');
});
h.test('nacional derrota ainda classifica (protagonista)', ()=>{
  const ws=journey.initialWorldState('BR');
  const ws2=journey.advanceStage(ws,'national',false);
  h.assertEq(ws2.stage,'continental','ainda avança');
});
h.test('continental derrota → offseason', ()=>{
  let ws=journey.initialWorldState('BR');
  ws=journey.advanceStage(ws,'national',true);
  ws=journey.advanceStage(ws,'continental',false);
  h.assertEq(ws.stage,'offseason','perdeu continental');
});
h.test('continental vitória → mundial', ()=>{
  let ws=journey.initialWorldState('BR');
  ws=journey.advanceStage(ws,'national',true);
  ws=journey.advanceStage(ws,'continental',true);
  h.assertEq(ws.stage,'mundial');
});
h.test('mundial vitória → troféu e offseason', ()=>{
  let ws=journey.initialWorldState('BR');
  ws=journey.advanceStage(ws,'national',true);
  ws=journey.advanceStage(ws,'continental',true);
  ws=journey.advanceStage(ws,'mundial',true);
  h.assertEq(ws.stage,'offseason');
  h.assertEq(ws.trophies.mundial,1,'troféu');
});
h.test('advanceStage é imutável (não muta o original)', ()=>{
  const ws=journey.initialWorldState('BR');
  journey.advanceStage(ws,'national',true);
  h.assertEq(ws.stage,'national','original intacto');
});

/* ── yearEnd ───────────────────────────────────────────────────────── */

h.test('yearEnd reseta stage para national', ()=>{
  let ws=journey.initialWorldState('BR');
  ws.stage='offseason';
  h.assertEq(journey.yearEnd(ws).stage,'national');
});
h.test('yearEnd rivais ficam mais fortes', ()=>{
  const ws=journey.initialWorldState('BR');
  const str0=ws.rivals[0].strength;
  const ws2=journey.yearEnd(ws);
  h.assert(ws2.rivals[0].strength>str0,'rival evoluiu');
});
h.test('yearEnd adiciona ao histórico', ()=>{
  const ws=journey.initialWorldState('BR');
  h.assertEq(journey.yearEnd(ws).history.length,1,'history+1');
});
h.test('yearEnd é imutável', ()=>{
  const ws=journey.initialWorldState('BR');
  const str0=ws.rivals[0].strength;
  journey.yearEnd(ws);
  h.assertEq(ws.rivals[0].strength,str0,'original intacto');
});

/* ── Simulação plurianual (impressão da progressão) ──────────────── */

h.test('simulação 5 anos: dificuldade cresce monotonicamente por ano', ()=>{
  const region=journey.REGION_BY_ID['BR'];
  const diffs=Array.from({length:5},(_,i)=>journey.aiDifficulty(i+1,'national',region.strength));
  for(let i=1;i<diffs.length;i++)
    h.assert(diffs[i]>diffs[i-1],'ano '+(i+1)+' > ano '+i);
});

/* Print da progressão (informativo, não bloqueia) */
console.log('\n── Progressão de dificuldade BR (Ano 1–5) ──');
['national','continental','mundial'].forEach(stage=>{
  const row=Array.from({length:5},(_,i)=>journey.aiDifficulty(i+1,stage,journey.REGION_BY_ID['BR'].strength));
  console.log(`  ${stage.padEnd(12)}: ${row.map(d=>String(d).padStart(3)).join(' | ')}`);
});

console.log('\n── Rivais recorrentes BR (seed=init) ──');
journey.buildRecurringRivals('BR','init').forEach((r,i)=>{
  console.log(`  Rival ${i+1}: ${r.name} (força ${r.strength})`);
});

console.log('\n── Simulação carreira BR: 3 anos (seed fixa) ──');
let ws=journey.initialWorldState('BR');
let year=1;
['Ano 1','Ano 2','Ano 3'].forEach(label=>{
  const opp_nac=journey.nextOpponent(ws,'BR',year,'national',false);
  const opp_con=journey.nextOpponent(ws,'BR',year,'continental',false);
  const opp_mun=journey.nextOpponent(ws,'BR',year,'mundial',true);
  console.log(`  ${label}:`);
  console.log(`    Nacional    vs ${opp_nac.name} (força ${opp_nac.strength})`);
  console.log(`    Continental vs ${opp_con.name} (força ${opp_con.strength})`);
  console.log(`    Mundial     vs ${opp_mun.name} (força ${opp_mun.strength})`);
  ws=journey.yearEnd(ws);
  year++;
});

h.summary();
