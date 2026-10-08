// fd8 battle engine (no DOM). Medabots-style robattle: 3 vs 3, both sides controlled by the player.
//
// The gauge: every medabot starts at its base (pos 0). When it's idle you give it an order (pick a part, and a
// target for shooting/repair). It then walks out to the center line (pos 100) — speed = leg propulsion + the part's
// charge — and the action fires when it arrives. Then it walks back (leg propulsion / 2 + the part's cooldown) and,
// back at base, waits for its next order. A guard stays at the center line for a while before walking back.
// A medabot whose head is destroyed has ceased functioning. The team whose leader (slot 1) ceases loses.

var GAUGE = 100;
var CHARGE_DIV = 25, COOL_DIV = 20;    // gauge speed per tick = stat sum / DIV
var GUARD_TICKS = 60;                  // how long a guard holds the center line
var BASE_HIT = 60, MIN_HIT = 5, MAX_HIT = 95;
var CLEAN_HIT_SHARE = 0.15;            // the best 15% of hitting rolls are clean hits (critical)
var DEFEND_DAMAGE = 0.75;              // a hit defended onto an arm deals 75%
var MAX_TICKS = 5000;

var rng = Math.random;
function rand(n){ return Math.floor(rng() * n); }
function pick(arr){ return arr[rand(arr.length)]; }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function makeBot(spec, side, idx){
  var parts = {};
  SLOTS.forEach(function(slot){
    var def = PARTS[spec[slot]];
    parts[slot] = { key: spec[slot], def: def, armor: def.armor, max: def.armor, uses: def.uses == null ? null : def.uses };
  });
  return { side: side, idx: idx, name: spec.name, leader: idx === 0, parts: parts, medal: MEDALS[spec.medal], medalKey: spec.medal,
           pos: 0, state: 'idle', order: null, guardLeft: 0 };
}

function createBattle(teamSpecs, terrain){
  var b = { terrain: terrain || 'plain', tick: 0, log: [], orderQueue: [], actQueue: [], winner: null };
  b.teams = teamSpecs.map(function(team, side){ return team.map(function(spec, i){ return makeBot(spec, side, i); }); });
  // everyone starts at base waiting for orders, alternating sides
  for (var i = 0; i < 3; i++) [0, 1].forEach(function(s){ if (b.teams[s][i]) b.orderQueue.push(b.teams[s][i]); });
  log(b, 'Robattle start! Terrain: ' + TERRAINS[b.terrain].name + '.', 'meta');
  return b;
}

function log(b, text, kind){ b.log.push({ text: text, kind: kind || 'meta', tick: b.tick }); }
function label(bot){ return 'P' + (bot.side + 1) + ' ' + bot.name; }
function isOut(bot){ return bot.state === 'out'; }
function alive(team){ return team.filter(function(x){ return !isOut(x); }); }
function intact(bot, slot){ return bot.parts[slot].armor > 0; }

// ---------- derived stats ----------
function terrainMod(b, bot){ return TERRAINS[b.terrain].mods[bot.parts.legs.def.legType] || [1, 1]; }
function propulsion(b, bot){
  var p = bot.parts.legs.def.propulsion * terrainMod(b, bot)[0];
  return intact(bot, 'legs') ? p : p * 0.5;               // broken legs: half speed
}
function evasion(b, bot){
  if (!intact(bot, 'legs')) return 0;                       // broken legs: can't dodge
  return bot.parts.legs.def.evasion * terrainMod(b, bot)[1];
}
function skillFor(bot, def){ return bot.medal.skills[def.action === 'fight' ? 'fight' : def.action === 'shoot' ? 'shoot' : 'support'] || 0; }
function chargeSpeed(b, bot, def){ return (propulsion(b, bot) + def.charge) / CHARGE_DIV; }
function coolSpeed(b, bot, def){ return (propulsion(b, bot) / 2 + def.cooldown) / COOL_DIV; }

// Parts that can be ordered right now: intact action parts, and heads with uses left.
function usableSlots(bot){
  return ['head', 'rarm', 'larm'].filter(function(slot){
    var p = bot.parts[slot];
    return p.armor > 0 && p.def.action && (p.uses == null || p.uses > 0);
  });
}

