'use strict';
/* =======================================================================
   career/archetypes.js — vocabulário compartilhado do modo carreira.
   Reaproveita os 8 arquétipos que o jogo já usa (ARCH_CAT no index.html).
   Define rotas, atributos e os mapas que ligam rota↔atributo↔fase.
   ======================================================================= */

/* Os 8 arquétipos de campeão que o draft já conhece */
const ARCHETYPES = ['engage','dive','burst','poke','sustain','peel','scaling','teamfight'];

/* Atributos do jogador fictício (0–100) */
const ATTR_KEYS = ['mecanica','macro','teamfight','laning','compostura'];
const ATTR_LABELS = {
  mecanica:'Mecânica', macro:'Macro', teamfight:'Teamfight',
  laning:'Laning', compostura:'Compostura'
};

const ROLES = ['top','jungle','mid','adc','support'];
const ROLE_LABELS = { top:'Topo', jungle:'Selva', mid:'Meio', adc:'Atirador', support:'Suporte' };

const PHASES = ['early','mid','late'];

/* Atributo PRINCIPAL por rota e fase de jogo.
   Honra "Laning forte no início, Teamfight no late" e dá a cada rota uma
   identidade de power-spike. Alimenta o cálculo de poderPick por fase,
   que casa direto com o modelo early/mid/late do genTimeline. */
const ROLE_PHASE_PRIMARY = {
  top:     { early:'laning',  mid:'mecanica',  late:'teamfight' },
  jungle:  { early:'macro',   mid:'macro',     late:'teamfight' },
  mid:     { early:'laning',  mid:'mecanica',  late:'teamfight' },
  adc:     { early:'laning',  mid:'teamfight', late:'teamfight' },
  support: { early:'laning',  mid:'macro',     late:'teamfight' },
};

/* Atributos-assinatura por rota (recebem bônus ao gerar o jogador) */
const ROLE_SIGNATURE = {
  top:     ['laning','mecanica'],
  jungle:  ['macro','compostura'],
  mid:     ['mecanica','laning'],
  adc:     ['teamfight','mecanica'],
  support: ['macro','compostura'],
};

/* Viés de afinidade por rota: arquétipos com que a rota costuma se dar bem.
   Soma ao multiplicador base 1.0 ao gerar afinidades do jogador. */
const ROLE_ARCH_BIAS = {
  top:     { engage:0.12, dive:0.10, sustain:0.08 },
  jungle:  { dive:0.12, engage:0.08, scaling:0.08 },
  mid:     { burst:0.12, poke:0.10, scaling:0.06 },
  adc:     { scaling:0.12, teamfight:0.10, poke:0.08 },
  support: { peel:0.12, engage:0.08, teamfight:0.08 },
};

const __api={ARCHETYPES,ATTR_KEYS,ATTR_LABELS,ROLES,ROLE_LABELS,PHASES,ROLE_PHASE_PRIMARY,ROLE_SIGNATURE,ROLE_ARCH_BIAS};
if(typeof module!=='undefined'&&module.exports)module.exports=__api;
if(typeof globalThis!=='undefined'){(globalThis.Career=globalThis.Career||{}).archetypes=__api;}
