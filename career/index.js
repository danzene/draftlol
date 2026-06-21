'use strict';
/* =======================================================================
   career/index.js — ponto de entrada único da fundação de dados da carreira.
   Reúne os módulos para um require/import só. Nada renderiza no site ainda.
   ======================================================================= */

const config      = require('./config.js');
const util        = require('./util.js');
const archetypes  = require('./archetypes.js');
const rarity      = require('./rarity.js');
const players     = require('./players.js');
const power       = require('./power.js');
const probability = require('./probability.js');
const economy     = require('./economy.js');
const match       = require('./match.js');
const journey     = require('./journey.js');

module.exports = { config, util, archetypes, rarity, players, power, probability, economy, match, journey };
