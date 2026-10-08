// fd8 data: parts, medals, leg types, terrain, preset medabots.
//
// The stat FIELDS follow the Medabots (Metabee / Rokusho, GBA) part system. The NUMBERS are PLACEHOLDERS —
// they're tuned to play sensibly, not copied from the cartridge. Replace them with real values as you find them.
//
// Part slots: head, rarm (right arm), larm (left arm), legs.
//   armor      the part's HP. A destroyed head = the medabot's function ceases (it's out).
//   action     what the part does when used:
//                shoot   ranged attack on the enemy you pick
//                fight   melee attack on the enemy closest to the center line when it lands
//                repair  restores armor to an ally's damaged part
//                guard   stands at the center line and takes attacks aimed at teammates
//   type       the attack style (see ATTACK_TYPES), or null for support parts
//   success    accuracy (support parts: reliability)
//   power      damage (repair: armor restored; guard: damage blocked per hit)
//   charge     how fast the medabot walks out to the center line with this part (added to leg propulsion)
//   cooldown   how fast it walks back afterwards
//   uses       head parts only: how many times per battle it can be used (null = unlimited)
// Legs:
//   legType    see LEG_TYPES (affects terrain)
//   propulsion base movement speed on the gauge
//   evasion    makes enemy attacks miss
//   defense    chance to defend: a hit is shifted onto an arm instead of where it landed, for reduced damage
var PARTS = {
  // ---------- Metabee (KBT) ----------
  kbt_head: { name:'Seeker Missile',  slot:'head', set:'Metabee', armor:60, action:'shoot', type:'missile', success:30, power:28, charge:10, cooldown:10, uses:5 },
  kbt_rarm: { name:'Revolver',        slot:'rarm', set:'Metabee', armor:70, action:'shoot', type:'rifle',   success:40, power:22, charge:14, cooldown:14 },
  kbt_larm: { name:'Submachine Gun',  slot:'larm', set:'Metabee', armor:70, action:'shoot', type:'gatling', success:35, power:9,  charge:12, cooldown:12 },
  kbt_legs: { name:'Bipedal Legs',    slot:'legs', set:'Metabee', armor:80, legType:'bipedal', propulsion:20, evasion:20, defense:15 },
  // ---------- Rokusho (KWG) ----------
  kwg_head: { name:'Chanbara Scan',   slot:'head', set:'Rokusho', armor:50, action:'repair', type:null, success:50, power:20, charge:12, cooldown:12, uses:3 },
  kwg_rarm: { name:'Chanbara Sword',  slot:'rarm', set:'Rokusho', armor:70, action:'fight', type:'sword',  success:45, power:26, charge:18, cooldown:16 },
  kwg_larm: { name:'Chanbara Hammer', slot:'larm', set:'Rokusho', armor:70, action:'fight', type:'hammer', success:20, power:38, charge:10, cooldown:10 },
  kwg_legs: { name:'Swift Legs',      slot:'legs', set:'Rokusho', armor:75, legType:'bipedal', propulsion:26, evasion:30, defense:10 },
  // ---------- Generic sets (placeholder designs to fill out the roster) ----------
  lzr_head: { name:'Scope Head',      slot:'head', set:'Laser',  armor:45, action:'shoot', type:'laser', success:45, power:24, charge:6, cooldown:8, uses:4 },
  lzr_rarm: { name:'Laser Cannon',    slot:'rarm', set:'Laser',  armor:60, action:'shoot', type:'laser', success:35, power:30, charge:6, cooldown:6 },
  lzr_larm: { name:'Beam Pistol',     slot:'larm', set:'Laser',  armor:60, action:'shoot', type:'beam',  success:50, power:16, charge:14, cooldown:14 },
  lzr_legs: { name:'Hover Base',      slot:'legs', set:'Laser',  armor:70, legType:'hover', propulsion:24, evasion:25, defense:10 },

  tnk_head: { name:'Armored Head',    slot:'head', set:'Tank',   armor:90, action:'guard', type:null, success:40, power:12, charge:8, cooldown:6, uses:3 },
  tnk_rarm: { name:'Heavy Shield',    slot:'rarm', set:'Tank',   armor:105, action:'guard', type:null, success:40, power:15, charge:8, cooldown:6 },
  tnk_larm: { name:'Napalm Launcher', slot:'larm', set:'Tank',   armor:90, action:'shoot', type:'napalm', success:25, power:20, charge:6, cooldown:6 },
  tnk_legs: { name:'Treads',          slot:'legs', set:'Tank',   armor:120, legType:'tank', propulsion:12, evasion:5, defense:35 },

  med_head: { name:'Nurse Cap',       slot:'head', set:'Nurse',  armor:50, action:'repair', type:null, success:50, power:30, charge:12, cooldown:12, uses:3 },
  med_rarm: { name:'Repair Arm',      slot:'rarm', set:'Nurse',  armor:60, action:'repair', type:null, success:50, power:18, charge:14, cooldown:14 },
  med_larm: { name:'Stun Baton',      slot:'larm', set:'Nurse',  armor:60, action:'fight', type:'sword', success:35, power:14, charge:16, cooldown:16 },
  med_legs: { name:'Wheels',          slot:'legs', set:'Nurse',  armor:70, legType:'vehicle', propulsion:30, evasion:15, defense:10 },

  fly_head: { name:'Radar Head',      slot:'head', set:'Flyer',  armor:45, action:'shoot', type:'missile', success:35, power:20, charge:12, cooldown:12, uses:4 },
  fly_rarm: { name:'Talon',           slot:'rarm', set:'Flyer',  armor:50, action:'fight', type:'sword', success:40, power:22, charge:20, cooldown:18 },
  fly_larm: { name:'Wing Gun',        slot:'larm', set:'Flyer',  armor:50, action:'shoot', type:'gatling', success:40, power:8, charge:18, cooldown:18 },
  fly_legs: { name:'Jet Wings',       slot:'legs', set:'Flyer',  armor:50, legType:'flight', propulsion:32, evasion:40, defense:5 }
};

