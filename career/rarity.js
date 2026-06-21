'use strict';
/* =======================================================================
   career/rarity.js — raridades, estrelas e tetos de atributo.
   ======================================================================= */

const Career = (typeof globalThis!=='undefined'&&globalThis.Career)||{};
const cfg  = (typeof require!=='undefined') ? require('./config.js') : Career.config;
const util = (typeof require!=='undefined') ? require('./util.js')   : Career.util;

const RARITIES = Object.keys(cfg.rarities); // ['comum','raro','epico','lendario']

function isValidRarity(r){ return Object.prototype.hasOwnProperty.call(cfg.rarities, r); }

function rarityInfo(r){
  if(!isValidRarity(r)) throw new Error('raridade inválida: '+r);
  return cfg.rarities[r];
}

/* teto de estrelas da raridade */
function maxStars(r){ return rarityInfo(r).starMax; }

/* teto de cada atributo dada a raridade e a estrela atual.
   1★ = attrCeil; cada estrela acima soma starCeilBonus, limitado ao hard cap. */
function attributeCeiling(r, stars){
  const info = rarityInfo(r);
  const s = util.clamp(stars, 1, info.starMax);
  return Math.min(cfg.attrHardCap, info.attrCeil + (s - 1) * cfg.starCeilBonus);
}

/* fragmentos necessários para ir de `stars` para `stars+1`.
   null quando já está no máximo (não há próxima estrela). */
function starFragmentCost(r, stars){
  const info = rarityInfo(r);
  if(stars >= info.starMax) return null;
  return cfg.starFragmentCost[stars - 1];
}

const __api={RARITIES,isValidRarity,rarityInfo,maxStars,attributeCeiling,starFragmentCost};
if(typeof module!=='undefined'&&module.exports)module.exports=__api;
if(typeof globalThis!=='undefined'){(globalThis.Career=globalThis.Career||{}).rarity=__api;}
