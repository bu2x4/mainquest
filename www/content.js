'use strict';
/* MainQuest content libraries: words, emoji, tips, templates.
   Everything a parent might want to tweak lives here. */

const EMOJI_MAP = [
  [/math|fraction|multipl|divid|worksheet/i, '➗'], [/spell|vocab|word/i, '🔤'], [/read|book|chapter/i, '📖'],
  [/science|lab|experiment/i, '🔬'], [/project|poster|model/i, '🧪'], [/essay|write|writing|journal|paragraph/i, '📝'],
  [/study|test|quiz|exam|review/i, '🧠'], [/homework|hw|assignment/i, '📚'], [/history|social studies/i, '🏛️'],
  [/backpack|bag/i, '🎒'], [/clean|tidy|pick up/i, '🧹'], [/room|bed\b|make bed/i, '🛏️'], [/trash|garbage/i, '🗑️'],
  [/dish|kitchen/i, '🍽️'], [/laundry|clothes/i, '🧺'], [/dog|walk|feed|pet|cat/i, '🐕'], [/shower|bath/i, '🚿'],
  [/teeth|brush/i, '🦷'], [/piano|keyboard/i, '🎹'], [/guitar/i, '🎸'], [/drum/i, '🥁'], [/practice|drill/i, '🎯'],
  [/soccer/i, '⚽'], [/football/i, '🏈'], [/basketball|hoops/i, '🏀'], [/baseball/i, '⚾'], [/jiu|bjj|karate|martial/i, '🥋'],
  [/swim/i, '🏊'], [/run|jog/i, '🏃'], [/email|message|text/i, '💬'], [/call|phone/i, '📞'], [/chromebook|computer|laptop|charge/i, '🔌'],
  [/sign|permission|form|slip/i, '✍️'], [/lunch|snack|food|eat/i, '🍎'], [/water|drink/i, '💧'], [/game|play/i, '🎮'],
  [/art|draw|paint/i, '🎨'], [/music|band|orchestra|violin/i, '🎵'], [/birthday|party|gift/i, '🎁'], [/library/i, '🏫'],
];
function autoEmoji(title) {
  for (const [re, e] of EMOJI_MAP) if (re.test(title)) return e;
  return '⭐';
}

/* Break-it-down templates. "regular" = 3 steps, "tiny" = 5+ steps (Goblin-Tools style spiciness). */
const BREAKDOWNS = [
  { re: /math|worksheet|problem|homework|hw|assignment|fraction|multipl|divid/i, steps: [
    'Get out the worksheet + a pencil', 'Read the directions out loud', 'Do problem #1', 'Do the next 3 problems',
    'Finish the rest', 'Check your name is on it', 'Put it in your take-home folder'] },
  { re: /read|book|chapter/i, steps: [
    'Find your book + bookmark', 'Sit somewhere comfy', 'Read 5 pages', 'Read 5 more pages', 'Write down the page you stopped on'] },
  { re: /study|test|quiz|exam|review|vocab|spell/i, steps: [
    'Grab your notes or study guide', 'Read through it once', 'Quiz yourself on 5 things', 'Check your answers',
    'Star the tricky ones', 'Quiz the tricky ones again'] },
  { re: /essay|write|writing|paragraph|journal/i, steps: [
    'Read the prompt and circle the key words', 'Write 3 ideas (messy is fine)', 'Pick your best idea',
    'Write your first sentence', 'Write the rest', 'Read it out loud once and fix 1 thing'] },
  { re: /project|poster|model|science/i, steps: [
    'Check what is due and when', 'List the supplies you need', 'Gather the supplies', 'Do the first small piece',
    'Do the next piece', 'Clean up your space', 'Tell an adult what is left'] },
  { re: /clean|tidy|room|pick up/i, steps: [
    'Clothes go in the hamper', 'Trash goes in the bin', 'Books + toys back to their spots', 'Clear off the desk',
    'Make the bed (quick version is fine)', 'Do a 30-second final look'] },
  { re: /backpack|bag|pack/i, steps: [
    'Dump everything out', 'Trash the trash', 'Papers into the take-home folder', 'Homework into the right folder',
    'Chromebook/charger in', 'Bag goes on the launch pad'] },
  { re: /practice|piano|guitar|drum|violin|instrument/i, steps: [
    'Set up your instrument', 'Warm up for 2 minutes', 'Play the hard part slowly 3 times', 'Play the whole thing once', 'Put it away'] },
];
const GENERIC_STEPS = ['Get everything you need', 'Do the first tiny part', 'Keep going until you are halfway', 'Finish it', 'Put your stuff away'];
function suggestSteps(title, spicy) {
  const tpl = (BREAKDOWNS.find(b => b.re.test(title)) || { steps: GENERIC_STEPS }).steps;
  if (spicy) return tpl.slice();
  if (tpl.length <= 3) return tpl.slice();
  return [tpl[0], tpl[Math.floor(tpl.length / 2)], tpl[tpl.length - 1]];
}