// How each attack type behaves (rules approximated from the games; numbers are placeholders).
var ATTACK_TYPES = {
  rifle:   { label:'Rifle',   text:'Single accurate shot.' },
  gatling: { label:'Gatling', text:'Fires 3 shots; each rolls to hit and lands on its own random part.', hits:3 },
  missile: { label:'Missile', text:'Homing: ignores half the target\'s evasion.', evasionMult:0.5 },
  laser:   { label:'Laser',   text:'Pierces: can\'t be intercepted by a guard or defended by legs.', pierce:true },
  beam:    { label:'Beam',    text:'Quick, accurate shot with low power.' },
  napalm:  { label:'Napalm',  text:'Splash: also hits 50% damage to a second random part.', splash:0.5 },
  sword:   { label:'Sword',   text:'Accurate melee strike.' },
  hammer:  { label:'Hammer',  text:'Heavy melee strike: clean hits deal double instead of ×1.5.', critMult:2 }
};

// Medal: the medabot's brain. Each skill level adds to success and power of parts of that action.
var MEDALS = {
  kabuto:    { name:'Kabuto',    text:'Beetle medal — shooting specialist.', skills:{ shoot:5, fight:2, support:1 } },
  kuwagata:  { name:'Kuwagata',  text:'Stag beetle medal — fighting specialist.', skills:{ shoot:2, fight:5, support:1 } },
  tortoise:  { name:'Tortoise',  text:'Defensive medal — support and guarding.', skills:{ shoot:2, fight:1, support:5 } },
  angel:     { name:'Angel',     text:'Healer medal — repair specialist.', skills:{ shoot:1, fight:2, support:5 } },
  phoenix:   { name:'Phoenix',   text:'All-rounder medal.', skills:{ shoot:3, fight:3, support:3 } }
};
var MEDAL_SUCCESS_PER_LEVEL = 3, MEDAL_POWER_PER_LEVEL = 0.04;   // +3 success and +4% power per skill level

// Leg types and how terrain treats them: multipliers on propulsion and evasion.
var LEG_TYPES = ['bipedal', 'multi-legged', 'vehicle', 'tank', 'flight', 'hover'];
var TERRAINS = {
  plain:  { name:'Plain',  mods:{ bipedal:[1,1], 'multi-legged':[1,1], vehicle:[1.2,1], tank:[1,1], flight:[1,1], hover:[1,1] } },
  rough:  { name:'Rough',  mods:{ bipedal:[1,1], 'multi-legged':[1.1,1.1], vehicle:[0.6,0.7], tank:[1,1], flight:[1,1], hover:[0.9,0.9] } },
  water:  { name:'Water',  mods:{ bipedal:[0.7,0.6], 'multi-legged':[0.7,0.6], vehicle:[0.5,0.5], tank:[0.6,0.5], flight:[1,1], hover:[1.2,1.1] } }
};

// Preset medabots: a full set of parts plus a medal.
var PRESETS = {
  metabee:  { name:'Metabee',  head:'kbt_head', rarm:'kbt_rarm', larm:'kbt_larm', legs:'kbt_legs', medal:'kabuto' },
  rokusho:  { name:'Rokusho',  head:'kwg_head', rarm:'kwg_rarm', larm:'kwg_larm', legs:'kwg_legs', medal:'kuwagata' },
  lasertype:{ name:'Sniper',   head:'lzr_head', rarm:'lzr_rarm', larm:'lzr_larm', legs:'lzr_legs', medal:'phoenix' },
  tanktype: { name:'Bulwark',  head:'tnk_head', rarm:'tnk_rarm', larm:'tnk_larm', legs:'tnk_legs', medal:'tortoise' },
  nurse:    { name:'Nurse',    head:'med_head', rarm:'med_rarm', larm:'med_larm', legs:'med_legs', medal:'angel' },
  flyer:    { name:'Hawk',     head:'fly_head', rarm:'fly_rarm', larm:'fly_larm', legs:'fly_legs', medal:'phoenix' }
};
var DEFAULT_TEAMS = [['metabee', 'nurse', 'lasertype'], ['rokusho', 'tanktype', 'flyer']];

var SLOTS = ['head', 'rarm', 'larm', 'legs'];
var SLOT_LABEL = { head:'Head', rarm:'R.Arm', larm:'L.Arm', legs:'Legs' };
