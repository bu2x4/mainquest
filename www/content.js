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

/* Buddy evolution lines. Stage index comes from level. The buddy never gets sad, sick or dies. */
const BUDDIES = {
  dragon: { name: 'Dragon', stages: ['🥚', '🦎', '🐊', '🐲', '🐉', '🐉'] },
  robot:  { name: 'Robot',  stages: ['🔩', '⚙️', '🤖', '🦾', '🛸', '🚀'] },
  ocean:  { name: 'Sea creature', stages: ['🫧', '🐟', '🐠', '🐬', '🦈', '🐋'] },
  space:  { name: 'Star', stages: ['✨', '⭐', '🌟', '🌙', '🪐', '🌌'] },
};
const STAGE_LEVELS = [1, 2, 4, 7, 11, 16];
const STAGE_NAMES = ['Egg', 'Baby', 'Kid', 'Teen', 'Grown', 'Legend'];

const BUDDY_LINES = {
  hello: ['Ready when you are!', 'One mission at a time. We got this.', "I'm right here working with you.", 'Pick ONE thing. Just one.',
    'Brains warm up after you start. Start tiny.', 'I found a shiny rock while you were gone. 🪨✨', 'You came back. That is the whole skill.'],
  done: ['THAT was awesome!', 'Boom. Mission complete!', 'You did the thing!', 'I knew you could. Next?', 'Level-up energy!'],
  drift: ['Drifting happens to every brain. You noticed — that is the skill.', 'Glitch spotted. Let’s get back on track.',
    'No problem. Tiny step, right now.', 'Welcome back, captain.'],
  morning: ['Good morning! Routine first, then you are free.', 'New day, fresh start.'],
  evening: ['Wind-down time soon. Future-you will thank you.', 'Set up tomorrow, then relax.'],
};

/* Reminder / prompt wording. Rotated to fight habituation. {t} = task title. */
const VOICES = {
  hype:  { start: ['🚀 Mission time: {t}! Let’s crush it.', '🔥 {t} — you’re up! Go go go!', '⚡ Power up: {t} starts now!'],
           heads: ['⏳ 5 min until {t}. Finish up and grab your gear!', '🎒 Heads up! {t} in 5. Get ready to launch!'],
           follow: ['👀 {t} is still waiting for its hero!', '🦸 {t} needs you! Just start 2 minutes.'] },
  chill: { start: ['🙂 Hey — {t} is up now. Ready when you are.', '🌊 Time for {t}. Nice and easy.', '☕ {t} o’clock. Just start small.'],
           heads: ['🕐 {t} in 5 minutes. Start wrapping up.', '🌙 Little heads-up: {t} in 5.'],
           follow: ['🙂 {t} is still here whenever you’re ready. Just 2 minutes?', '🌱 Tiny start on {t}? 2 minutes counts.'] },
  coach: { start: ['🏈 Next play: {t}. Start the clock!', '📣 You’re in, champ: {t}. Go!', '🎯 Game time: {t}.'],
           heads: ['⏱️ 5 minutes to {t}. Grab your gear, get set.', '🧢 Huddle up — {t} in 5.'],
           follow: ['🏈 Still on the bench? {t} needs 2 minutes from you.', '📋 Coach says: first tiny step of {t}. Go.'] },
  funny: { start: ['🦖 A wild {t} appeared! Use: START.', '🍕 {t} time. (Not pizza time. Sorry.)', '🐸 Ribbit. That means {t} in frog.'],
           heads: ['🐢 5 minutes until {t}. Even turtles get ready.', '🛸 Aliens report: {t} lands in 5 min.'],
           follow: ['🦥 Sloth mode detected. {t} is lonely.', '🧟 {t} is waiting… patiently… like a zombie.'] },
};
function voiceLine(voice, kind, title) {
  const v = VOICES[voice] || VOICES.chill;
  const arr = v[kind] || v.start;
  return arr[Math.floor(Math.random() * arr.length)].replace('{t}', title);
}

/* Movement breaks (also used for "move first" before homework). */
const MOVES = ['10 jumping jacks', 'Stretch up high like a giraffe, then touch your toes', 'Get a glass of water',
  'Walk one lap around the house', '15 seconds of wall push-ups', 'Shake out your arms and legs like a wet dog',
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
  { id: 'folder', tag: 'org', t: 'One take-home folder', d: 'Every paper goes into ONE folder the second you get it. Check it with a grown-up after school.', task: 'Get a take-home folder' },
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
  { id: 'sunday', tag: 'org', t: 'Sunday Reset', d: 'Every Sunday: empty the backpack, find lost papers, look at the week. 15 minutes saves a crazy week.' },
  { id: 'fidget', tag: 'fidget', t: 'Fidget allowed', d: 'A fidget, a squishy, or standing up while you work is totally fine if it helps you lock in.' },
  { id: 'reread', tag: 'focus', t: 'Read directions out loud', d: 'Saying the directions out loud helps them stick in your brain.' },
  { id: 'peak', tag: 'time', t: 'Use your power hour', d: 'Do your hardest mission at the time your brain works best.' },
];