/* Gear check = resource management at the point of performance. */
const GEAR = [
  { re: /math|worksheet|homework|hw|assignment|essay|write|study|test|spell|vocab/i, gear: ['✏️ Pencil', '📒 Folder/planner', '💧 Water', '💻 Chromebook (if needed)'] },
  { re: /read|book|chapter/i, gear: ['📖 Book', '🔖 Bookmark', '💧 Water'] },
  { re: /project|poster|model|science|art|draw/i, gear: ['✂️ Supplies', '🧻 Something to clean up with', '💻 Instructions'] },
  { re: /practice|soccer|football|basketball|baseball|jiu|bjj|karate|swim/i, gear: ['🎒 Gear bag', '💧 Water bottle', '👟 Right shoes'] },
  { re: /piano|guitar|drum|violin|instrument|music/i, gear: ['🎵 Music/sheet', '🎸 Instrument'] },
  { re: /clean|tidy|room/i, gear: ['🧺 Hamper nearby', '🗑️ Trash bag'] },
];
function suggestGear(title) { return ((GEAR.find(g => g.re.test(title)) || { gear: ['💧 Water'] }).gear).slice(); }

/* Movement breaks (also used for "move first" before homework). */
const MOVES = ['10 jumping jacks', 'Stretch up high, then touch your toes', 'Get a glass of water',
  'Walk one lap around the house', '15 seconds of wall push-ups', 'Shake out your arms and legs for 15 seconds',
  'Balance on one foot for 20 seconds (each side)', '5 big frog jumps', 'Dance to one chorus of a song', 'Go look out a window for 30 seconds'];

