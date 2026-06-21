'use strict';
/* =======================================================================
   career/power.js — poder do pick e poder do time.

   poderPickFase = (wPrimary·attrPrincipalDaRota[fase] + wOthers·média(outros)
                    + wChampion·forçaCampeão[fase]) · afinidade(arquétipo)

   Retorna uma curva {early,mid,late} por pick — casa direto com o modelo
   de fases do genTimeline. A "fonte de poder" da simulação passa a ser o
   elenco (jogador + campeão), em vez dos stats crus do campeão.
   ======================================================================= */

const Career = (typeof globalThis!=='undefined'&&globalThis.Career)||{};
const cfg   = (typeof require!=='undefined') ? require('./config.js')     : Career.config;
const util  = (typeof require!=='undefined') ? require('./util.js')       : Career.util;
const arche = (typeof require!=='undefined') ? require('./archetypes.js') : Career.archetypes;

/* Força do campeão (0–100) numa fase. Aceita:
   - número      → mesma força em todas as fases
   - {early,mid,late} → força por fase (avg como fallback)
   - ausente     → cfg.power.defaultChampion */
function championPhaseStrength(champion, phase){
  const p = champion && champion.power;
  if(p == null) return cfg.power.defaultChampion;
  if(typeof p === 'number') return util.clamp(p, 0, 100);
  const v = (p[phase] != null) ? p[phase] : (p.avg != null ? p.avg : cfg.power.defaultChampion);
  return util.clamp(v, 0, 100);
}

/* Multiplicador de afinidade do jogador para o arquétipo do campeão. */
function affinityMultiplier(player, arch){
  const a = player && player.affinities ? player.affinities[arch] : null;
  const m = (a == null) ? 1.0 : a;
  return util.clamp(m, cfg.power.affinityFloor, cfg.power.affinityCeil);
}

/* Poder de um pick numa fase específica. */
function poderPickFase(player, champion, phase){
  const role = player.role;
  const primKey = (arche.ROLE_PHASE_PRIMARY[role] || {})[phase] || 'mecanica';
  const primary = player.attrs[primKey] || 0;
  const others = util.mean(
    arche.ATTR_KEYS.filter(k=>k!==primKey).map(k=>player.attrs[k] || 0)
  );
  const champ = championPhaseStrength(champion, phase);
  const aff   = affinityMultiplier(player, champion ? champion.arch : null);
  const base  = cfg.power.wPrimary*primary + cfg.power.wOthers*others + cfg.power.wChampion*champ;
  return base * aff;
}

/* Poder de um pick nas três fases + média. */
function poderPick(player, champion){
  const early = poderPickFase(player, champion, 'early');
  const mid   = poderPickFase(player, champion, 'mid');
  const late  = poderPickFase(player, champion, 'late');
  return { early, mid, late, avg:(early+mid+late)/3 };
}

/* Poder do time: soma dos 5 picks por fase + compostura média do elenco.
   picks = [{player, champion}, ...]. Bônus de sinergia/counter (que já
   existem no index.html) entram depois, na integração — aqui fica a base. */
function poderTime(picks){
  const acc = { early:0, mid:0, late:0 };
  const per = [];
  picks.forEach(({player, champion})=>{
    const pp = poderPick(player, champion);
    acc.early += pp.early; acc.mid += pp.mid; acc.late += pp.late;
    per.push(pp);
  });
  const composure = util.mean(picks.map(p=>p.player.attrs.compostura || 0));
  return { early:acc.early, mid:acc.mid, late:acc.late,
           avg:(acc.early+acc.mid+acc.late)/3, composure, picks:per };
}

const __api={championPhaseStrength,affinityMultiplier,poderPickFase,poderPick,poderTime};
if(typeof module!=='undefined'&&module.exports)module.exports=__api;
if(typeof globalThis!=='undefined'){(globalThis.Career=globalThis.Career||{}).power=__api;}
