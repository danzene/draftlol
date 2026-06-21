'use strict';
const cfg    = require('../config.js');
const arche  = require('../archetypes.js');
const rarity = require('../rarity.js');
const players= require('../players.js');

module.exports = function(h){
  const { test, assert, assertEq, assertBetween } = h;
  const catalog = players.getCatalog();

  test('catálogo tem entre 60 e 80 jogadores', ()=>{
    assertBetween(catalog.length, 60, 80, 'tamanho do catálogo');
  });

  test('ids são únicos', ()=>{
    const ids = new Set(catalog.map(p=>p.id));
    assertEq(ids.size, catalog.length, 'ids duplicados');
  });

  test('toda rota e raridade são válidas', ()=>{
    catalog.forEach(p=>{
      assert(arche.ROLES.includes(p.role), 'rota inválida: '+p.role);
      assert(rarity.isValidRarity(p.rarity), 'raridade inválida: '+p.rarity);
    });
  });

  test('existe ao menos 1 de cada raridade e cada rota', ()=>{
    rarity.RARITIES.forEach(r=>assert(catalog.some(p=>p.rarity===r), 'faltou raridade '+r));
    arche.ROLES.forEach(r=>assert(catalog.some(p=>p.role===r), 'faltou rota '+r));
  });

  test('buildPlayer é determinístico (mesmo nome → mesmo jogador)', ()=>{
    const a = players.buildPlayer(['OmenKing','top','lendario']);
    const b = players.buildPlayer(['OmenKing','top','lendario']);
    assertEq(JSON.stringify(a), JSON.stringify(b), 'não determinístico');
  });

  test('atributos respeitam [0,100] e o teto da raridade no 1★', ()=>{
    catalog.forEach(p=>{
      const ceil1 = rarity.attributeCeiling(p.rarity, 1);
      arche.ATTR_KEYS.forEach(k=>{
        assert(typeof p.attrs[k] === 'number', `${p.name}.${k} não é número`);
        assertBetween(p.attrs[k], 0, ceil1, `${p.name}.${k}`);
      });
    });
  });

  test('afinidades estão no intervalo [floor, ceil] p/ os 8 arquétipos', ()=>{
    catalog.forEach(p=>{
      arche.ARCHETYPES.forEach(a=>{
        assert(p.affinities[a] != null, `${p.name} sem afinidade ${a}`);
        assertBetween(p.affinities[a], cfg.power.affinityFloor, cfg.power.affinityCeil, `${p.name}.${a}`);
      });
    });
  });

  test('todo jogador começa com 1 estrela', ()=>{
    catalog.forEach(p=>assertEq(p.stars, 1, p.name+' não começa com 1★'));
  });

  test('atributos-assinatura da rota tendem a ser fortes', ()=>{
    // média dos atributos-assinatura >= média geral, agregando o catálogo
    let sigSum=0, sigN=0, allSum=0, allN=0;
    catalog.forEach(p=>{
      const sig = arche.ROLE_SIGNATURE[p.role];
      arche.ATTR_KEYS.forEach(k=>{
        allSum+=p.attrs[k]; allN++;
        if(sig.includes(k)){ sigSum+=p.attrs[k]; sigN++; }
      });
    });
    assert(sigSum/sigN > allSum/allN, 'assinatura não está acima da média');
  });
};