/* Coach tips — organization + resource management, tagged so the app can align with his style. */
const TIPS = [
  { id: 'launchpad', tag: 'org', t: 'Make a Launch Pad', d: 'One spot by the door where your backpack, shoes and tomorrow’s stuff ALWAYS live. No more hunting in the morning.', task: 'Set up my launch pad by the door' },
  { id: 'gear', tag: 'res', t: 'Gear check first', d: 'Before a mission, grab everything you need. Every time you get up to find something, your brain has to restart.' },
  { id: 'twomin', tag: 'org', t: 'The 2-minute rule', d: 'If something takes less than 2 minutes (hang up jacket, throw away wrapper) — do it right now.' },
  { id: 'dump', tag: 'focus', t: 'Brain dump', d: 'Head too full? Park every thought in the Parking Lot 🅿️. Then pick ONE mission.' },
  { id: 'whenthen', tag: 'plan', t: 'Use When → Then', d: '“When I finish my snack, then I open my math folder.” Plans with a WHEN actually happen way more.' },
  { id: 'chop', tag: 'plan', t: 'Chop it up', d: 'Big mission feels impossible? Chop it into 3 tiny steps. Tiny steps are easy to start.' },
  { id: 'frog', tag: 'hard', t: 'Eat the frog 🐸', d: 'Do the hardest mission first while your brain is fresh. Everything after feels easy.' },
  { id: 'warmup', tag: 'easy', t: 'Warm-up mission', d: 'Start with a tiny easy one to get rolling — like a warm-up lap before the game.' },
  { id: 'folder', tag: 'org', t: 'One take-home folder', d: 'Every paper goes into ONE folder the second you get it. Scan it into MainQuest after school.', task: 'Get a take-home folder' },
  { id: 'charge', tag: 'res', t: 'Charge at night', d: 'Chromebook and phone charge at the launch pad every night. Dead battery = lost time.' },
  { id: 'race', tag: 'time', t: 'Race the clock', d: 'Guess how long a mission will take, then try to beat your guess. You get better at time every round.' },
  { id: 'music', tag: 'music', t: 'Music without words', d: 'Lyrics fight your brain for words. Try game soundtracks or lo-fi for homework.' },
  { id: 'double', tag: 'someone', t: 'Work next to someone', d: 'Brains focus better with company. Ask Dad to sit nearby while you do the mission (it’s called body doubling).' },
  { id: 'move', tag: 'move', t: 'Move first', d: '2 minutes of jumping jacks before homework wakes up your focus brakes. Science says so!' },
  { id: 'writeit', tag: 'org', t: 'Write it before you leave class', d: 'Add homework to MainQuest before you leave the classroom (or right when you get home).' },
  { id: 'clothes', tag: 'res', t: 'Tomorrow-you setup', d: 'Pick tomorrow’s clothes tonight. Mornings get 10 minutes easier.' },
  { id: 'fuel', tag: 'res', t: 'Fuel up', d: 'Snack + water before a big mission. Hungry brains wander.' },
  { id: 'desk', tag: 'focus', t: 'Clear the desk', d: 'Only stuff for THIS mission on the desk. Everything else is a distraction magnet.' },
  { id: 'glitch', tag: 'mind', t: 'Glitch, not fail', d: 'Missed something? It’s a glitch. Glitches get fixed — pick the next tiny step.' },
  { id: 'three', tag: 'plan', t: 'Pick 3', d: 'Only 3 missions for today. The rest can wait in Later. Three done beats ten started.' },
  { id: 'apps', tag: 'focus', t: 'Hide the distractions', d: 'Move games to the last page of your phone during missions. Out of sight, out of mind.' },
  { id: 'help', tag: 'mind', t: 'Stuck 5 minutes? Ask.', d: 'Asking for help after 5 stuck minutes is a pro move, not a weak one.' },
  { id: 'dessert', tag: 'res', t: 'Fun comes after', d: 'Save the fun thing (game, show) for right AFTER the mission. It’s your finish-line prize.' },
  { id: 'budget', tag: 'time', t: 'Time is like coins', d: 'You get a set amount of time before bed. Spend some on missions, then the rest is yours.' },
  { id: 'scan', tag: 'org', t: 'Scan it, forget it', d: 'Snap every paper you get in the Papers tab. MainQuest remembers due dates and turns it into study material.' },
  { id: 'spaced', tag: 'plan', t: 'Study in small hits', d: 'Four 20-minute sessions spread over a week beat one 80-minute cram. Your brain stores it between sessions.' },
  { id: 'quizself', tag: 'focus', t: 'Quiz > reread', d: 'Testing yourself (flashcards, practice quiz) works way better than rereading notes.' },
  { id: 'sunday', tag: 'org', t: 'Sunday Reset', d: 'Every Sunday: empty the backpack, find lost papers, look at the week. 15 minutes saves a crazy week.' },
  { id: 'fidget', tag: 'fidget', t: 'Fidget allowed', d: 'A fidget or standing up while you work is fine if it helps you lock in.' },
  { id: 'reread', tag: 'focus', t: 'Read directions out loud', d: 'Saying the directions out loud helps them stick in your brain.' },
  { id: 'peak', tag: 'time', t: 'Use your power hour', d: 'Do your hardest work at the time your brain runs best.' },
];


/* ===================================================================== School */
const SUBJECTS = [
  { id: 'math', name: 'Math', icon: '➗', color: '#4fc3ff' },
  { id: 'science', name: 'Science', icon: '🔬', color: '#7dff8a' },
  { id: 'ela', name: 'ELA / Reading', icon: '📖', color: '#ffb84d' },
  { id: 'social', name: 'Social Studies', icon: '🏛️', color: '#c99bff' },
  { id: 'other', name: 'Other', icon: '📁', color: '#9aa3c7' },
];
const subj = id => SUBJECTS.find(s => s.id === id) || SUBJECTS[4];
const ATYPES = [
  { id: 'homework', name: 'Homework', icon: '📝' },
  { id: 'test', name: 'Test', icon: '🧠' },
  { id: 'quiz', name: 'Quiz', icon: '❓' },
  { id: 'project', name: 'Project', icon: '🧪' },
  { id: 'reading', name: 'Reading', icon: '📖' },
  { id: 'form', name: 'Form / signature', icon: '✍️' },
];
const atype = id => ATYPES.find(a => a.id === id) || ATYPES[0];
const EVENT_CATS = [
  { id: 'personal', name: 'Personal', color: '#c99bff' },
  { id: 'sports', name: 'Sports / practice', color: '#4fc3ff' },
  { id: 'school', name: 'School event', color: '#ffb84d' },
  { id: 'family', name: 'Family', color: '#ff7ab6' },
];

