'use strict';
const cfg   = require('../config.js');
const power = require('../power.js');

/* jogador sintético com atributos controlados */
function mkPlayer(role, attrs, affinities){
  return { id:'t', name:'T', role, rarity:'raro', stars:1,
    attrs: Object.assign({mecanica:50,macro:50,teamfight:50,laning:50,compostura:50}, attrs||{}),
    affinities: Object.assign({engage:1,dive:1,burst:1,poke:1,sustain:1,peel:1,scaling:1,teamfight:1}, affinities||{}) };
}
const champ = (arch, p)=>({ id:'c', arch, power:p });

module.exports = function(h){
  const { test, assert, assertEq, assertClose, assertBetween } = h;

  test('championPhaseStrength aceita número, objeto e ausência', ()=>{
    assertEq(power.championPhaseStrength(champ('burst', 70), 'mid'), 70);
    assertEq(power.championPhaseStrength(champ('burst', {early:40,mid:60,late:80}), 'late'), 80);
    assertEq(power.championPhaseStrength(champ('burst', null), 'mid'), cfg.power.defaultChampion);
  });

  test('championPhaseStrength faz clamp em [0,100]', ()=>{
    assertEq(power.championPhaseStrength(champ('burst', 999), 'mid'), 100);
    assertEq(power.championPhaseStrength(champ('burst', -5), 'mid'), 0);
  });

  test('affinityMultiplier faz clamp em [floor,ceil]', ()=>{
    const hi = mkPlayer('mid', {}, {burst:9});
    const lo = mkPlayer('mid', {}, {burst:-9});
    assertEq(power.affinityMultiplier(hi, 'burst'), cfg.power.affinityCeil);
    assertEq(power.affinityMultiplier(lo, 'burst'), cfg.power.affinityFloor);
  });

  test('poderPick cresce com o atributo principal da fase', ()=>{
    // mid no early tem 'laning' como principal
    const weak = mkPlayer('mid', {laning:20});
    const strong = mkPlayer('mid', {laning:90});
    const c = champ('burst', 50);
    assert(power.poderPickFase(strong, c, 'early') > power.poderPickFase(weak, c, 'early'),
      'laning maior deveria dar early maior');
  });

  test('poderPick escala com a afinidade', ()=>{
    const base = mkPlayer('mid', {}, {burst:1.0});
    const buff = mkPlayer('mid', {}, {burst:cfg.power.affinityCeil});
    const c = champ('burst', 50);
    const r = power.poderPick(buff, c).avg / power.poderPick(base, c).avg;
    assertClose(r, cfg.power.affinityCeil, 1e-6, 'razão de afinidade');
  });

  test('poderTime soma os 5 picks e calcula compostura média', ()=>{
    const picks = [
      { player: mkPlayer('top', {compostura:40}), champion: champ('engage', 50) },
      { player: mkPlayer('jungle', {compostura:50}), champion: champ('dive', 50) },
      { player: mkPlayer('mid', {compostura:60}), champion: champ('burst', 50) },
      { player: mkPlayer('adc', {compostura:70}), champion: champ('scaling', 50) },
      { player: mkPlayer('support', {compostura:80}), champion: champ('peel', 50) },
    ];
    const t = power.poderTime(picks);
    assertEq(t.picks.length, 5, 'deve ter 5 picks');
    assertClose(t.composure, 60, 1e-9, 'compostura média (40..80)');
    const somaEarly = t.picks.reduce((a,p)=>a+p.early, 0);
    assertClose(t.early, somaEarly, 1e-9, 'early deve ser a soma dos picks');
  });

  test('poderPick fica em escala ~0..140 com atributos plausíveis', ()=>{
    const p = mkPlayer('adc', {mecanica:70,macro:60,teamfight:80,laning:65,compostura:70});
    const r = power.poderPick(p, champ('scaling', 60));
    assertBetween(r.avg, 0, 140, 'poderPick médio fora de escala');
  });
};
