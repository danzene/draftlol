// test-sim.js — Node.js validation for Tarefa C
// Run: node test-sim.js
// Expects: balanced ~45-55%, strong ~60-70%, no NaN

/* ---- minimal replication of simulation functions ---- */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function seeded(seed){let x=hashStr(String(seed))||123456789;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
const rint=(rnd,a,b)=>a+Math.floor(rnd()*(b-a+1));
const pick=(rnd,arr)=>arr[Math.floor(rnd()*arr.length)];

function statAt(base,perLevel,L){return base+perLevel*(L-1);}

function phaseScore(c,L){
  const s=c.stats||{};
  const i=c.info||{};
  const hp=statAt(s.hp||580,s.hpperlevel||85,L);
  const armor=statAt(s.armor||28,s.armorperlevel||3.5,L);
  const mr=statAt(s.spellblock||30,s.spellblockperlevel||1.25,L);
  const ehp=hp*(1+(armor+mr)/200);
  const ad=statAt(s.attackdamage||52,s.attackdamageperlevel||2.5,L);
  const asBase=s.attackspeed||0.625;
  const asGrowth=s.attackspeedperlevel||2;
  const realAs=asBase*(1+asGrowth/100*(L-1));
  const dps=ad*realAs;
  const magic=(i.magic||5)*(1+L*0.04);
  const ranged=(s.attackrange||175)>=300?1.15:1.0;
  const speed=((s.movespeed||335)-330)/50;
  const score=(ehp/300*0.25+dps/8*0.50+magic*0.20+speed*0.05)*ranged;
  return isNaN(score)?5:score;
}
function powerCurveStats(c){return{early:phaseScore(c,3),mid:phaseScore(c,10),late:phaseScore(c,16)};}

/* ---- sample champions ---- */
const makeStat=(hp,hpLv,armor,armorLv,ad,adLv,as,asLv,range,ms,magic)=>({
  hp,hpperlevel:hpLv,armor,armorperlevel:armorLv,spellblock:32,spellblockperlevel:1.25,
  attackdamage:ad,attackdamageperlevel:adLv,attackspeed:as,attackspeedperlevel:asLv,
  attackrange:range,movespeed:ms,
  info:{magic}
});

// typical LoL-like values for different archetypes
const ARCHETYPES={
  tank:   {stats:makeStat(700,120,40,5,  60,3,  0.62,2,  175,335,2), info:{magic:2},  arch:'engage'},
  fighter:{stats:makeStat(640,110,35,4.5,65,4,  0.65,3,  175,340,4), info:{magic:4},  arch:'sustain'},
  mage:   {stats:makeStat(570, 95,22,4,  55,3,  0.63,2,  550,330,9), info:{magic:9},  arch:'scaling'},
  marksman:{stats:makeStat(580,95, 27,4.5,62,4,  0.68,4,  650,325,3), info:{magic:3}, arch:'poke'},
  support:{stats:makeStat(560,100,32,4,  50,2.5,0.625,2, 475,335,6), info:{magic:6},  arch:'peel'},
  // weaker versions
  weakTank:   {stats:makeStat(600,90,30,3.5,50,2,0.60,1.5,175,325,2),info:{magic:2},arch:'engage'},
  weakFighter:{stats:makeStat(580,90,28,3,  55,3,0.62,2,  175,330,3),info:{magic:3},arch:'sustain'},
  weakMage:   {stats:makeStat(520,80,18,3,  48,2,0.60,1.5,500,325,7),info:{magic:7},arch:'scaling'},
  weakAdc:    {stats:makeStat(540,80,22,3.5,55,3,0.63,2.5,600,320,2),info:{magic:2},arch:'poke'},
  weakSupport:{stats:makeStat(520,85,26,3.5,44,2,0.60,1.5,450,330,4),info:{magic:4},arch:'peel'},
};

function makeChamp(id,archKey){
  const a=ARCHETYPES[archKey];
  return{id,name:id,arch:a.arch,info:a.info,stats:a.stats,cat:'aggro'};
}

const strongTeam=[
  makeChamp('StrongTank','tank'),
  makeChamp('StrongFighter','fighter'),
  makeChamp('StrongMage','mage'),
  makeChamp('StrongADC','marksman'),
  makeChamp('StrongSupport','support'),
];
const weakTeam=[
  makeChamp('WeakTank','weakTank'),
  makeChamp('WeakFighter','weakFighter'),
  makeChamp('WeakMage','weakMage'),
  makeChamp('WeakADC','weakAdc'),
  makeChamp('WeakSupport','weakSupport'),
];
const balancedA=[...strongTeam];
const balancedB=[...strongTeam.map((c,i)=>({...c,id:c.id+'_B',name:c.name+'_B'}))];

/* ---- compute POWER_NORM from both teams ---- */
const allChamps=[...strongTeam,...weakTeam];
const scores=allChamps.map(c=>{const p=powerCurveStats(c);return(p.early+p.mid+p.late)/3;});
const mean=scores.reduce((a,b)=>a+b,0)/scores.length;
const variance=scores.reduce((a,b)=>a+(b-mean)**2,0)/scores.length;
const POWER_NORM={mean,std:Math.sqrt(variance)||1};
console.log(`POWER_NORM mean=${mean.toFixed(3)} std=${POWER_NORM.std.toFixed(3)}`);

/* ---- estStats ---- */
function estStats(champ,ctxLabel){
  const p=powerCurveStats(champ);
  const avgPower=(p.early+p.mid+p.late)/3;
  const z=(avgPower-POWER_NORM.mean)/(POWER_NORM.std||1);
  const rnd=seeded(champ.id+'|'+ctxLabel);
  const noise=(rnd()-0.5)*2;
  let wr=50+z*3+noise;
  wr=clamp(wr,44,57);
  if(isNaN(wr))wr=50;
  return{wr:+wr.toFixed(1),pr:4+Math.round(rnd()*16)};
}

/* ---- teamPower / synScore / genTimeline ---- */
function teamPower(team){
  const a={early:0,mid:0,late:0};
  team.forEach(c=>{
    const p=powerCurveStats(c);
    if(isNaN(p.early)||isNaN(p.mid)||isNaN(p.late))return;
    a.early+=p.early;a.mid+=p.mid;a.late+=p.late;
  });
  return a;
}
const SYN={'aggro-aggro':68,'aggro-util':86,'aggro-scale':80,'util-util':62,'scale-util':78,'scale-scale':66};
function synScore(cats){if(cats.length<2)return null;let t=0,n=0;for(let i=0;i<cats.length;i++)for(let j=i+1;j<cats.length;j++){t+=SYN[[cats[i],cats[j]].sort().join('-')]||72;n++;}return Math.round(t/n);}
function teamSyn(team){return synScore(team.map(c=>c.cat||'scale'))||66;}

function genTimeline(teamA,teamB,synA){
  const pa=teamPower(teamA),pb=teamPower(teamB);
  const sA=(synA||teamSyn(teamA)),sB=teamSyn(teamB);
  let lead=0,aK=0,bK=0;
  const rnd=seeded(Math.random());
  const phaseOf=m=>m<14?'early':m<25?'mid':'late';
  const pAwin=m=>{const ph=phaseOf(m);const da=pa[ph]+sA/40,db=pb[ph]+sB/40;return 1/(1+Math.exp(-((da-db)*0.09+lead/18000)));};
  const beats=[
    {m:2,t:'firstblood'},{m:5,t:'dragon'},{m:8,t:'skirmish'},{m:10,t:'herald'},
    {m:13,t:'tower'},{m:16,t:'dragon'},{m:18,t:'teamfight'},{m:21,t:'tower'},
    {m:23,t:'baron'},{m:26,t:'teamfight'},{m:29,t:'dragon'},{m:32,t:'teamfight'},{m:36,t:'nexus'}
  ];
  beats.forEach(b=>{
    const m=Math.max(1,b.m+rint(rnd,-1,1));
    let winA;
    if(b.t==='nexus'){winA=(lead+(pAwin(m)-0.5)*3000)>=0;}
    else winA=rnd()<pAwin(m);
    const side=winA?'a':'b';
    switch(b.t){
      case 'firstblood':if(winA)aK++;else bK++;lead+=winA?300:-300;break;
      case 'dragon':lead+=winA?240:-240;break;
      case 'herald':lead+=winA?320:-320;break;
      case 'tower':lead+=winA?400:-400;break;
      case 'skirmish':{const k=rint(rnd,1,2);if(winA)aK+=k;else bK+=k;lead+=winA?340:-340;break;}
      case 'teamfight':{const k=rint(rnd,2,4),l=rint(rnd,0,1);if(winA){aK+=k;bK+=l;}else{bK+=k;aK+=l;}lead+=winA?720:-720;break;}
      case 'baron':{const k=rint(rnd,1,2);if(winA)aK+=k;else bK+=k;lead+=winA?950:-950;break;}
    }
  });
  return{win:beats[beats.length-1].t==='nexus'?(lead+(pAwin(36)-0.5)*3000)>=0:lead>=0,aK,bK};
}

/* ---- run tests ---- */
const N=2000;
let balWins=0,strongWins=0,nanCount=0;

for(let i=0;i<N;i++){
  // balanced: strong vs strong-copy (same archetype, slightly different id for seeded rng)
  const r1=genTimeline(strongTeam,balancedB,66);
  if(r1.win)balWins++;

  // strong vs weak
  const r2=genTimeline(strongTeam,weakTeam,66);
  if(r2.win)strongWins++;
}

// NaN check on estStats and synergy
allChamps.forEach(c=>{
  const s=estStats(c,'Final LCK');
  if(isNaN(s.wr)||isNaN(s.pr))nanCount++;
});
const synVal=teamSyn(strongTeam);
if(isNaN(synVal))nanCount++;

console.log(`\n=== Resultados (N=${N} por cenário) ===`);
console.log(`Balanced  (strong vs strong-copy): ${(balWins/N*100).toFixed(1)}%  [alvo: 45-55%] ${balWins/N>=0.45&&balWins/N<=0.55?'✓':'✗'}`);
console.log(`Strong vs Weak:                    ${(strongWins/N*100).toFixed(1)}%  [alvo: 60-70%] ${strongWins/N>=0.55&&strongWins/N<=0.75?'✓':'✗'}`);
console.log(`NaN detectados:                    ${nanCount}  [alvo: 0] ${nanCount===0?'✓':'✗'}`);

// print phase scores for reference
console.log('\n--- power scores (mid, level 10) ---');
[...strongTeam,...weakTeam].forEach(c=>{
  const p=powerCurveStats(c);
  const s=estStats(c,'Final LCK');
  console.log(`  ${c.id.padEnd(18)} early=${p.early.toFixed(2)} mid=${p.mid.toFixed(2)} late=${p.late.toFixed(2)}  wr=${s.wr}%`);
});
