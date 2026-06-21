'use strict';
/* =======================================================================
   career/players.js — catálogo (pokédex) de jogadores fictícios + builder.

   Cada jogador é uma ENTRADA DE DADOS FIXA: nome (semente), rota e raridade.
   Os atributos-base e as afinidades são DERIVADOS deterministicamente da
   semente do nome — mesmo nome → sempre o mesmo jogador. Isso mantém o
   arquivo enxuto e garante invariantes de balanceamento testáveis, sem
   precisar autorar 72 × 13 números à mão.

   Nomes são handles ORIGINAIS (pessoas fictícias). Não são campeões nem
   jogadores profissionais reais.
   ======================================================================= */

const Career = (typeof globalThis!=='undefined'&&globalThis.Career)||{};
const cfg   = (typeof require!=='undefined') ? require('./config.js')     : Career.config;
const util  = (typeof require!=='undefined') ? require('./util.js')       : Career.util;
const arche = (typeof require!=='undefined') ? require('./archetypes.js') : Career.archetypes;
const rarity= (typeof require!=='undefined') ? require('./rarity.js')     : Career.rarity;

/* Definições: [nome, rota, raridade]. 72 jogadores.
   Distribuição: 6 lendários, 14 épicos, 24 raros, 28 comuns. */
const PLAYER_DEFS = [
  // ── Lendários (6) ─────────────────────────────────────────────
  ['OmenKing','top','lendario'], ['NightfallPrime','jungle','lendario'],
  ['AurumWolf','mid','lendario'], ['VoidStrider','adc','lendario'],
  ['SaintViper','support','lendario'], ['KaiserNeo','top','lendario'],

  // ── Épicos (14) ───────────────────────────────────────────────
  ['EmberlineX','jungle','epico'], ['FrostgaleR','mid','epico'],
  ['NovaPilot','adc','epico'], ['HexParadox','support','epico'],
  ['IronLantern','top','epico'], ['CrowMancer','jungle','epico'],
  ['SableHunt','mid','epico'], ['PrismGhost','adc','epico'],
  ['DuskWarden','support','epico'], ['RiftSurge','top','epico'],
  ['GoldenCrane','jungle','epico'], ['StormCaller','mid','epico'],
  ['NeonReaper','adc','epico'], ['BlackOpal','support','epico'],

  // ── Raros (24) ────────────────────────────────────────────────
  ['QuickQuill','top','raro'], ['JadeCircuit','jungle','raro'],
  ['PaleComet','mid','raro'], ['RustRonin','adc','raro'],
  ['CinderJay','support','raro'], ['MapleHawk','top','raro'],
  ['SilentCove','jungle','raro'], ['BronzeFinch','mid','raro'],
  ['VioletDune','adc','raro'], ['GraySparrow','support','raro'],
  ['CobaltMoth','top','raro'], ['TidalRook','jungle','raro'],
  ['FernHollow','mid','raro'], ['AmberLynx','adc','raro'],
  ['SlateRiver','support','raro'], ['PennyDreadful','top','raro'],
  ['HollowReed','jungle','raro'], ['DriftPine','mid','raro'],
  ['CopperWren','adc','raro'], ['MossKnight','support','raro'],
  ['FlintArrow','top','raro'], ['IndigoLark','jungle','raro'],
  ['BriarFox','mid','raro'], ['ChalkLion','adc','raro'],

  // ── Comuns (28) ───────────────────────────────────────────────
  ['PebbleByte','support','comum'], ['Sproutling','top','comum'],
  ['TinSoldier','jungle','comum'], ['DustyBoot','mid','comum'],
  ['CloverKid','adc','comum'], ['ReedWhistle','support','comum'],
  ['Patchwork','top','comum'], ['ScoutMk2','jungle','comum'],
  ['NimbusLite','mid','comum'], ['BreezyDan','adc','comum'],
  ['PipSqueak','support','comum'], ['DotMatrix','top','comum'],
  ['MossyRock','jungle','comum'], ['TwigSnap','mid','comum'],
  ['CrumbCake','adc','comum'], ['NoodleArm','support','comum'],
  ['PixelPup','top','comum'], ['BoltBuddy','jungle','comum'],
  ['ChipMunk','mid','comum'], ['SparkPlug','adc','comum'],
  ['Cracklewick','support','comum'], ['GizmoToad','top','comum'],
  ['PennyLoafer','jungle','comum'], ['SodaPopper','mid','comum'],
  ['MuddyPaws','adc','comum'], ['BumbleBryn','support','comum'],
  ['JellyJab','top','comum'], ['RookieRae','jungle','comum'],
];

/* Constrói o jogador completo a partir da definição (determinístico). */
function buildPlayer(def){
  const [name, role, rar] = Array.isArray(def) ? def : [def.name, def.role, def.rarity];
  if(!arche.ROLES.includes(role)) throw new Error('rota inválida em '+name+': '+role);
  if(!rarity.isValidRarity(rar))  throw new Error('raridade inválida em '+name+': '+rar);

  const rnd  = util.seeded('player|'+name);
  const info = rarity.rarityInfo(rar);
  const ceil1 = rarity.attributeCeiling(rar, 1); // teto no 1★
  const sig  = arche.ROLE_SIGNATURE[role] || [];

  // Atributos-base (ordem fixa de consumo do rnd → determinístico)
  const attrs = {};
  arche.ATTR_KEYS.forEach(k=>{
    let v = info.attrFloor + rnd() * (info.attrCeil - info.attrFloor);
    if(sig.includes(k)) v += cfg.power.roleSignatureBonus;
    attrs[k] = Math.round(util.clamp(v, 0, ceil1));
  });

  // Afinidades por arquétipo (multiplicador ~0.6–1.4 com viés de rota)
  const bias = arche.ROLE_ARCH_BIAS[role] || {};
  const affinities = {};
  arche.ARCHETYPES.forEach(a=>{
    const b = bias[a] || 0;
    const m = 1.0 + b + (rnd() - 0.5) * cfg.power.affinityJitter;
    affinities[a] = util.round2(util.clamp(m, cfg.power.affinityFloor, cfg.power.affinityCeil));
  });

  return {
    id: util.slug(name),
    name, role, rarity: rar,
    stars: 1,
    attrs, affinities,
    portraitSeed: util.hashStr(name), // semente p/ retrato estilizado (fase futura)
  };
}

let _catalog = null;
/* Catálogo completo (cacheado). Cada chamada retorna a MESMA lista. */
function getCatalog(){
  if(!_catalog) _catalog = PLAYER_DEFS.map(buildPlayer);
  return _catalog;
}
function getPlayerById(id){ return getCatalog().find(p=>p.id===id) || null; }

const __api={PLAYER_DEFS,buildPlayer,getCatalog,getPlayerById};
if(typeof module!=='undefined'&&module.exports)module.exports=__api;
if(typeof globalThis!=='undefined'){(globalThis.Career=globalThis.Career||{}).players=__api;}
