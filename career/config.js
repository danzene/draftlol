'use strict';
/* =======================================================================
   career/config.js — TODOS os valores de balanceamento (🎚️) num só lugar.
   Ajuste aqui sem caçar pelo código. Nada de lógica: só números e tabelas.
   ======================================================================= */

const CAREER_CONFIG = {

  /* ── Raridades ────────────────────────────────────────────────────────
     starMax        teto de estrelas
     attrFloor/Ceil faixa dos atributos-base no 1★ (o teto sobe por estrela)
     gachaWeight    peso relativo no sorteio do gacha
     dupeTokenValue Fichas recebidas por duplicata quando já está no máx. de ★ */
  rarities: {
    comum:    { label:'Comum',    starMax:3, attrFloor:30, attrCeil:55, gachaWeight:70, dupeTokenValue:5   }, // 🎚️
    raro:     { label:'Raro',     starMax:4, attrFloor:42, attrCeil:68, gachaWeight:22, dupeTokenValue:15  }, // 🎚️
    epico:    { label:'Épico',    starMax:5, attrFloor:55, attrCeil:82, gachaWeight:7,  dupeTokenValue:40  }, // 🎚️
    lendario: { label:'Lendário', starMax:5, attrFloor:68, attrCeil:95, gachaWeight:1,  dupeTokenValue:120 }, // 🎚️
  },

  /* fragmentos para subir de estrela: índice 0 = 1★→2★, 1 = 2★→3★, ... */
  starFragmentCost: [2, 3, 5, 8], // 🎚️
  /* cada estrela acima da 1ª eleva o TETO de cada atributo neste tanto */
  starCeilBonus: 6, // 🎚️
  attrHardCap: 100, // teto absoluto de qualquer atributo

  /* ── Poder do pick ────────────────────────────────────────────────────
     poderPick = (wPrimary·attrPrincipalDaRota + wOthers·média(outros)
                  + wChampion·forçaCampeão) · afinidade
     pesos somam 1.0; mexer aqui muda o quanto jogador vs campeão importa. */
  power: {
    wPrimary: 0.45,            // 🎚️
    wOthers:  0.25,            // 🎚️
    wChampion:0.30,            // 🎚️
    affinityFloor: 0.6,        // 🎚️ multiplicador mínimo de afinidade
    affinityCeil:  1.4,        // 🎚️ multiplicador máximo de afinidade
    affinityJitter: 0.20,      // 🎚️ variação aleatória da afinidade ao gerar jogador
    roleSignatureBonus: 8,     // 🎚️ bônus nos atributos-assinatura da rota
    defaultChampion: 50,       // forçaCampeão usada quando o pick não traz dado
  },

  /* ── Probabilidade / variância por compostura ─────────────────────────
     A probabilidade base vem da logística da diferença de poder.
     A compostura média das duas equipes "afia" o resultado:
       compostura alta  → sharpness ~1 → favorito se impõe (menos sorte)
       compostura baixa → sharpness baixo → puxa pra 50/50 → mais upsets (dos 2 lados)
     Nunca chega a 100%: clamp em [clampLo, clampHi]. */
  probability: {
    logisticK: 0.02,    // 🎚️ inclinação da logística (escala de poder de TIME ~0..700)
    composureMin: 0.55, // 🎚️ sharpness com compostura 0
    composureMax: 1.0,  // 🎚️ sharpness com compostura 100
    clampLo: 0.02,      // 🎚️ probabilidade mínima (nunca 0%)
    clampHi: 0.98,      // 🎚️ probabilidade máxima (nunca 100%)
  },

  /* ── Economia ─────────────────────────────────────────────────────────
     PE: experiência (níveis, talentos). Fichas: moeda de gacha. */
  economy: {
    pePerMatch: 50,            // 🎚️ PE por partida disputada
    peWinBonus: 80,            // 🎚️ PE extra por vitória
    fichaPerTournamentWin: 100,// 🎚️ Fichas por vencer um campeonato
  },
};

if(typeof module!=='undefined'&&module.exports)module.exports=CAREER_CONFIG;
if(typeof globalThis!=='undefined'){(globalThis.Career=globalThis.Career||{}).config=CAREER_CONFIG;}