// ---------- orders ----------
function giveOrder(b, bot, slot, target){
  var i = b.orderQueue.indexOf(bot);
  if (i === -1 || usableSlots(bot).indexOf(slot) === -1) return false;
  b.orderQueue.splice(i, 1);
  bot.order = { slot: slot, target: target || null };
  bot.state = 'charge';
  var def = bot.parts[slot].def;
  log(b, label(bot) + ' readies ' + def.name + (target ? ' → ' + label(target) : '') + '.', 'order');
  return true;
}

// ---------- the clock ----------
// Advances the battle by one tick, or stops at the next thing the player needs to see. Returns:
//   { type:'order', bot }    a medabot at base needs an order (call giveOrder)
//   { type:'action', bot, from }   an action just resolved; b.log.slice(from) describes it
//   { type:'end' }           the battle is over (b.winner: 0, 1, or 'draw')
//   null                     one tick passed
function stepOnce(b){
  if (b.winner != null) return { type: 'end' };
  if (b.orderQueue.length) return { type: 'order', bot: b.orderQueue[0] };
  if (b.actQueue.length){
    var bot = b.actQueue.shift(), from = b.log.length;
    resolve(b, bot);
    checkWin(b);
    return { type: 'action', bot: bot, from: from };   // b.log.slice(from) = what happened
  }
  b.tick++;
  [0, 1].forEach(function(s){ b.teams[s].forEach(function(bot){ moveBot(b, bot); }); });
  if (b.tick >= MAX_TICKS || !b.teams.some(function(t){ return alive(t).some(canEverAct); })){
    b.winner = 'draw'; log(b, 'Nobody can act any more — draw.', 'meta');
  }
  return null;
}
function canEverAct(bot){ return bot.state !== 'stuck'; }

function moveBot(b, bot){
  if (bot.state === 'charge'){
    bot.pos = Math.min(GAUGE, bot.pos + chargeSpeed(b, bot, bot.parts[bot.order.slot].def));
    if (bot.pos >= GAUGE){ bot.state = 'act'; b.actQueue.push(bot); }
  } else if (bot.state === 'guard'){
    if (--bot.guardLeft <= 0 || !intact(bot, bot.order.slot)){ bot.state = 'cool'; log(b, label(bot) + ' stops guarding.', 'meta'); }
  } else if (bot.state === 'cool'){
    bot.pos = Math.max(0, bot.pos - coolSpeed(b, bot, bot.parts[bot.order.slot].def));
    if (bot.pos <= 0) backAtBase(b, bot);
  }
}
function backAtBase(b, bot){
  bot.order = null;
  if (usableSlots(bot).length){ bot.state = 'idle'; b.orderQueue.push(bot); }
  else { bot.state = 'stuck'; log(b, label(bot) + ' has no usable parts left.', 'meta'); }
}

// ---------- actions ----------
function resolve(b, bot){
  var slot = bot.order.slot, part = bot.parts[slot], def = part.def;
  bot.state = 'cool';
  if (part.armor <= 0){ log(b, label(bot) + "'s " + def.name + ' was destroyed — the action fails.', 'miss'); return; }
  if (part.uses != null) part.uses--;
  var enemies = alive(b.teams[1 - bot.side]);
  if (def.action === 'shoot'){
    var target = bot.order.target && !isOut(bot.order.target) ? bot.order.target : pick(enemies);
    log(b, label(bot) + ' fires ' + def.name + ' at ' + label(target) + '!', 'act');
    var hits = ATTACK_TYPES[def.type].hits || 1;
    for (var i = 0; i < hits && !isOut(target); i++) attack(b, bot, def, target);
  } else if (def.action === 'fight'){
    // melee hits whoever is closest to the center line
    var best = Math.max.apply(null, enemies.map(function(e){ return e.pos; }));
    var foe = pick(enemies.filter(function(e){ return e.pos === best; }));
    log(b, label(bot) + ' charges ' + label(foe) + ' with ' + def.name + '!', 'act');
    attack(b, bot, def, foe);
  } else if (def.action === 'repair'){
    var ally = bot.order.target && !isOut(bot.order.target) ? bot.order.target : bot;
    var worst = SLOTS.filter(function(s){ return intact(ally, s) && ally.parts[s].armor < ally.parts[s].max; })
      .sort(function(x, y){ return ally.parts[x].armor / ally.parts[x].max - ally.parts[y].armor / ally.parts[y].max; })[0];
    if (!worst){ log(b, label(bot) + ' uses ' + def.name + ' on ' + label(ally) + ', but nothing needs repair.', 'miss'); return; }
    var amt = Math.round(def.power * (1 + skillFor(bot, def) * MEDAL_POWER_PER_LEVEL));
    var p = ally.parts[worst], before = p.armor;
    p.armor = Math.min(p.max, p.armor + amt);
    log(b, label(bot) + ' repairs ' + label(ally) + "'s " + SLOT_LABEL[worst] + ' +' + (p.armor - before) + ' (' + p.armor + '/' + p.max + ').', 'heal');
  } else if (def.action === 'guard'){
    bot.state = 'guard';
    bot.guardLeft = GUARD_TICKS;
    log(b, label(bot) + ' raises ' + def.name + ' and guards its team.', 'act');
  }
}

