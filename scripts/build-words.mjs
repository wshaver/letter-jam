import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOLCH = {
  preK: ['a','and','away','big','blue','can','come','down','find','for','funny','go','help','here','i','in','is','it','jump','little','look','make','me','my','not','one','play','red','run','said','see','the','three','to','two','up','we','where','yellow','you'],
  K: ['all','am','are','at','ate','be','black','brown','but','came','did','do','eat','four','get','good','have','he','into','like','must','new','no','now','on','our','out','please','pretty','ran','ride','saw','say','she','so','soon','that','there','they','this','too','under','want','was','well','went','what','white','who','will','with','yes'],
  '1': ['after','again','an','any','as','ask','by','could','every','fly','from','give','going','had','has','her','him','his','how','just','know','let','live','may','of','old','once','open','over','put','round','some','stop','take','thank','them','then','think','walk','were','when'],
  '2': ['always','around','because','been','before','best','both','buy','call','cold','does','dont','fast','first','five','found','gave','goes','green','its','made','many','off','or','pull','read','right','sing','sit','sleep','tell','their','these','those','upon','us','use','very','wash','which','why','wish','work','would','write','your'],
  '3': ['about','better','bring','carry','clean','cut','done','draw','drink','eight','fall','far','full','got','grow','hold','hot','hurt','if','keep','kind','laugh','light','long','much','myself','never','only','own','pick','seven','shall','show','six','small','start','ten','today','together','try','warm'],
};

// Dolch 95 nouns, minus "Santa Claus" (two words) and "good-bye" (hyphenated).
// "christmas" kept lowercase by request. Grade is banded by length below.
const NOUNS = ['apple','baby','back','ball','bear','bed','bell','bird','birthday','boat','box','boy','bread','brother','cake','car','cat','chair','chicken','children','christmas','coat','corn','cow','day','dog','doll','door','duck','egg','eye','farm','farmer','father','feet','fire','fish','floor','flower','game','garden','girl','grass','ground','hand','head','hill','home','horse','house','kitty','leg','letter','man','men','milk','money','morning','mother','name','nest','night','paper','party','picture','pig','rabbit','rain','ring','robin','school','seed','sheep','shoe','sister','snow','song','squirrel','stick','street','sun','table','thing','time','top','toy','tree','watch','water','way','wind','window','wood'];

function nounGrade(text) {
  if (text.length <= 3) return 'preK';
  if (text.length === 4) return 'K';
  if (text.length === 5) return '1';
  if (text.length === 6) return '2';
  return '3';
}

const words = [];
for (const [grade, list] of Object.entries(DOLCH)) {
  for (const text of list) {
    words.push({ id: text, text, grade, length: text.length });
  }
}

for (const text of NOUNS) {
  words.push({ id: text, text, grade: nounGrade(text), length: text.length, tags: ['noun'] });
}

const ids = new Set(words.map((w) => w.id));
if (ids.size !== words.length) {
  console.error('Duplicate word ids across DOLCH and NOUNS lists');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = `${__dirname}/../src/data/words.json`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(words, null, 2) + '\n');
console.log(`Wrote ${words.length} words to ${outPath}`);
