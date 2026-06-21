'use strict';
/* =======================================================================
   career/run-tests.js — roda toda a suíte da fundação de carreira.
   Uso:  node career/run-tests.js
   ======================================================================= */

const h = require('./tests/_harness.js');

console.log('DraftLoL — testes do modo carreira (fundação de dados)\n');

require('./tests/players.test.js')(h);
require('./tests/power.test.js')(h);
require('./tests/probability.test.js')(h);
require('./tests/economy.test.js')(h);

h.summary();