function attack(b, attacker, def, target){
  var type = ATTACK_TYPES[def.type] || {};
  // a teammate guarding at the center line takes the hit instead (lasers pierce past it)
  var guard = null;
  if (!type.pierce) guard = alive(b.teams[target.side]).filter(function(g){ return g !== target && g.state === 'guard' && intact(g, g.order.slot); })[0];
  if (guard){ log(b, label(guard) + ' intercepts the attack!', 'meta'); target = guard; }

  var skill = skillFor(attacker, def);
  var chance = clamp(BASE_HIT + def.success + skill * MEDAL_SUCCESS_PER_LEVEL - evasion(b, target) * (type.evasionMult == null ? 1 : type.evasionMult), MIN_HIT, MAX_HIT);
  var roll = rng() * 100;
  if (roll >= chance){ log(b, '  Miss! (' + Math.round(chance) + '% to hit)', 'miss'); return; }
  var clean = roll < chance * CLEAN_HIT_SHARE;
  var dmg = def.power * (1 + skill * MEDAL_POWER_PER_LEVEL) * (0.9 + rng() * 0.2);
  if (clean) dmg *= type.critMult || 1.5;

  var slot;
  if (guard){
    slot = guard.order.slot;
    dmg = Math.max(1, dmg - guard.parts[slot].def.power);
  } else {
    slot = pick(SLOTS.filter(function(s){ return intact(target, s); }));
    // leg defense: shift the hit onto an intact arm for reduced damage (not on clean hits or piercing shots)
    var arms = ['rarm', 'larm'].filter(function(s){ return intact(target, s) && s !== slot; });
    if (!clean && !type.pierce && intact(target, 'legs') && arms.length && (slot === 'head' || slot === 'legs') && rng() * 100 < target.parts.legs.def.defense){
      log(b, '  ' + label(target) + ' defends — the hit is shifted from its ' + SLOT_LABEL[slot] + '.', 'meta');
      slot = pick(arms);
      dmg *= DEFEND_DAMAGE;
    }
  }
  damage(b, target, slot, Math.max(1, Math.round(dmg)), clean);
  if (type.splash && !isOut(target)){
    var other = SLOTS.filter(function(s){ return s !== slot && intact(target, s); });
    if (other.length) damage(b, target, pick(other), Math.max(1, Math.round(dmg * type.splash)), false);
  }
}

function damage(b, bot, slot, amount, clean){
  var p = bot.parts[slot];
  p.armor = Math.max(0, p.armor - amount);
  log(b, '  ' + (clean ? 'Clean hit! ' : 'Hit: ') + label(bot) + "'s " + SLOT_LABEL[slot] + ' −' + amount + ' (' + p.armor + '/' + p.max + ')', clean ? 'crit' : 'hit');
  if (p.armor > 0) return;
  if (slot === 'head'){
    bot.state = 'out';
    [b.orderQueue, b.actQueue].forEach(function(q){ var i = q.indexOf(bot); if (i !== -1) q.splice(i, 1); });
    log(b, '  ' + label(bot) + "'s head is destroyed — function ceased!", 'out');
  } else {
    log(b, '  ' + label(bot) + "'s " + SLOT_LABEL[slot] + ' (' + p.def.name + ') is destroyed!', 'out');
  }
}

function checkWin(b){
  [0, 1].forEach(function(s){
    if (b.winner == null && (isOut(b.teams[s][0]) || !alive(b.teams[s]).length)){
      b.winner = 1 - s;
      log(b, 'Player ' + (s + 1) + "'s leader has ceased functioning. Player " + (2 - s) + ' wins!', 'meta');
    }
  });
}

if (typeof module !== 'undefined') module.exports = { createBattle: createBattle, stepOnce: stepOnce, giveOrder: giveOrder, usableSlots: usableSlots,
  setRng: function(f){ rng = f; } };
