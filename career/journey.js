'use strict';
/* =======================================================================
   career/journey.js — engine da jornada plurianual (Fase 6).

   Responsabilidades:
   - Regiões reais do ecossistema LoL esports (🎚️ strength 0-100)
   - Ciclo anual: Nacional → Continental → Mundial → Entressafra → próximo ano
   - Rivais recorrentes: 3 times-IA que persistem entre anos e evoluem
   - Escalonamento de dificuldade por ano e etapa
   - Recompensas graduadas (PE + Fichas)
   - Virada de ano (rivais ficam mais fortes, ciclo reinicia)

   Sem dependência do DOM — testável em Node.
   Roster da IA: não é pré-gerado aqui. O seed do rival é passado para
   match.buildAiRoster em openCareerMatch (index.html), mantendo o módulo puro.
   ======================================================================= */

const Career = (typeof globalThis!=='undefined'&&globalThis.Career)||{};
const cfg  = (typeof require!=='undefined') ? require('./config.js') : Career.config;
const util = (typeof require!=='undefined') ? require('./util.js')   : Career.util;

/* ── Regiões do ecossistema LoL esports (🎚️) ──────────────────────────
   strength (0-100): força base dos adversários nacionais e contexto de prestígio.
   Quanto mais alta, mais difícil o ciclo nacional e maior o nível dos rivals gerados. */
const REGIONS = [
  {id:'KR',  label:'Coreia (LCK)',           continent:'asia',     strength:95},
  {id:'CN',  label:'China (LPL)',             continent:'asia',     strength:90},
  {id:'EU',  label:'Europa (LEC)',            continent:'emea',     strength:82},
  {id:'NA',  label:'América do Norte (LCS)', continent:'americas', strength:72},
  {id:'BR',  label:'Brasil (CBLOL)',          continent:'americas', strength:68},
  {id:'VN',  label:'Vietnã (VCS)',            continent:'asia',     strength:70},
  {id:'TR',  label:'Turquia (TCL)',           continent:'emea',     strength:62},
  {id:'LAS', label:'América Latina (LLA)',    continent:'americas', strength:60},
  {id:'OCE', label:'Oceania (LCO)',           continent:'pacific',  strength:55},
  {id:'MENA',label:'MENA',                    continent:'emea',     strength:58},
];

const REGION_BY_ID = Object.fromEntries(REGIONS.map(r=>[r.id,r]));

/* Regiões do mesmo continente (adversários da etapa continental) */
function continentRivals(myRegionId){
  const my = REGION_BY_ID[myRegionId];
  if(!my) return [];
  return REGIONS.filter(r=>r.continent===my.continent&&r.id!==myRegionId);
}

/* ── Escalonamento de dificuldade por ano e etapa (🎚️) ──────────────
   Ano 1 Nacional  BR  → 68  (força base da região)
   Ano 1 Cont.     BR  → 76  (68 + bump 8)
   Ano 1 Mundial   BR  → 84  (68 + bump 16)
   Ano 2 Nacional  BR  → 71  (68 + scaling 3)
   Ano 5 Mundial   BR  → 96  (68 + 4×3 + 16 = 96 → clampeia em 98)          */
const YEAR_SCALING = 3;                                            // 🎚️ pts/ano
const STAGE_BUMP = {national:0, continental:8, mundial:16};       // 🎚️

function aiDifficulty(year, stage, baseRegionStrength){
  const yearBonus = (year - 1) * YEAR_SCALING;
  const bump = STAGE_BUMP[stage] || 0;
  return util.clamp(baseRegionStrength + yearBonus + bump, 10, 98);
}

/* ── Pool de nomes de times rivais ──────────────────────────────── */
const TEAM_NAMES = [
  'Storm Wolves','Iron Nexus','Neon Tide','Crimson Blaze','Azure Guard',
  'Shadow Crown','Void Seekers','Rune Hunters','Thunder Peak','Ghost Protocol',
  'Solar Rift','Midnight Stars','Echo Squad','Prime Force','Apex Drive',
  'Digital Cats','Circuit Kings','Frozen Core','Dark Matter','Pixel Elite',
  'Phoenix Wing','Crystal Fang','Omega Force','Zero Hour','Warp Factor',
  'Steel Echo','Binary Star','Hollow Throne','Ember Knights','Nova Protocol',
];

/* Gera um rival determinístico (nome + força) a partir de uma seed.
   O roster da IA NÃO é construído aqui — `rival.seed` é passado para
   match.buildAiRoster em openCareerMatch, mantendo a engine pura. */
function buildJourneyRival(seed, strength){
  const rng = util.seeded('rival-name|'+seed);
  const name = TEAM_NAMES[Math.floor(rng() * TEAM_NAMES.length)];
  const actualStrength = Math.round(util.clamp(strength + (rng()-0.5)*16, 10, 98));
  return {
    id:         'rival|'+seed,
    name,
    strength:   actualStrength,
    seed:       'roster|'+seed,   // usado por match.buildAiRoster em index.html
    winsVsMe:   0,
    lossesVsMe: 0,
  };
}