/* Bosses: tests and projects become boss fights. Each planned study session is a hit. */
const BOSS_NAMES = {
  math: ['Fraction Phantom', 'Equation Golem', 'Decimal Hydra', 'Ratio Wraith', 'Variable Vortex'],
  science: ['Lab Leviathan', 'Atom Titan', 'Ecosystem Warden', 'Force Colossus', 'Circuit Specter'],
  ela: ['Essay Wraith', 'Grammar Gargoyle', 'Plot Twister', 'Vocab Basilisk', 'Thesis Sentinel'],
  social: ['Timeline Titan', 'Map Minotaur', 'Treaty Tyrant', 'Frontier Juggernaut', 'Archive Golem'],
  other: ['Deadline Drake', 'Chaos Construct', 'The Procrastinator', 'Shadow Syllabus'],
};
function bossName(subjectId, seed) { const arr = BOSS_NAMES[subjectId] || BOSS_NAMES.other; let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) | 0; return arr[Math.abs(h) % arr.length]; }

/* ===================================================================== Player identity */
// Original geometric emblems (24×24 paths).
const EMBLEMS = {
  bolt: 'M13 2 4 14h6l-1 8 9-12h-6l1-8z',
  flame: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z',
  comet: 'M20 4 9 15m11-11-4 1m4-1-1 4M9 15a4 4 0 1 1-5 5 4 4 0 0 1 5-5z',
  crystal: 'M12 2 5 9l7 13 7-13-7-7zM5 9h14M12 2l-3 7 3 13 3-13-3-7',
  shield: 'M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3zm0 5v10m-4-6h8',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8zm2 13h14',
  wave: 'M2 15c3-6 6-6 8 0s5 6 8 0 4-5 4-5M2 9c3-5 6-5 8 0',
  peak: 'M2 20 9 7l4 7 3-4 6 10H2zm7-13 2 4',
  orbit: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0-6c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9zm-9 9h3m12 0h3',
  star: 'M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7l3-7z',
  hex: 'M12 2 21 7v10l-9 5-9-5V7l9-5zm0 5 5 3v5l-5 3-5-3v-5l5-3z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
};
const EMBLEM_COLORS = ['#7dff8a', '#3de2ff', '#ffb84d', '#a98bff', '#ff5cc8', '#ffd84a', '#ff7a59', '#e8edff'];
function emblemSVG(id, color, size = 40, bg = true) {
  const d = EMBLEMS[id] || EMBLEMS.bolt;
  return `<svg class="emblem" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${bg ? `<rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="color-mix(in srgb, ${color} 16%, #0d0f1a)" stroke="${color}" stroke-opacity=".5"/>` : ''}<g transform="translate(4 4) scale(.6667)"><path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
}

// Ranks only go up. Three divisions each.
const RANKS = ['Recruit', 'Rookie', 'Contender', 'Veteran', 'Pro', 'Elite', 'Master', 'Grandmaster', 'Legend'];
const RANK_COLORS = ['#8f96b8', '#b58a5a', '#c9d1e8', '#ffd84a', '#3de2ff', '#7dff8a', '#a98bff', '#ff5cc8', '#ffffff'];
function rankFor(level) {
  const idx = Math.min(RANKS.length - 1, Math.floor((level - 1) / 3));
  if (idx === RANKS.length - 1) { const stars = level - 1 - idx * 3; return { name: 'Legend', div: stars > 0 ? `★${stars + 1}` : '', idx, color: RANK_COLORS[idx] }; }
  return { name: RANKS[idx], div: ['I', 'II', 'III'][(level - 1) % 3], idx, color: RANK_COLORS[idx] };
}

const THEMES = [
  { id: 'volt', name: 'Volt', accent: '#7dff8a', ink: '#06210b', level: 1 },
  { id: 'cyan', name: 'Cyan', accent: '#3de2ff', ink: '#03222b', level: 3 },
  { id: 'ember', name: 'Ember', accent: '#ff8a3d', ink: '#2b1000', level: 6 },
  { id: 'violet', name: 'Violet', accent: '#a98bff', ink: '#170b3a', level: 9 },
  { id: 'magenta', name: 'Magenta', accent: '#ff5cc8', ink: '#33001f', season: 6 },
  { id: 'gold', name: 'Gold', accent: '#ffd84a', ink: '#2e2300', season: 12 },
  { id: 'ice', name: 'Ice', accent: '#bfe9ff', ink: '#0c2230', level: 15 },
];
const BANNERS = [
  { id: 'night', name: 'Night', css: 'linear-gradient(120deg,#1a1f3a,#0d0f1a)' },
  { id: 'grid', name: 'Grid', css: 'repeating-linear-gradient(90deg,#ffffff0d 0 1px,transparent 1px 22px),repeating-linear-gradient(0deg,#ffffff0d 0 1px,transparent 1px 22px),linear-gradient(120deg,#13203a,#0d0f1a)', season: 2 },
  { id: 'aurora', name: 'Aurora', css: 'linear-gradient(120deg,#0b3b3a,#1a1f5a 55%,#3a0b4a)', season: 4 },
  { id: 'sunset', name: 'Sunset', css: 'linear-gradient(120deg,#4a1238,#a8442a 60%,#e0a33a)', season: 8 },
  { id: 'circuit', name: 'Circuit', css: 'radial-gradient(circle at 20% 30%,#3de2ff33 0 2px,transparent 3px) 0 0/26px 26px,linear-gradient(120deg,#062030,#0d0f1a)', season: 10 },
  { id: 'nebula', name: 'Nebula', css: 'radial-gradient(ellipse at 70% 30%,#a98bff55,transparent 60%),radial-gradient(ellipse at 20% 80%,#ff5cc844,transparent 55%),#0d0f1a', season: 14 },
  { id: 'carbon', name: 'Carbon', css: 'repeating-linear-gradient(45deg,#ffffff08 0 4px,transparent 4px 8px),#121420', level: 12 },
];
const TITLES = [
  { id: 'newcomer', name: 'Newcomer', how: 'Start' },
  { id: 'strategist', name: 'Strategist', ach: 'gameplan' },
  { id: 'speedrunner', name: 'Speedrunner', ach: 'speedrun' },
  { id: 'clutch', name: 'Clutch Player', ach: 'clutch' },
  { id: 'bosshunter', name: 'Boss Hunter', ach: 'boss' },
  { id: 'timelord', name: 'Time Lord', ach: 'timelord' },
  { id: 'scholar', name: 'Scholar', ach: 'scholar' },
  { id: 'lockedin', name: 'Locked In', ach: 'lockedin' },
  { id: 'archivist', name: 'Archivist', ach: 'papertrail' },
  { id: 'unshakable', name: 'Unshakable', season: 15 },
];

/* Free season track: 15 tiers, earned with a normal week's work; earned rewards never expire. */
const SEASON_DAYS = 42; // ~a grading period
const SEASON_TIER_XP = 150;
const SEASON_TRACK = [
  null, { banner: 'grid' }, { boost: 1 }, { banner: 'aurora' }, { color: '#ff7a59' }, { theme: 'magenta' }, { boost: 1 },
  { banner: 'sunset' }, { color: '#e8edff' }, { banner: 'circuit' }, { boost: 1 }, { theme: 'gold' }, { boost: 2 },
  { banner: 'nebula' }, { title: 'unshakable' },
];

const ACHIEVEMENTS = [
  { id: 'first', name: 'First Clear', desc: 'Finish your first mission' },
  { id: 'sweep', name: 'Clean Sweep', desc: 'Clear every mission planned for a day' },
  { id: 'speedrun', name: 'Speedrun', desc: 'Finish an assignment 2+ days early' },
  { id: 'clutch', name: 'Clutch', desc: 'Finish an assignment on its due day' },
  { id: 'boss', name: 'Boss Slayer', desc: 'Take down a test or project boss' },
  { id: 'respawn', name: 'Respawn', desc: 'Come back after 3+ days away' },
  { id: 'combo', name: 'Combo x5', desc: 'Five missions in one day' },
  { id: 'loadout', name: 'Loadout Ready', desc: 'Pack your bag the night before, 5 times' },
  { id: 'deepfocus', name: 'Deep Focus', desc: '25 focused minutes on one mission' },
  { id: 'gameplan', name: 'Game Plan', desc: 'Finish a Sunday Reset' },
  { id: 'papertrail', name: 'Paper Trail', desc: 'Scan papers on 5 different school days' },
  { id: 'timelord', name: 'Time Lord', desc: 'Nail 5 time guesses (within 30%)' },
  { id: 'scholar', name: 'Scholar', desc: 'Master 50 flashcards' },
  { id: 'ace', name: 'Ace', desc: 'Score 90%+ on a practice quiz' },
  { id: 'lockedin', name: 'Locked In', desc: '60 focused minutes in one day' },
  { id: 'comeback', name: 'Back In', desc: 'Return from a drift 10 times' },
];

const CHALLENGE_POOL = [
  { id: 'missions5', name: 'Clear 5 missions', goal: 5, ev: 'mission' },
  { id: 'study3', name: 'Finish 3 study sessions', goal: 3, ev: 'study' },
  { id: 'scan3', name: 'Scan papers on 3 days', goal: 3, ev: 'scanday' },
  { id: 'morning4', name: 'Morning routine 4 times', goal: 4, ev: 'routine:r-morning' },
  { id: 'bed4', name: 'Bedtime routine 4 times', goal: 4, ev: 'routine:r-bed' },
  { id: 'quiz2', name: 'Take 2 practice quizzes', goal: 2, ev: 'quiz' },
  { id: 'cards30', name: 'Review 30 flashcards', goal: 30, ev: 'card' },
  { id: 'focus60', name: '60 focus minutes', goal: 60, ev: 'focusmin' },
  { id: 'early2', name: 'Finish 2 things before the due day', goal: 2, ev: 'early' },
  { id: 'guess3', name: 'Make 3 time guesses', goal: 3, ev: 'guess' },
  { id: 'plan2', name: 'Plan your day twice', goal: 2, ev: 'plan' },
  { id: 'park5', name: 'Park 5 distractions', goal: 5, ev: 'park' },
];

/* Coach lines — dry, short, gamer-flavoured. No baby talk, no memes. */
const LINES = {
  hello: ['Pick one. Start small.', 'One thing at a time.', 'Ready when you are.', 'Two minutes. That’s all it takes to start.', 'Clear the next one, then reassess.'],
  done: ['Cleared.', 'Mission cleared.', 'GG.', 'Clean.', 'Done and done.'],
  drift: ['Drift happens. You noticed — that’s the skill.', 'Respawned. Next tiny step below.', 'Back in. Pick up where you left off.', 'No big deal. One small step.'],
  evening: ['30 minutes to bedtime. Set up tomorrow, then you’re free.', 'Pack the loadout for tomorrow.'],
};

/* Reminder wording. Rotated so it doesn't fade into the background. {t} = title. */
const VOICES = {
  hype:  { start: ['{t} — you’re up. Let’s go.', 'Go time: {t}.', '{t} starts now. Lock in.'],
           heads: ['{t} in 5. Wrap up and grab your stuff.', '5 minutes to {t}. Get set.'],
           follow: ['{t} is still waiting. 2 minutes gets you started.', 'Still time to clear {t}. Start small.'] },
  chill: { start: ['{t} is up. Ready when you are.', 'Time for {t}. Easy start.', '{t} now — just the first step.'],
           heads: ['{t} in 5 minutes.', 'Heads up: {t} in 5.'],
           follow: ['{t} is still here. Want to start with 2 minutes?', 'No rush — {t} whenever you’re ready. Today though.'] },
  coach: { start: ['Next play: {t}. Start the clock.', 'You’re in: {t}.', 'Game time — {t}.'],
           heads: ['5 minutes to {t}. Get your gear.', 'Huddle up — {t} in 5.'],
           follow: ['Still on the bench? {t}: first step, now.', 'Coach says: 2 minutes on {t}. Go.'] },
  funny: { start: ['A wild {t} appeared. Use START.', '{t} time. (Not pizza time. Sorry.)', 'Loading {t}… 100%. Your move.'],
           heads: ['{t} lands in 5. Brace.', 'Incoming: {t} in 5 minutes.'],
           follow: ['{t} is waiting… patiently… like a zombie.', 'Plot twist: {t} didn’t do itself.'] },
};
function voiceLine(voice, kind, title) {
  const v = VOICES[voice] || VOICES.chill; const arr = v[kind] || v.start;
  return arr[Math.floor(Math.random() * arr.length)].replace('{t}', title);
}

const QUIZ = [
  { k: 'peak', q: 'When does your brain run best?', opts: [['morning', '🌅', 'Morning'], ['afterschool', '🏫', 'Right after school'], ['evening', '🌙', 'Evening'], ['unsure', '🤷', 'Not sure yet']] },
  { k: 'sprint', q: 'How long can you lock in before you need a break?', opts: [[5, '⚡', 'About 5 minutes'], [10, '🔥', 'About 10 minutes'], [15, '💪', '15+ minutes'], [10, '🤷', 'Not sure']] },
  { k: 'helpers', multi: true, q: 'What helps you focus? Pick any.', opts: [['music', '🎧', 'Music'], ['quiet', '🤫', 'Quiet'], ['someone', '🧍', 'Someone nearby'], ['move', '🤸', 'Moving first'], ['fidget', '🌀', 'Something in my hands']] },
  { k: 'start', q: 'How do you like to start?', opts: [['easy', '🟢', 'Easy one first (warm-up)'], ['hard', '🔴', 'Hardest one first'], ['spin', '🎲', 'Let the app pick']] },
  { k: 'reward', q: 'What keeps you going?', opts: [['levels', '📈', 'Ranking up'], ['real', '🎁', 'Real rewards'], ['cosmetics', '🎨', 'Unlocking themes + banners'], ['bosses', '⚔️', 'Taking down bosses']] },
  { k: 'voice', q: 'How should reminders talk to you?', opts: [['hype', '📣', 'Hype'], ['chill', '😎', 'Chill'], ['coach', '🏈', 'Like a coach'], ['funny', '🤪', 'Funny']] },
];

const DEFAULT_ROUTINES = () => [
  { id: 'r-morning', name: 'Morning launch', emoji: '🌅', time: '07:00', days: [1, 2, 3, 4, 5], remind: true, items: [
    ['🛏️', 'Out of bed'], ['👕', 'Get dressed'], ['🥣', 'Breakfast'], ['🦷', 'Brush teeth'], ['🎒', 'Backpack from the launch pad'], ['👟', 'Shoes on, go']] },
  { id: 'r-after', name: 'After-school reset', emoji: '🏫', time: '15:45', days: [1, 2, 3, 4, 5], remind: true, items: [
    ['🎒', 'Unpack backpack'], ['📸', 'Scan today’s papers', 'scan'], ['🍎', 'Snack + water'], ['📋', 'Check what’s due'], ['🗺️', 'Plan up to 3 missions']] },
  { id: 'r-bed', name: 'Bedtime wind-down', emoji: '🌙', time: '20:15', days: [0, 1, 2, 3, 4, 5, 6], remind: true, items: [
    ['🎒', 'Pack bag for tomorrow'], ['👕', 'Clothes out for tomorrow'], ['🔌', 'Charge devices at the launch pad'], ['🚿', 'Shower'], ['🦷', 'Brush teeth'], ['😴', 'Lights out']] },
  { id: 'r-sunday', name: 'Sunday Reset', emoji: '🧹', time: '17:00', days: [0], remind: true, items: [
    ['🗑️', 'Empty the whole backpack'], ['📸', 'Scan any papers you missed', 'scan'], ['📅', 'Check the calendar for this week'], ['🚪', 'Clean up the launch pad'], ['🎯', 'Pick this week’s 3 challenges']] },
].map(r => ({ ...r, items: r.items.map(([emoji, text, action], i) => ({ id: r.id + '-' + i, emoji, text, action })), log: {} }));

const DEFAULT_REWARDS = () => [
  { id: 'rw1', emoji: '🎮', name: '30 min extra game time', cost: 60 },
  { id: 'rw2', emoji: '🍕', name: 'Pick what’s for dinner', cost: 90 },
  { id: 'rw3', emoji: '🎬', name: 'Movie night — you pick', cost: 150 },
  { id: 'rw4', emoji: '🌙', name: 'Stay up 30 min later (weekend)', cost: 120 },
];
