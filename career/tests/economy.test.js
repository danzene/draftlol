'use strict';
const cfg    = require('../config.js');
const util   = require('../util.js');
const rarity = require('../rarity.js');
const economy= require('../economy.js');
const players= require('../players.js');

module.exports = function(h){
  const { test, assert, assertEq, assertClose, assertBetween, assertThrows } = h;

  test('maxStars vem da config por raridade', ()=>{
    assertEq(rarity.maxStars('comum'), cfg.rarities.comum.starMax);
    assertEq(rarity.maxStars('lendario'), cfg.rarities.lendario.starMax);
  });

  test('attributeCeiling sobe com as estrelas', ()=>{
    const c1 = rarity.attributeCeiling('epico', 1);
    const c3 = rarity.attributeCeiling('epico', 3);
    assert(c3 > c1, 'teto não subiu com estrelas');
    assert(c3 <= cfg.attrHardCap, 'passou do hard cap');
  });

  test('duplicata abaixo do máx. vira fragmento', ()=>{
    const out = economy.applyDuplicate({ rarity:'raro', stars:1, fragments:0 });
    assertEq(out.outcome.type, 'fragment', 'deveria ser fragmento');
    assertEq(out.fragments, 1, 'deveria ter 1 fragmento');
    assertEq(out.stars, 1, 'ainda 1★ (custo > 1)');
  });

  test('fragmentos acumulados sobem uma estrela e zeram o resto', ()=>{
    const cost = rarity.starFragmentCost('raro', 1); // 1★→2★
    let owned = { rarity:'raro', stars:1, fragments:cost-1 };
    const out = economy.applyDuplicate(owned);
    assertEq(out.stars, 2, 'deveria subir p/ 2★');
    assertEq(out.outcome.starsGained, 1, 'ganhou 1 estrela');
    assertEq(out.fragments, 0, 'fragmentos deveriam zerar');
  });

  test('duplicata no máx. de estrelas vira Fichas (fonte=conversão)', ()=>{
    const max = rarity.maxStars('comum');
    const out = economy.applyDuplicate({ rarity:'comum', stars:max, fragments:0 });
    assertEq(out.outcome.type, 'tokens', 'deveria virar tokens');
    assertEq(out.outcome.tokens, cfg.rarities.comum.dupeTokenValue, 'valor por raridade');
    assertEq(out.outcome.source, economy.FICHA_SOURCES.CONVERSION, 'fonte = conversão');
  });

  test('addFichas aceita fonte conhecida e soma ao saldo', ()=>{
    const r = economy.addFichas(100, 40, economy.FICHA_SOURCES.GAMEPLAY);
    assertEq(r.balance, 140, 'saldo somado');
    assertEq(r.tx.source, 'gameplay', 'fonte registrada');
  });

  test('addFichas recusa fonte desconhecida (camada isolada)', ()=>{
    assertThrows(()=>economy.addFichas(0, 10, 'purchase'), 'purchase ainda não existe');
    assertThrows(()=>economy.addFichas(0, 10, 'qualquer'), 'fonte aleatória');
  });

  test('rollRarity sempre devolve uma raridade válida', ()=>{
    const rnd = util.seeded('g');
    for(let i=0;i<200;i++) assert(rarity.isValidRarity(economy.rollRarity(rnd)), 'raridade inválida');
  });

  test('rollRarity respeita aproximadamente os pesos', ()=>{
    const rnd = util.seeded('dist'); const N=20000; const count={};
    for(let i=0;i<N;i++){ const k=economy.rollRarity(rnd); count[k]=(count[k]||0)+1; }
    const total = rarity.RARITIES.reduce((a,k)=>a+cfg.rarities[k].gachaWeight,0);
    // comum domina; lendário é raro
    assert(count.comum/N > count.raro/N, 'comum deveria ser o mais comum');
    assert((count.lendario||0)/N < (count.epico||0)/N, 'lendário deveria ser o mais raro');
    const expComum = cfg.rarities.comum.gachaWeight/total;
    assertBetween(count.comum/N, expComum-0.05, expComum+0.05, 'frequência de comum');
  });

  test('pullPlayer devolve um jogador do catálogo da raridade sorteada', ()=>{
    const catalog = players.getCatalog();
    const rnd = util.seeded('pull');
    for(let i=0;i<100;i++){
      const p = economy.pullPlayer(rnd, catalog);
      assert(catalog.includes(p), 'jogador fora do catálogo');
    }
  });
};