/* 3 rivais recorrentes: persistem entre anos e evoluem junto com o treinador. */
function buildRecurringRivals(regionId, extraSeed){
  const my = REGION_BY_ID[regionId]||{strength:60};
  return Array.from({length:3},(_,i)=>{
    const seed = 'rec|'+regionId+'|'+extraSeed+'|'+i;
    const rivalStrength = util.clamp(my.strength + (util.seeded(seed)()*20-10), 10, 98);
    return buildJourneyRival(seed, rivalStrength);
  });
}

/* ── Estado inicial do mundo (início da carreira) ───────────────── */
function initialWorldState(regionId){
  return {
    stage:       'national',
    trophies:    {national:0, continental:0, mundial:0},
    national:    {completed:false, won:false, qualified:false},
    continental: {completed:false, won:false, qualified:false},
    mundial:     {completed:false, won:false},
    rivals:      buildRecurringRivals(regionId, 'init'),
    history:     [],
  };
}

/* Adversário da próxima partida de jornada.
   isChef=true → chefe final da etapa (mais forte + bônus 🎚️). */
function nextOpponent(worldState, regionId, year, stage, isChef){
  const region  = REGION_BY_ID[regionId]||{strength:60};
  const baseDiff = aiDifficulty(year, stage, region.strength);
  if(isChef){
    const seed = 'chef|'+regionId+'|'+year+'|'+stage;
    return buildJourneyRival(seed, util.clamp(baseDiff+12, 10, 98)); // 🎚️ chefe +12
  }
  const rivals = worldState.rivals||[];
  const stageIdx = {national:0, continental:1, mundial:2}[stage]||0;
  if(rivals[stageIdx]) return rivals[stageIdx];
  const seed = 'opp|'+regionId+'|'+year+'|'+stage;
  return buildJourneyRival(seed, baseDiff);
}

/* ── Recompensas por etapa (🎚️) ─────────────────────────────────── */
const STAGE_REWARDS = {
  national:    {pe:200,  fichas:50,  peWin:100, fichasWin:30 },
  continental: {pe:350,  fichas:100, peWin:150, fichasWin:60 },
  mundial:     {pe:600,  fichas:200, peWin:400, fichasWin:200},
};

function stageRewards(stage, won){
  const r = STAGE_REWARDS[stage]||STAGE_REWARDS.national;
  return {pe: r.pe + (won?r.peWin:0), fichas: r.fichas + (won?r.fichasWin:0)};
}

/* Avança o estágio após a partida decisiva. Retorna novo world_state (imutável). */
function advanceStage(worldState, stage, won){
  const ws = JSON.parse(JSON.stringify(worldState));
  ws[stage] = {...(ws[stage]||{}), completed:true, won};
  if(stage==='national'){
    ws.national.qualified = true;  // protagonista sempre classifica
    ws.stage = 'continental';
  }else if(stage==='continental'){
    ws.continental.qualified = won;
    ws.stage = won ? 'mundial' : 'offseason';
  }else if(stage==='mundial'){
    if(won) ws.trophies.mundial = (ws.trophies.mundial||0)+1;
    ws.stage = 'offseason';
  }
  return ws;
}

/* Virada de ano: contabiliza trofeus, evolui rivais, reseta o ciclo anual. */
function yearEnd(worldState){
  const ws = JSON.parse(JSON.stringify(worldState));
  if(ws.national&&ws.national.won)   ws.trophies.national   = (ws.trophies.national||0)+1;
  if(ws.continental&&ws.continental.won) ws.trophies.continental = (ws.trophies.continental||0)+1;
  ws.history = [...(ws.history||[]), {national:ws.national, continental:ws.continental, mundial:ws.mundial}];
  ws.stage = 'national';
  ws.national    = {completed:false, won:false, qualified:false};
  ws.continental = {completed:false, won:false, qualified:false};
  ws.mundial     = {completed:false, won:false};
  ws.rivals = (ws.rivals||[]).map(r=>({...r, strength:util.clamp(r.strength+YEAR_SCALING,10,98)}));
  return ws;
}

const __api = {
  REGIONS, REGION_BY_ID, continentRivals,
  YEAR_SCALING, STAGE_BUMP, STAGE_REWARDS,
  aiDifficulty, buildJourneyRival, buildRecurringRivals,
  initialWorldState, nextOpponent, stageRewards, advanceStage, yearEnd,
};
if(typeof module!=='undefined'&&module.exports) module.exports=__api;
if(typeof globalThis!=='undefined'){(globalThis.Career=globalThis.Career||{}).journey=__api;}
