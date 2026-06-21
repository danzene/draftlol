'use strict';
/* =======================================================================
   career/economy.js — duplicatas, fonte isolada de Fichas, e gacha.

   Duplicata:
     - abaixo do máx. de ★ → vira FRAGMENTO (acumula p/ subir estrela)
     - no máx. de ★        → convertida direto em FICHAS (valor por raridade)

   Fonte de Fichas ISOLADA: todo crédito de Fichas passa por addFichas(...)
   com um `source` rotulado. Adicionar um gacha pago no futuro é só registrar
   uma nova fonte ('purchase') — sem refazer o sistema. NADA de pagamento aqui.
   ======================================================================= */

const Career = (typeof globalThis!=='undefined'&&globalThis.Career)||{};
const cfg   = (typeof require!=='undefined') ? require('./config.js')   : Career.config;
const util  = (typeof require!=='undefined') ? require('./util.js')     : Career.util;
const rarity= (typeof require!=='undefined') ? require('./rarity.js')   : Career.rarity;

/* Fontes de Fichas reconhecidas. 'purchase' fica RESERVADA para o futuro
   gacha pago — não implementada agora, só documentada como o ponto de
   extensão. Acrescentá-la depois é uma linha aqui + uma chamada addFichas. */
const FICHA_SOURCES = {
  GAMEPLAY:    'gameplay',             // recompensas de partida/conquista de jogo
  ACHIEVEMENT: 'achievement',          // troféus de feito
  CONVERSION:  'duplicate_conversion', // duplicata no máx. de estrelas
  // PURCHASE:  'purchase'  ← futuro: compra real (NÃO implementar nesta fase)
};
const KNOWN_FICHA_SOURCES = new Set(Object.values(FICHA_SOURCES));

/* Único ponto de entrada de Fichas no sistema (camada isolada).
   Retorna novo saldo + a transação rotulada. Recusa fontes desconhecidas. */
function addFichas(balance, amount, source){
  if(!KNOWN_FICHA_SOURCES.has(source)) throw new Error('fonte de Fichas desconhecida: '+source);
  if(!(amount >= 0)) throw new Error('quantidade de Fichas inválida: '+amount);
  const novo = (balance || 0) + amount;
  return { balance: novo, tx: { amount, source } };
}

/* Aplica uma duplicata a um jogador possuído.
   owned = { rarity, stars, fragments }. Retorna o NOVO estado + `outcome`:
     - { type:'fragment', fragments, starsGained }  (subiu fragmento/estrela)
     - { type:'tokens', tokens, source }            (virou Fichas) */
function applyDuplicate(owned){
  const max = rarity.maxStars(owned.rarity);
  const stars = owned.stars || 1;

  if(stars >= max){
    const tokens = rarity.rarityInfo(owned.rarity).dupeTokenValue;
    return { rarity:owned.rarity, stars, fragments:(owned.fragments||0),
             outcome:{ type:'tokens', tokens, source:FICHA_SOURCES.CONVERSION } };
  }

  const cost = rarity.starFragmentCost(owned.rarity, stars); // p/ ir a stars+1
  let fragments = (owned.fragments || 0) + 1;
  let newStars = stars, starsGained = 0;
  if(fragments >= cost){ fragments -= cost; newStars = stars + 1; starsGained = 1; }
  return { rarity:owned.rarity, stars:newStars, fragments,
           outcome:{ type:'fragment', fragments, starsGained } };
}

/* Sorteia uma raridade pela tabela de pesos do gacha (rnd injetado). */
function rollRarity(rnd){
  const r = (typeof rnd === 'function') ? rnd : Math.random;
  const entries = rarity.RARITIES.map(k=>[k, cfg.rarities[k].gachaWeight]);
  const total = entries.reduce((a,[,w])=>a+w, 0);
  let x = r() * total;
  for(const [k,w] of entries){ x -= w; if(x < 0) return k; }
  return entries[entries.length-1][0];
}

/* Um pull do gacha: sorteia raridade e devolve um jogador dessa raridade
   do catálogo fornecido. Se a raridade não tiver ninguém, cai no catálogo todo. */
function pullPlayer(rnd, catalog){
  const r = (typeof rnd === 'function') ? rnd : Math.random;
  const rar = rollRarity(r);
  let pool = catalog.filter(p=>p.rarity === rar);
  if(!pool.length) pool = catalog;
  return util.pick(r, pool);
}

const __api={FICHA_SOURCES,KNOWN_FICHA_SOURCES,addFichas,applyDuplicate,rollRarity,pullPlayer};
if(typeof module!=='undefined'&&module.exports)module.exports=__api;
if(typeof globalThis!=='undefined'){(globalThis.Career=globalThis.Career||{}).economy=__api;}