const STICKERS = ['🦄','🐙','🦖','🦈','🐸','🦉','🐼','🦊','🐢','🦜','🐳','🦋','🍕','🌮','🍩','🍉','🧁','🍿',
  '⚽','🏀','🏈','⚾','🥋','🛹','🚀','🛸','🪐','☄️','🌋','🌈','💎','👑','🏆','🎸','🎮','🧲'];

const THEMES = [
  { id: 'mint', name: 'Mint', level: 1, cls: '' },
  { id: 'ocean', name: 'Ocean', level: 2, cls: 'theme-ocean' },
  { id: 'lava', name: 'Lava', level: 3, cls: 'theme-lava' },
  { id: 'forest', name: 'Forest', level: 5, cls: 'theme-forest' },
  { id: 'galaxy', name: 'Galaxy', level: 7, cls: 'theme-galaxy' },
  { id: 'neon', name: 'Neon', level: 9, cls: 'theme-neon' },
  { id: 'gold', name: 'Gold', level: 12, cls: 'theme-gold' },
];

const QUIZ = [
  { k: 'peak', q: 'When does your brain work best?', opts: [['morning', '🌅', 'Morning'], ['afterschool', '🏫', 'Right after school'], ['evening', '🌙', 'Evening'], ['unsure', '🤷', 'Not sure yet']] },
  { k: 'sprint', q: 'How long can you lock in before you need a break?', opts: [[5, '⚡', 'About 5 minutes'], [10, '🔥', 'About 10 minutes'], [15, '💪', '15 minutes or more'], [10, '🤷', 'Not sure']] },
  { k: 'helpers', multi: true, q: 'What helps you focus? (pick any)', opts: [['music', '🎧', 'Music'], ['quiet', '🤫', 'Quiet'], ['someone', '🧍', 'Someone nearby'], ['move', '🤸', 'Moving first'], ['fidget', '🧸', 'A fidget']] },
  { k: 'start', q: 'How do you like to start?', opts: [['easy', '🍰', 'Easy one first (warm-up)'], ['hard', '🐸', 'Hardest one first'], ['spin', '🎲', 'Let the app pick']] },
  { k: 'reward', q: 'What keeps you going?', opts: [['buddy', '🐣', 'Growing my buddy'], ['real', '🎁', 'Real rewards'], ['levels', '🏆', 'Leveling up + unlocks'], ['stickers', '🧩', 'Collecting stickers']] },
  { k: 'voice', q: 'How should reminders talk to you?', opts: [['hype', '📣', 'HYPE!'], ['chill', '😎', 'Chill'], ['coach', '🏈', 'Like a coach'], ['funny', '🤪', 'Funny']] },
];

const DEFAULT_ROUTINES = () => [
  { id: 'r-morning', name: 'Morning launch', emoji: '🌅', time: '07:00', days: [1, 2, 3, 4, 5], remind: true, items: [
    ['🛏️', 'Out of bed'], ['👕', 'Get dressed'], ['🥣', 'Breakfast'], ['🦷', 'Brush teeth'], ['🎒', 'Backpack from the launch pad'], ['👟', 'Shoes on, go!']] },
  { id: 'r-after', name: 'After-school reset', emoji: '🏫', time: '15:45', days: [1, 2, 3, 4, 5], remind: true, items: [
    ['🎒', 'Unpack backpack'], ['📄', 'Papers out of the folder'], ['🍎', 'Snack + water'], ['📋', 'Check what’s due'], ['🗺️', 'Plan 3 missions']] },
  { id: 'r-bed', name: 'Bedtime wind-down', emoji: '🌙', time: '20:15', days: [0, 1, 2, 3, 4, 5, 6], remind: true, items: [
    ['🎒', 'Pack bag for tomorrow'], ['👕', 'Clothes out for tomorrow'], ['🔌', 'Charge devices at the launch pad'], ['🚿', 'Shower'], ['🦷', 'Brush teeth'], ['😴', 'Lights out']] },
  { id: 'r-sunday', name: 'Sunday Reset', emoji: '🧹', time: '17:00', days: [0], remind: true, items: [
    ['🗑️', 'Empty the whole backpack'], ['📄', 'Find lost papers + homework'], ['📅', 'Look at this week’s big stuff'], ['🚪', 'Clean up the launch pad'], ['🎯', 'Pick 1 goal for the week']] },
].map(r => ({ ...r, items: r.items.map(([emoji, text], i) => ({ id: r.id + '-' + i, emoji, text })), log: {} }));

const DEFAULT_REWARDS = () => [
  { id: 'rw1', emoji: '🎮', name: '30 min extra game time', cost: 60 },
  { id: 'rw2', emoji: '🍕', name: 'Pick what’s for dinner', cost: 90 },
  { id: 'rw3', emoji: '🎬', name: 'Movie night — you pick', cost: 150 },
  { id: 'rw4', emoji: '🌙', name: 'Stay up 20 min later (weekend)', cost: 120 },
];
