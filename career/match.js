'use strict';
/* =======================================================================
   career/match.js — engine pura para partidas de carreira (Fase 4).

   Responsabilidades:
   - Construir o elenco da IA (5 jogadores do catálogo, um por rota)
   - Heurística de ban/pick da IA (simples, 🎚️ ajustável)
   - Calcular recompensas ao fim da partida (PE do treinador + XP dos jogadores)
   - Converter probabilidade de vitória em powerBias para inclinar genTimeline

   Sem dependência do DOM — testável em Node.
   ======================================================================= */

const Career = (typeof globalThis!=='undefined'&&globalThis.Career)||{};
const cfg  = (typeof require!=='undefined') ? require('./config.js') : Career.config;
const util = (typeof require!=='undefined') ? require('./util.js')   : Career.util;

const ROLES = ['top','jungle','mid','adc','support'];

/* Dificuldade padrão da IA (0–100). 🎚️
   Fase 5 irá escalar este valor com o nível da liga atual do treinador. */
const AI_DIFFICULTY_DEFAULT = 50;

/* ── Constrói o elenco da IA: um jogador por rota do catálogo.
   difficulty 0–100:
     0  → seleciona só do 30% mais fraco por rota (quase sempre Comum)
     50 → 65% do pool (medianos/bons)
     100 → 100% — pode ser qualquer jogador, mas tende ao topo
   rng: função de aleatoriedade injetada (determinística quando semeada). */
function buildAiRoster(difficulty, rng){
  const r = typeof rng==='function' ? rng : Math.random;
  const catalog = Career.players.getCatalog();
  return ROLES.map(role=>{
    const pool = catalog.filter(p=>p.role===role);
    if(!pool.length) return catalog[0];
    const scored = pool.map(p=>({
      p,
      score: util.mean(Object.values(p.attrs)) + (r()-0.5)*8 // ruído pequeno
    })).sort((a,b)=>b.score-a.score);
    // Fração selecionável: dificuldade 50 → top 65%; 100 → 100%; 0 → top 30%
    const topN = Math.max(1, Math.ceil(pool.length*(0.30 + difficulty/100*0.70)));
    return scored[Math.floor(r()*topN)].p;
  });
}

/* ── Heurística de ban da IA. 🎚️
   Estratégia: bane o campeão de maior força média disponível,
   com ruído pequeno (~±10 pontos) para não ser 100% determinístico.
   champPool : array de {id, avgPower, ...} (força 0–100, calculada no adaptador do index.html)
   allBanned : Set<string> com ids já banidos */
function aiSelectBan(champPool, allBanned, rng){
  const r = typeof rng==='function' ? rng : Math.random;
  const avail = champPool.filter(c=>!allBanned.has(c.id));
  if(!avail.length) return null;
  const scored = avail.map(c=>({c, score:(c.avgPower||50)+(r()-0.5)*10}))
    .sort((a,b)=>b.score-a.score);
  return scored[0].c;
}

/* ── Heurística de pick da IA por rota. 🎚️
   Estratégia: maximiza o pickPower do jogador da IA para essa rota,
   com ruído pequeno (~±8 pontos) para não ser perfeito.
   champPool : [{champ, avgPickPower}, ...]  — pickPower calculado no index.html */
function aiSelectPick(champPool, rng){
  const r = typeof rng==='function' ? rng : Math.random;
  if(!champPool.length) return null;
  const scored = champPool.map(c=>({
    c: c.champ,
    score: (c.avgPickPower||0) + (r()-0.5)*8
  })).sort((a,b)=>b.score-a.score);
  return scored[0].c;
}

/* ── Recompensas ao fim da partida.
   rosterRows : linhas de career_roster dos jogadores que estiveram em campo.
   won        : boolean — treinador venceu?
   Retorna os deltas para serem gravados no Supabase pelo caller (index.html).
   TODO (Fase 6): ajustar PE por performance individual ao implementar talent tree. */
function matchRewards(rosterRows, won){
  const pe = cfg.economy.pePerMatch + (won ? cfg.economy.peWinBonus : 0);
  const playerUpdates = (rosterRows||[]).filter(Boolean).map(row=>({
    player_id: row.player_id,
    newXp:    (row.xp||0) + pe,
    newLevel: playerXpToLevel((row.xp||0) + pe),
  }));
  return { peGained: pe, trainerPe: pe, playerUpdates };
}

/* Fórmula de nível por XP acumulado (🎚️ — 1 nível a cada 200 XP).
   TODO (Fase 6): substituir por curva de custo crescente quando talent tree vier. */
function playerXpToLevel(xp){
  return Math.max(1, 1+Math.floor((xp||0)/200));
}

/* ── Converte probabilidade de vitória da engine de carreira em um bias
   logístico para genTimeline, inclinando a simulação visual sem substituí-la.

   genTimeline tem sua própria logística baseada nos stats dos campeões.
   Este bias empurra o resultado na direção correta pelo PODER DO ELENCO:
     careerWinProb=0.50 → bias=0.00 (neutra — apenas stats do campeão decidem)
     careerWinProb=0.70 → bias≈+0.30 (leve vantagem sistemática)
     careerWinProb=0.85 → bias≈+0.66 (vantagem clara — equipes muito desiguais)

   scaleFactor (🎚️ 0.35): o elenco contribui ~35% do logit total;
   o restante vem das stats dos campeões e do lead acumulado durante a partida.
   Quando powerBias=0 (modo casual / fallback), genTimeline fica idêntico ao original. */
function careerPowerBias(careerWinProb, scaleFactor){
  const p = util.clamp(careerWinProb||0.5, 0.01, 0.99);
  const s = scaleFactor!=null ? scaleFactor : 0.35; // 🎚️
  return Math.log(p/(1-p)) * s;
}

const __api = {
  ROLES, AI_DIFFICULTY_DEFAULT,
  buildAiRoster, aiSelectBan, aiSelectPick,
  matchRewards, playerXpToLevel, careerPowerBias,
};
if(typeof module!=='undefined'&&module.exports) module.exports=__api;
if(typeof globalThis!=='undefined'){(globalThis.Career=globalThis.Career||{}).match=__api;}
