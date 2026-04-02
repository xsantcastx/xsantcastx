import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type CopyFormat = 'emoji' | 'html' | 'unicode';

interface EmojiEntry {
  emoji: string;
  name: string;
  keywords: string[];
}

interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  emojis: EmojiEntry[];
}

interface SelectedEmoji {
  emoji: string;
  name: string;
  codepoint: string;
  htmlEntity: string;
}

const SKIN_TONES: { label: string; modifier: string }[] = [
  { label: 'Default',      modifier: '' },
  { label: 'Light',        modifier: '🏻' },
  { label: 'Medium-Light', modifier: '🏼' },
  { label: 'Medium',       modifier: '🏽' },
  { label: 'Medium-Dark',  modifier: '🏾' },
  { label: 'Dark',         modifier: '🏿' },
];

// Emojis that support skin tone modifiers
const SKIN_TONE_COMPATIBLE = new Set([
  '👍','👎','👋','✋','🤚','🖐','🖖',
  '👈','👉','👆','👇','☝','✌','🤞',
  '🤟','🤘','🤙','👌','🤌','🤏','✊',
  '👊','🤛','🤜','👏','🙌','👐','🤲',
  '🤝','🙏','✍','💅','🤳','💪','🦵',
  '🦶','👂','👃','👶','🧒','👦','👧',
  '👨','👩','🧓','👴','👵','👮','👷',
  '💂','🕵','👱','🎅','🤶','🦸','🦹',
  '🧙','🧚','🧛','🧜','🧝','🧞','🧟',
  '🤦','🤷','🙅','🙆','💁','🙋','🙇',
  '🚶','🏃','💃','🕺','🧖','🧗','🧘',
]);

const EMOJI_DATA: EmojiCategory[] = [
  {
    id: 'smileys', label: 'Smileys & Emotion', icon: '😀',
    emojis: [
      { emoji: '😀', name: 'grinning face', keywords: ['happy','smile','grin'] },
      { emoji: '😃', name: 'grinning face with big eyes', keywords: ['happy','smile'] },
      { emoji: '😄', name: 'grinning face with smiling eyes', keywords: ['happy','joy'] },
      { emoji: '😁', name: 'beaming face with smiling eyes', keywords: ['grin','happy'] },
      { emoji: '😆', name: 'grinning squinting face', keywords: ['laugh','happy'] },
      { emoji: '😅', name: 'grinning face with sweat', keywords: ['hot','laugh'] },
      { emoji: '🤣', name: 'rolling on the floor laughing', keywords: ['rofl','lol','laugh'] },
      { emoji: '😂', name: 'face with tears of joy', keywords: ['cry','laugh','happy'] },
      { emoji: '🙂', name: 'slightly smiling face', keywords: ['smile'] },
      { emoji: '🙃', name: 'upside-down face', keywords: ['silly','sarcasm'] },
      { emoji: '🫠', name: 'melting face', keywords: ['melt','hot','disappear'] },
      { emoji: '😉', name: 'winking face', keywords: ['wink','flirt'] },
      { emoji: '😊', name: 'smiling face with smiling eyes', keywords: ['blush','happy'] },
      { emoji: '😇', name: 'smiling face with halo', keywords: ['angel','innocent'] },
      { emoji: '🥰', name: 'smiling face with hearts', keywords: ['love','crush'] },
      { emoji: '😍', name: 'smiling face with heart-eyes', keywords: ['love','heart'] },
      { emoji: '🤩', name: 'star-struck', keywords: ['wow','star','eyes'] },
      { emoji: '😘', name: 'face blowing a kiss', keywords: ['kiss','love'] },
      { emoji: '😗', name: 'kissing face', keywords: ['kiss'] },
      { emoji: '☺', name: 'smiling face', keywords: ['warm','smile'] },
      { emoji: '😚', name: 'kissing face with closed eyes', keywords: ['kiss'] },
      { emoji: '😙', name: 'kissing face with smiling eyes', keywords: ['kiss'] },
      { emoji: '🥲', name: 'smiling face with tear', keywords: ['grateful','relieved'] },
      { emoji: '😋', name: 'face savoring food', keywords: ['yum','delicious'] },
      { emoji: '😛', name: 'face with tongue', keywords: ['tongue','playful'] },
      { emoji: '😜', name: 'winking face with tongue', keywords: ['prank','tongue'] },
      { emoji: '🤪', name: 'zany face', keywords: ['crazy','wild'] },
      { emoji: '😝', name: 'squinting face with tongue', keywords: ['tongue','prank'] },
      { emoji: '🤑', name: 'money-mouth face', keywords: ['rich','money'] },
      { emoji: '🤗', name: 'hugging face', keywords: ['hug','care'] },
      { emoji: '🤭', name: 'face with hand over mouth', keywords: ['oops','giggle'] },
      { emoji: '🫢', name: 'face with open eyes and hand over mouth', keywords: ['shock','gasp'] },
      { emoji: '🫣', name: 'face with peeking eye', keywords: ['peek','shy'] },
      { emoji: '🤫', name: 'shushing face', keywords: ['quiet','secret','shh'] },
      { emoji: '🤔', name: 'thinking face', keywords: ['think','hmm'] },
      { emoji: '🫡', name: 'saluting face', keywords: ['salute','respect'] },
      { emoji: '🤐', name: 'zipper-mouth face', keywords: ['secret','mute','zip'] },
      { emoji: '🤨', name: 'face with raised eyebrow', keywords: ['skeptic','doubt'] },
      { emoji: '😐', name: 'neutral face', keywords: ['meh','indifferent'] },
      { emoji: '😑', name: 'expressionless face', keywords: ['blank','meh'] },
      { emoji: '😶', name: 'face without mouth', keywords: ['speechless','silent'] },
      { emoji: '🫥', name: 'dotted line face', keywords: ['invisible','hidden'] },
      { emoji: '😏', name: 'smirking face', keywords: ['smirk','smug'] },
      { emoji: '😒', name: 'unamused face', keywords: ['annoyed','meh'] },
      { emoji: '🙄', name: 'face with rolling eyes', keywords: ['eyeroll','whatever'] },
      { emoji: '😬', name: 'grimacing face', keywords: ['awkward','nervous'] },
      { emoji: '😮‍💨', name: 'face exhaling', keywords: ['sigh','relief','exhale'] },
      { emoji: '🤥', name: 'lying face', keywords: ['lie','pinocchio'] },
      { emoji: '😌', name: 'relieved face', keywords: ['relieved','calm'] },
      { emoji: '😔', name: 'pensive face', keywords: ['sad','thoughtful'] },
      { emoji: '😪', name: 'sleepy face', keywords: ['tired','sleep'] },
      { emoji: '🤤', name: 'drooling face', keywords: ['drool','yum'] },
      { emoji: '😴', name: 'sleeping face', keywords: ['sleep','zzz'] },
      { emoji: '😷', name: 'face with medical mask', keywords: ['sick','mask','covid'] },
      { emoji: '🤒', name: 'face with thermometer', keywords: ['sick','fever'] },
      { emoji: '🤕', name: 'face with head-bandage', keywords: ['hurt','injury'] },
      { emoji: '🤢', name: 'nauseated face', keywords: ['sick','vomit'] },
      { emoji: '🤮', name: 'face vomiting', keywords: ['sick','vomit','puke'] },
      { emoji: '🤧', name: 'sneezing face', keywords: ['sneeze','sick'] },
      { emoji: '🥵', name: 'hot face', keywords: ['hot','heat','sweat'] },
      { emoji: '🥶', name: 'cold face', keywords: ['cold','freeze'] },
      { emoji: '🥴', name: 'woozy face', keywords: ['dizzy','drunk'] },
      { emoji: '😵', name: 'face with crossed-out eyes', keywords: ['dead','dizzy'] },
      { emoji: '🤯', name: 'exploding head', keywords: ['mind blown','shock'] },
      { emoji: '🤠', name: 'cowboy hat face', keywords: ['cowboy','western'] },
      { emoji: '🥳', name: 'partying face', keywords: ['party','celebrate'] },
      { emoji: '🥸', name: 'disguised face', keywords: ['disguise','spy'] },
      { emoji: '😎', name: 'smiling face with sunglasses', keywords: ['cool','sunglasses'] },
      { emoji: '🤓', name: 'nerd face', keywords: ['nerd','geek'] },
      { emoji: '🧐', name: 'face with monocle', keywords: ['classy','inspect'] },
      { emoji: '😕', name: 'confused face', keywords: ['confused','huh'] },
      { emoji: '🫤', name: 'face with diagonal mouth', keywords: ['unsure','meh'] },
      { emoji: '😟', name: 'worried face', keywords: ['worried','concern'] },
      { emoji: '🙁', name: 'slightly frowning face', keywords: ['sad','frown'] },
      { emoji: '☹', name: 'frowning face', keywords: ['sad','frown'] },
      { emoji: '😮', name: 'face with open mouth', keywords: ['surprise','wow'] },
      { emoji: '😯', name: 'hushed face', keywords: ['surprised','wow'] },
      { emoji: '😲', name: 'astonished face', keywords: ['shocked','amazed'] },
      { emoji: '😳', name: 'flushed face', keywords: ['embarrassed','blush'] },
      { emoji: '🥺', name: 'pleading face', keywords: ['puppy eyes','beg'] },
      { emoji: '🥹', name: 'face holding back tears', keywords: ['sad','about to cry'] },
      { emoji: '😦', name: 'frowning face with open mouth', keywords: ['anguish'] },
      { emoji: '😧', name: 'anguished face', keywords: ['pain','anguish'] },
      { emoji: '😨', name: 'fearful face', keywords: ['fear','scared'] },
      { emoji: '😰', name: 'anxious face with sweat', keywords: ['anxious','nervous'] },
      { emoji: '😥', name: 'sad but relieved face', keywords: ['sad','relieved'] },
      { emoji: '😢', name: 'crying face', keywords: ['cry','sad','tear'] },
      { emoji: '😭', name: 'loudly crying face', keywords: ['cry','sob','sad'] },
      { emoji: '😱', name: 'face screaming in fear', keywords: ['scream','horror'] },
      { emoji: '😖', name: 'confounded face', keywords: ['confused','quizzical'] },
      { emoji: '😣', name: 'persevering face', keywords: ['struggle','frustration'] },
      { emoji: '😞', name: 'disappointed face', keywords: ['sad','disappointed'] },
      { emoji: '😓', name: 'downcast face with sweat', keywords: ['cold sweat','hard work'] },
      { emoji: '😩', name: 'weary face', keywords: ['tired','weary'] },
      { emoji: '😫', name: 'tired face', keywords: ['exhausted','tired'] },
      { emoji: '🥱', name: 'yawning face', keywords: ['yawn','bored','tired'] },
      { emoji: '😤', name: 'face with steam from nose', keywords: ['angry','triumph'] },
      { emoji: '😡', name: 'pouting face', keywords: ['angry','rage','mad'] },
      { emoji: '😠', name: 'angry face', keywords: ['angry','mad'] },
      { emoji: '🤬', name: 'face with symbols on mouth', keywords: ['swear','curse'] },
      { emoji: '😈', name: 'smiling face with horns', keywords: ['devil','evil'] },
      { emoji: '👿', name: 'angry face with horns', keywords: ['devil','demon'] },
      { emoji: '💀', name: 'skull', keywords: ['death','dead','skeleton'] },
      { emoji: '☠', name: 'skull and crossbones', keywords: ['death','danger','poison'] },
      { emoji: '💩', name: 'pile of poo', keywords: ['poop','crap'] },
      { emoji: '🤡', name: 'clown face', keywords: ['clown','funny'] },
      { emoji: '👹', name: 'ogre', keywords: ['monster','scary'] },
      { emoji: '👺', name: 'goblin', keywords: ['monster','scary'] },
      { emoji: '👻', name: 'ghost', keywords: ['ghost','halloween'] },
      { emoji: '👽', name: 'alien', keywords: ['ufo','space','extraterrestrial'] },
      { emoji: '👾', name: 'alien monster', keywords: ['game','space invader'] },
      { emoji: '🤖', name: 'robot', keywords: ['robot','bot','ai'] },
      { emoji: '😺', name: 'grinning cat', keywords: ['cat','happy'] },
      { emoji: '😸', name: 'grinning cat with smiling eyes', keywords: ['cat'] },
      { emoji: '😹', name: 'cat with tears of joy', keywords: ['cat','laugh'] },
      { emoji: '😻', name: 'smiling cat with heart-eyes', keywords: ['cat','love'] },
      { emoji: '😼', name: 'cat with wry smile', keywords: ['cat','smirk'] },
      { emoji: '😽', name: 'kissing cat', keywords: ['cat','kiss'] },
      { emoji: '🙀', name: 'weary cat', keywords: ['cat','shocked'] },
      { emoji: '😿', name: 'crying cat', keywords: ['cat','sad'] },
      { emoji: '😾', name: 'pouting cat', keywords: ['cat','angry'] },
      { emoji: '🙈', name: 'see-no-evil monkey', keywords: ['monkey','shy'] },
      { emoji: '🙉', name: 'hear-no-evil monkey', keywords: ['monkey','deaf'] },
      { emoji: '🙊', name: 'speak-no-evil monkey', keywords: ['monkey','mute'] },
      { emoji: '💋', name: 'kiss mark', keywords: ['kiss','lips','love'] },
      { emoji: '💌', name: 'love letter', keywords: ['love','mail','heart'] },
      { emoji: '💘', name: 'heart with arrow', keywords: ['love','cupid'] },
      { emoji: '💝', name: 'heart with ribbon', keywords: ['love','gift'] },
      { emoji: '💖', name: 'sparkling heart', keywords: ['love','sparkle'] },
      { emoji: '💗', name: 'growing heart', keywords: ['love','growing'] },
      { emoji: '💓', name: 'beating heart', keywords: ['love','heartbeat'] },
      { emoji: '💞', name: 'revolving hearts', keywords: ['love','hearts'] },
      { emoji: '💕', name: 'two hearts', keywords: ['love','hearts'] },
      { emoji: '💟', name: 'heart decoration', keywords: ['love'] },
      { emoji: '❣', name: 'heart exclamation', keywords: ['love','excitement'] },
      { emoji: '💔', name: 'broken heart', keywords: ['heartbreak','sad'] },
      { emoji: '❤️‍🔥', name: 'heart on fire', keywords: ['love','passion'] },
      { emoji: '❤', name: 'red heart', keywords: ['love','heart','red'] },
      { emoji: '🧡', name: 'orange heart', keywords: ['love','orange'] },
      { emoji: '💛', name: 'yellow heart', keywords: ['love','yellow'] },
      { emoji: '💚', name: 'green heart', keywords: ['love','green'] },
      { emoji: '💙', name: 'blue heart', keywords: ['love','blue'] },
      { emoji: '💜', name: 'purple heart', keywords: ['love','purple'] },
      { emoji: '🤎', name: 'brown heart', keywords: ['love','brown'] },
      { emoji: '🖤', name: 'black heart', keywords: ['love','dark','black'] },
      { emoji: '🤍', name: 'white heart', keywords: ['love','white','pure'] },
      { emoji: '💯', name: 'hundred points', keywords: ['100','perfect','score'] },
      { emoji: '💢', name: 'anger symbol', keywords: ['angry'] },
      { emoji: '💥', name: 'collision', keywords: ['boom','crash','bang'] },
      { emoji: '💫', name: 'dizzy', keywords: ['star','dizzy'] },
      { emoji: '💦', name: 'sweat droplets', keywords: ['sweat','water'] },
      { emoji: '💨', name: 'dashing away', keywords: ['wind','fast','run'] },
      { emoji: '🕳', name: 'hole', keywords: ['hole','void'] },
      { emoji: '💬', name: 'speech balloon', keywords: ['chat','talk','comment'] },
      { emoji: '💭', name: 'thought balloon', keywords: ['think','idea'] },
      { emoji: '💤', name: 'zzz', keywords: ['sleep','sleepy'] },
    ]
  },
  {
    id: 'people', label: 'People & Body', icon: '👋',
    emojis: [
      { emoji: '👋', name: 'waving hand', keywords: ['hello','hi','bye','wave'] },
      { emoji: '🤚', name: 'raised back of hand', keywords: ['hand','backhand'] },
      { emoji: '🖐', name: 'hand with fingers splayed', keywords: ['hand','five'] },
      { emoji: '✋', name: 'raised hand', keywords: ['stop','high five'] },
      { emoji: '🖖', name: 'vulcan salute', keywords: ['spock','trek'] },
      { emoji: '🫱', name: 'rightwards hand', keywords: ['hand','right'] },
      { emoji: '🫲', name: 'leftwards hand', keywords: ['hand','left'] },
      { emoji: '🫳', name: 'palm down hand', keywords: ['hand','down'] },
      { emoji: '🫴', name: 'palm up hand', keywords: ['hand','up'] },
      { emoji: '👌', name: 'OK hand', keywords: ['ok','perfect','fine'] },
      { emoji: '🤌', name: 'pinched fingers', keywords: ['italian','chef kiss'] },
      { emoji: '🤏', name: 'pinching hand', keywords: ['small','tiny'] },
      { emoji: '✌', name: 'victory hand', keywords: ['peace','victory','two'] },
      { emoji: '🤞', name: 'crossed fingers', keywords: ['luck','hope'] },
      { emoji: '🫰', name: 'hand with index finger and thumb crossed', keywords: ['love','money','snap'] },
      { emoji: '🤟', name: 'love-you gesture', keywords: ['love','ily'] },
      { emoji: '🤘', name: 'sign of the horns', keywords: ['rock','metal'] },
      { emoji: '🤙', name: 'call me hand', keywords: ['phone','call','shaka'] },
      { emoji: '👈', name: 'backhand index pointing left', keywords: ['left','point'] },
      { emoji: '👉', name: 'backhand index pointing right', keywords: ['right','point'] },
      { emoji: '👆', name: 'backhand index pointing up', keywords: ['up','point'] },
      { emoji: '🖕', name: 'middle finger', keywords: ['rude','flip off'] },
      { emoji: '👇', name: 'backhand index pointing down', keywords: ['down','point'] },
      { emoji: '☝', name: 'index pointing up', keywords: ['up','one','point'] },
      { emoji: '🫵', name: 'index pointing at the viewer', keywords: ['you','point'] },
      { emoji: '👍', name: 'thumbs up', keywords: ['like','yes','good','approve'] },
      { emoji: '👎', name: 'thumbs down', keywords: ['dislike','no','bad'] },
      { emoji: '✊', name: 'raised fist', keywords: ['fist','power','punch'] },
      { emoji: '👊', name: 'oncoming fist', keywords: ['punch','fist bump'] },
      { emoji: '🤛', name: 'left-facing fist', keywords: ['fist'] },
      { emoji: '🤜', name: 'right-facing fist', keywords: ['fist'] },
      { emoji: '👏', name: 'clapping hands', keywords: ['clap','bravo','applause'] },
      { emoji: '🙌', name: 'raising hands', keywords: ['celebrate','hooray','praise'] },
      { emoji: '🫶', name: 'heart hands', keywords: ['love','heart'] },
      { emoji: '👐', name: 'open hands', keywords: ['hands','jazz'] },
      { emoji: '🤲', name: 'palms up together', keywords: ['prayer','book'] },
      { emoji: '🤝', name: 'handshake', keywords: ['deal','agreement','hello'] },
      { emoji: '🙏', name: 'folded hands', keywords: ['pray','please','thanks'] },
      { emoji: '✍', name: 'writing hand', keywords: ['write','pen'] },
      { emoji: '💅', name: 'nail polish', keywords: ['beauty','nails','sassy'] },
      { emoji: '🤳', name: 'selfie', keywords: ['selfie','camera','phone'] },
      { emoji: '💪', name: 'flexed biceps', keywords: ['strong','muscle','flex'] },
      { emoji: '🦵', name: 'leg', keywords: ['leg','kick'] },
      { emoji: '🦶', name: 'foot', keywords: ['foot','kick','stomp'] },
      { emoji: '👂', name: 'ear', keywords: ['hear','listen'] },
      { emoji: '👃', name: 'nose', keywords: ['smell','nose'] },
      { emoji: '🧠', name: 'brain', keywords: ['brain','smart','think'] },
      { emoji: '🫀', name: 'anatomical heart', keywords: ['heart','organ'] },
      { emoji: '🫁', name: 'lungs', keywords: ['lungs','breathe'] },
      { emoji: '🦷', name: 'tooth', keywords: ['tooth','dentist'] },
      { emoji: '🦴', name: 'bone', keywords: ['bone','skeleton'] },
      { emoji: '👀', name: 'eyes', keywords: ['look','see','watch'] },
      { emoji: '👁', name: 'eye', keywords: ['look','see'] },
      { emoji: '👅', name: 'tongue', keywords: ['tongue','taste'] },
      { emoji: '👄', name: 'mouth', keywords: ['lips','mouth'] },
      { emoji: '🫦', name: 'biting lip', keywords: ['flirt','nervous','anxious'] },
      { emoji: '👶', name: 'baby', keywords: ['baby','child','infant'] },
      { emoji: '👦', name: 'boy', keywords: ['boy','child','male'] },
      { emoji: '👧', name: 'girl', keywords: ['girl','child','female'] },
      { emoji: '👨', name: 'man', keywords: ['man','male','guy'] },
      { emoji: '👩', name: 'woman', keywords: ['woman','female','lady'] },
      { emoji: '🧓', name: 'older person', keywords: ['old','elder','senior'] },
      { emoji: '👴', name: 'old man', keywords: ['grandpa','elderly'] },
      { emoji: '👵', name: 'old woman', keywords: ['grandma','elderly'] },
    ]
  },
  {
    id: 'animals', label: 'Animals & Nature', icon: '🐾',
    emojis: [
      { emoji: '🐵', name: 'monkey face', keywords: ['monkey','animal'] },
      { emoji: '🐒', name: 'monkey', keywords: ['monkey','primate'] },
      { emoji: '🦍', name: 'gorilla', keywords: ['gorilla','ape'] },
      { emoji: '🦧', name: 'orangutan', keywords: ['orangutan','ape'] },
      { emoji: '🐶', name: 'dog face', keywords: ['dog','puppy','pet'] },
      { emoji: '🐕', name: 'dog', keywords: ['dog','pet'] },
      { emoji: '🦮', name: 'guide dog', keywords: ['dog','blind','service'] },
      { emoji: '🐩', name: 'poodle', keywords: ['dog','poodle'] },
      { emoji: '🐺', name: 'wolf', keywords: ['wolf','howl'] },
      { emoji: '🦊', name: 'fox', keywords: ['fox','cunning'] },
      { emoji: '🦝', name: 'raccoon', keywords: ['raccoon','trash panda'] },
      { emoji: '🐱', name: 'cat face', keywords: ['cat','kitten','pet'] },
      { emoji: '🐈', name: 'cat', keywords: ['cat','pet'] },
      { emoji: '🦁', name: 'lion', keywords: ['lion','king'] },
      { emoji: '🐯', name: 'tiger face', keywords: ['tiger','animal'] },
      { emoji: '🐅', name: 'tiger', keywords: ['tiger'] },
      { emoji: '🐆', name: 'leopard', keywords: ['leopard','cheetah'] },
      { emoji: '🐴', name: 'horse face', keywords: ['horse','pony'] },
      { emoji: '🫎', name: 'moose', keywords: ['moose','elk'] },
      { emoji: '🫏', name: 'donkey', keywords: ['donkey','mule'] },
      { emoji: '🦄', name: 'unicorn', keywords: ['unicorn','magic','fantasy'] },
      { emoji: '🦓', name: 'zebra', keywords: ['zebra','stripes'] },
      { emoji: '🦌', name: 'deer', keywords: ['deer','bambi'] },
      { emoji: '🦬', name: 'bison', keywords: ['bison','buffalo'] },
      { emoji: '🐮', name: 'cow face', keywords: ['cow','moo'] },
      { emoji: '🐂', name: 'ox', keywords: ['ox','bull'] },
      { emoji: '🐃', name: 'water buffalo', keywords: ['buffalo'] },
      { emoji: '🐄', name: 'cow', keywords: ['cow','milk'] },
      { emoji: '🐷', name: 'pig face', keywords: ['pig','oink'] },
      { emoji: '🐖', name: 'pig', keywords: ['pig'] },
      { emoji: '🐗', name: 'boar', keywords: ['boar','pig'] },
      { emoji: '🐽', name: 'pig nose', keywords: ['pig','nose'] },
      { emoji: '🐏', name: 'ram', keywords: ['ram','sheep'] },
      { emoji: '🐑', name: 'ewe', keywords: ['sheep','lamb'] },
      { emoji: '🐐', name: 'goat', keywords: ['goat'] },
      { emoji: '🐪', name: 'camel', keywords: ['camel','desert'] },
      { emoji: '🐫', name: 'two-hump camel', keywords: ['camel','desert'] },
      { emoji: '🦙', name: 'llama', keywords: ['llama','alpaca'] },
      { emoji: '🦒', name: 'giraffe', keywords: ['giraffe','tall'] },
      { emoji: '🐘', name: 'elephant', keywords: ['elephant','big'] },
      { emoji: '🦣', name: 'mammoth', keywords: ['mammoth','extinct'] },
      { emoji: '🦏', name: 'rhinoceros', keywords: ['rhino'] },
      { emoji: '🦛', name: 'hippopotamus', keywords: ['hippo'] },
      { emoji: '🐭', name: 'mouse face', keywords: ['mouse','rat'] },
      { emoji: '🐁', name: 'mouse', keywords: ['mouse','rat'] },
      { emoji: '🐀', name: 'rat', keywords: ['rat','mouse'] },
      { emoji: '🐹', name: 'hamster', keywords: ['hamster','pet'] },
      { emoji: '🐰', name: 'rabbit face', keywords: ['rabbit','bunny'] },
      { emoji: '🐇', name: 'rabbit', keywords: ['rabbit','bunny'] },
      { emoji: '🐿', name: 'chipmunk', keywords: ['chipmunk','squirrel'] },
      { emoji: '🦫', name: 'beaver', keywords: ['beaver','dam'] },
      { emoji: '🦔', name: 'hedgehog', keywords: ['hedgehog','sonic'] },
      { emoji: '🦇', name: 'bat', keywords: ['bat','vampire'] },
      { emoji: '🐻', name: 'bear', keywords: ['bear','grizzly'] },
      { emoji: '🐨', name: 'koala', keywords: ['koala','australia'] },
      { emoji: '🐼', name: 'panda', keywords: ['panda','bear'] },
      { emoji: '🦥', name: 'sloth', keywords: ['sloth','lazy','slow'] },
      { emoji: '🦦', name: 'otter', keywords: ['otter','cute'] },
      { emoji: '🦨', name: 'skunk', keywords: ['skunk','smell'] },
      { emoji: '🦘', name: 'kangaroo', keywords: ['kangaroo','australia'] },
      { emoji: '🦡', name: 'badger', keywords: ['badger'] },
      { emoji: '🐾', name: 'paw prints', keywords: ['paw','pet','animal'] },
      { emoji: '🦃', name: 'turkey', keywords: ['turkey','thanksgiving'] },
      { emoji: '🐔', name: 'chicken', keywords: ['chicken','hen'] },
      { emoji: '🐓', name: 'rooster', keywords: ['rooster','cock'] },
      { emoji: '🐣', name: 'hatching chick', keywords: ['chick','baby'] },
      { emoji: '🐤', name: 'baby chick', keywords: ['chick','bird'] },
      { emoji: '🐥', name: 'front-facing baby chick', keywords: ['chick'] },
      { emoji: '🐦', name: 'bird', keywords: ['bird','fly'] },
      { emoji: '🐧', name: 'penguin', keywords: ['penguin','cold'] },
      { emoji: '🕊', name: 'dove', keywords: ['dove','peace','bird'] },
      { emoji: '🦅', name: 'eagle', keywords: ['eagle','america','bird'] },
      { emoji: '🦆', name: 'duck', keywords: ['duck','quack'] },
      { emoji: '🦢', name: 'swan', keywords: ['swan','grace'] },
      { emoji: '🦉', name: 'owl', keywords: ['owl','wisdom','night'] },
      { emoji: '🦤', name: 'dodo', keywords: ['dodo','extinct'] },
      { emoji: '🪶', name: 'feather', keywords: ['feather','light'] },
      { emoji: '🦩', name: 'flamingo', keywords: ['flamingo','pink'] },
      { emoji: '🦚', name: 'peacock', keywords: ['peacock','bird'] },
      { emoji: '🦜', name: 'parrot', keywords: ['parrot','bird','talk'] },
      { emoji: '🐊', name: 'crocodile', keywords: ['croc','alligator'] },
      { emoji: '🐢', name: 'turtle', keywords: ['turtle','slow'] },
      { emoji: '🦎', name: 'lizard', keywords: ['lizard','reptile'] },
      { emoji: '🐍', name: 'snake', keywords: ['snake','serpent'] },
      { emoji: '🐲', name: 'dragon face', keywords: ['dragon','fantasy'] },
      { emoji: '🐉', name: 'dragon', keywords: ['dragon','fantasy'] },
      { emoji: '🦕', name: 'sauropod', keywords: ['dinosaur','dino'] },
      { emoji: '🦖', name: 'T-Rex', keywords: ['dinosaur','trex'] },
      { emoji: '🐳', name: 'spouting whale', keywords: ['whale','ocean'] },
      { emoji: '🐋', name: 'whale', keywords: ['whale','ocean'] },
      { emoji: '🐬', name: 'dolphin', keywords: ['dolphin','ocean'] },
      { emoji: '🦭', name: 'seal', keywords: ['seal','ocean'] },
      { emoji: '🐟', name: 'fish', keywords: ['fish','ocean'] },
      { emoji: '🐠', name: 'tropical fish', keywords: ['fish','colorful'] },
      { emoji: '🐡', name: 'blowfish', keywords: ['fish','puffer'] },
      { emoji: '🦈', name: 'shark', keywords: ['shark','ocean','scary'] },
      { emoji: '🐙', name: 'octopus', keywords: ['octopus','tentacle'] },
      { emoji: '🐚', name: 'spiral shell', keywords: ['shell','beach'] },
      { emoji: '🪸', name: 'coral', keywords: ['coral','reef','ocean'] },
      { emoji: '🐌', name: 'snail', keywords: ['snail','slow'] },
      { emoji: '🦋', name: 'butterfly', keywords: ['butterfly','beautiful'] },
      { emoji: '🐛', name: 'bug', keywords: ['bug','insect'] },
      { emoji: '🐜', name: 'ant', keywords: ['ant','insect'] },
      { emoji: '🐝', name: 'honeybee', keywords: ['bee','honey'] },
      { emoji: '🪲', name: 'beetle', keywords: ['beetle','insect'] },
      { emoji: '🐞', name: 'lady beetle', keywords: ['ladybug','insect'] },
      { emoji: '🦗', name: 'cricket', keywords: ['cricket','insect'] },
      { emoji: '🪳', name: 'cockroach', keywords: ['cockroach','insect'] },
      { emoji: '🕷', name: 'spider', keywords: ['spider','insect'] },
      { emoji: '🕸', name: 'spider web', keywords: ['web','spider'] },
      { emoji: '🦂', name: 'scorpion', keywords: ['scorpion'] },
      { emoji: '🦟', name: 'mosquito', keywords: ['mosquito','bite'] },
      { emoji: '🪰', name: 'fly', keywords: ['fly','insect'] },
      { emoji: '🪱', name: 'worm', keywords: ['worm','earthworm'] },
      { emoji: '💐', name: 'bouquet', keywords: ['flowers','bouquet'] },
      { emoji: '🌸', name: 'cherry blossom', keywords: ['flower','spring','japan'] },
      { emoji: '💮', name: 'white flower', keywords: ['flower'] },
      { emoji: '🏵', name: 'rosette', keywords: ['flower'] },
      { emoji: '🌹', name: 'rose', keywords: ['rose','flower','love'] },
      { emoji: '🥀', name: 'wilted flower', keywords: ['dead','flower','sad'] },
      { emoji: '🌺', name: 'hibiscus', keywords: ['flower','tropical'] },
      { emoji: '🌻', name: 'sunflower', keywords: ['flower','sun'] },
      { emoji: '🌼', name: 'blossom', keywords: ['flower'] },
      { emoji: '🌷', name: 'tulip', keywords: ['flower','spring'] },
      { emoji: '🌱', name: 'seedling', keywords: ['plant','grow'] },
      { emoji: '🪴', name: 'potted plant', keywords: ['plant','indoor'] },
      { emoji: '🌲', name: 'evergreen tree', keywords: ['tree','pine'] },
      { emoji: '🌳', name: 'deciduous tree', keywords: ['tree'] },
      { emoji: '🌴', name: 'palm tree', keywords: ['palm','tropical','beach'] },
      { emoji: '🌵', name: 'cactus', keywords: ['cactus','desert'] },
      { emoji: '🌾', name: 'sheaf of rice', keywords: ['rice','harvest'] },
      { emoji: '🌿', name: 'herb', keywords: ['herb','plant'] },
      { emoji: '☘', name: 'shamrock', keywords: ['clover','luck','irish'] },
      { emoji: '🍀', name: 'four leaf clover', keywords: ['lucky','clover'] },
      { emoji: '🍁', name: 'maple leaf', keywords: ['maple','autumn','canada'] },
      { emoji: '🍂', name: 'fallen leaf', keywords: ['leaf','autumn'] },
      { emoji: '🍃', name: 'leaf fluttering in wind', keywords: ['leaf','wind'] },
    ]
  },
  {
    id: 'food', label: 'Food & Drink', icon: '🍔',
    emojis: [
      { emoji: '🍇', name: 'grapes', keywords: ['fruit','wine'] },
      { emoji: '🍈', name: 'melon', keywords: ['fruit','melon'] },
      { emoji: '🍉', name: 'watermelon', keywords: ['fruit','summer'] },
      { emoji: '🍊', name: 'tangerine', keywords: ['fruit','orange'] },
      { emoji: '🍋', name: 'lemon', keywords: ['fruit','sour'] },
      { emoji: '🍌', name: 'banana', keywords: ['fruit','banana'] },
      { emoji: '🍍', name: 'pineapple', keywords: ['fruit','tropical'] },
      { emoji: '🥭', name: 'mango', keywords: ['fruit','tropical'] },
      { emoji: '🍎', name: 'red apple', keywords: ['fruit','apple'] },
      { emoji: '🍏', name: 'green apple', keywords: ['fruit','apple'] },
      { emoji: '🍐', name: 'pear', keywords: ['fruit'] },
      { emoji: '🍑', name: 'peach', keywords: ['fruit','butt'] },
      { emoji: '🍒', name: 'cherries', keywords: ['fruit','cherry'] },
      { emoji: '🍓', name: 'strawberry', keywords: ['fruit','berry'] },
      { emoji: '🫐', name: 'blueberries', keywords: ['fruit','berry'] },
      { emoji: '🥝', name: 'kiwi fruit', keywords: ['fruit','kiwi'] },
      { emoji: '🍅', name: 'tomato', keywords: ['vegetable','tomato'] },
      { emoji: '🫒', name: 'olive', keywords: ['olive','oil'] },
      { emoji: '🥥', name: 'coconut', keywords: ['coconut','tropical'] },
      { emoji: '🥑', name: 'avocado', keywords: ['avocado','guac'] },
      { emoji: '🍆', name: 'eggplant', keywords: ['eggplant','aubergine'] },
      { emoji: '🥔', name: 'potato', keywords: ['potato','carb'] },
      { emoji: '🥕', name: 'carrot', keywords: ['carrot','vegetable'] },
      { emoji: '🌽', name: 'ear of corn', keywords: ['corn','maize'] },
      { emoji: '🌶', name: 'hot pepper', keywords: ['pepper','spicy','hot'] },
      { emoji: '🫑', name: 'bell pepper', keywords: ['pepper','vegetable'] },
      { emoji: '🥒', name: 'cucumber', keywords: ['cucumber','pickle'] },
      { emoji: '🥬', name: 'leafy green', keywords: ['salad','lettuce'] },
      { emoji: '🥦', name: 'broccoli', keywords: ['broccoli','vegetable'] },
      { emoji: '🧄', name: 'garlic', keywords: ['garlic','cooking'] },
      { emoji: '🧅', name: 'onion', keywords: ['onion','cry'] },
      { emoji: '🍄', name: 'mushroom', keywords: ['mushroom','fungus'] },
      { emoji: '🥜', name: 'peanuts', keywords: ['peanut','nut'] },
      { emoji: '🫘', name: 'beans', keywords: ['beans','legume'] },
      { emoji: '🌰', name: 'chestnut', keywords: ['chestnut','nut'] },
      { emoji: '🍞', name: 'bread', keywords: ['bread','toast'] },
      { emoji: '🥐', name: 'croissant', keywords: ['bread','french','pastry'] },
      { emoji: '🥖', name: 'baguette bread', keywords: ['bread','french'] },
      { emoji: '🫓', name: 'flatbread', keywords: ['bread','naan','pita'] },
      { emoji: '🥨', name: 'pretzel', keywords: ['pretzel','snack'] },
      { emoji: '🥯', name: 'bagel', keywords: ['bagel','bread'] },
      { emoji: '🥞', name: 'pancakes', keywords: ['pancake','breakfast'] },
      { emoji: '🧇', name: 'waffle', keywords: ['waffle','breakfast'] },
      { emoji: '🧀', name: 'cheese wedge', keywords: ['cheese'] },
      { emoji: '🍖', name: 'meat on bone', keywords: ['meat','food'] },
      { emoji: '🍗', name: 'poultry leg', keywords: ['chicken','turkey','meat'] },
      { emoji: '🥩', name: 'cut of meat', keywords: ['steak','meat'] },
      { emoji: '🥓', name: 'bacon', keywords: ['bacon','meat','breakfast'] },
      { emoji: '🍔', name: 'hamburger', keywords: ['burger','food','fast food'] },
      { emoji: '🍟', name: 'french fries', keywords: ['fries','fast food'] },
      { emoji: '🍕', name: 'pizza', keywords: ['pizza','food'] },
      { emoji: '🌭', name: 'hot dog', keywords: ['hotdog','food'] },
      { emoji: '🥪', name: 'sandwich', keywords: ['sandwich','food'] },
      { emoji: '🌮', name: 'taco', keywords: ['taco','mexican'] },
      { emoji: '🌯', name: 'burrito', keywords: ['burrito','mexican'] },
      { emoji: '🫔', name: 'tamale', keywords: ['tamale','mexican'] },
      { emoji: '🥙', name: 'stuffed flatbread', keywords: ['falafel','wrap'] },
      { emoji: '🧆', name: 'falafel', keywords: ['falafel','food'] },
      { emoji: '🥚', name: 'egg', keywords: ['egg','breakfast'] },
      { emoji: '🍳', name: 'cooking', keywords: ['egg','frying','pan'] },
      { emoji: '🥘', name: 'shallow pan of food', keywords: ['paella','food'] },
      { emoji: '🍲', name: 'pot of food', keywords: ['stew','soup'] },
      { emoji: '🫕', name: 'fondue', keywords: ['fondue','cheese'] },
      { emoji: '🥣', name: 'bowl with spoon', keywords: ['cereal','soup'] },
      { emoji: '🥗', name: 'green salad', keywords: ['salad','healthy'] },
      { emoji: '🍿', name: 'popcorn', keywords: ['popcorn','movie'] },
      { emoji: '🧈', name: 'butter', keywords: ['butter','dairy'] },
      { emoji: '🧂', name: 'salt', keywords: ['salt','seasoning'] },
      { emoji: '🥫', name: 'canned food', keywords: ['can','food'] },
      { emoji: '🍱', name: 'bento box', keywords: ['bento','japanese','food'] },
      { emoji: '🍘', name: 'rice cracker', keywords: ['rice','japanese'] },
      { emoji: '🍙', name: 'rice ball', keywords: ['rice','japanese','onigiri'] },
      { emoji: '🍚', name: 'cooked rice', keywords: ['rice','food'] },
      { emoji: '🍛', name: 'curry rice', keywords: ['curry','rice','food'] },
      { emoji: '🍜', name: 'steaming bowl', keywords: ['ramen','noodles','soup'] },
      { emoji: '🍝', name: 'spaghetti', keywords: ['pasta','italian'] },
      { emoji: '🍠', name: 'roasted sweet potato', keywords: ['sweet potato'] },
      { emoji: '🍢', name: 'oden', keywords: ['oden','japanese'] },
      { emoji: '🍣', name: 'sushi', keywords: ['sushi','japanese','fish'] },
      { emoji: '🍤', name: 'fried shrimp', keywords: ['shrimp','tempura'] },
      { emoji: '🍥', name: 'fish cake with swirl', keywords: ['fish cake','japanese'] },
      { emoji: '🥮', name: 'moon cake', keywords: ['mooncake','chinese'] },
      { emoji: '🍡', name: 'dango', keywords: ['dango','japanese','dessert'] },
      { emoji: '🥟', name: 'dumpling', keywords: ['dumpling','gyoza'] },
      { emoji: '🥠', name: 'fortune cookie', keywords: ['fortune','cookie'] },
      { emoji: '🥡', name: 'takeout box', keywords: ['chinese','takeout'] },
      { emoji: '🍦', name: 'soft ice cream', keywords: ['ice cream','dessert'] },
      { emoji: '🍧', name: 'shaved ice', keywords: ['ice','dessert'] },
      { emoji: '🍨', name: 'ice cream', keywords: ['ice cream','dessert'] },
      { emoji: '🍩', name: 'doughnut', keywords: ['donut','dessert'] },
      { emoji: '🍪', name: 'cookie', keywords: ['cookie','biscuit','dessert'] },
      { emoji: '🎂', name: 'birthday cake', keywords: ['cake','birthday','party'] },
      { emoji: '🍰', name: 'shortcake', keywords: ['cake','dessert'] },
      { emoji: '🧁', name: 'cupcake', keywords: ['cupcake','dessert'] },
      { emoji: '🥧', name: 'pie', keywords: ['pie','dessert'] },
      { emoji: '🍫', name: 'chocolate bar', keywords: ['chocolate','candy'] },
      { emoji: '🍬', name: 'candy', keywords: ['candy','sweet'] },
      { emoji: '🍭', name: 'lollipop', keywords: ['lollipop','candy'] },
      { emoji: '🍮', name: 'custard', keywords: ['pudding','dessert'] },
      { emoji: '🍯', name: 'honey pot', keywords: ['honey','sweet'] },
      { emoji: '🍼', name: 'baby bottle', keywords: ['baby','milk','bottle'] },
      { emoji: '🥛', name: 'glass of milk', keywords: ['milk','drink'] },
      { emoji: '☕', name: 'hot beverage', keywords: ['coffee','tea','hot'] },
      { emoji: '🫖', name: 'teapot', keywords: ['tea','pot'] },
      { emoji: '🍵', name: 'teacup without handle', keywords: ['tea','green tea'] },
      { emoji: '🍶', name: 'sake', keywords: ['sake','japanese','alcohol'] },
      { emoji: '🍾', name: 'bottle with popping cork', keywords: ['champagne','celebrate'] },
      { emoji: '🍷', name: 'wine glass', keywords: ['wine','drink','alcohol'] },
      { emoji: '🍸', name: 'cocktail glass', keywords: ['cocktail','drink','alcohol'] },
      { emoji: '🍹', name: 'tropical drink', keywords: ['cocktail','tropical'] },
      { emoji: '🍺', name: 'beer mug', keywords: ['beer','drink','alcohol'] },
      { emoji: '🍻', name: 'clinking beer mugs', keywords: ['beer','cheers'] },
      { emoji: '🥂', name: 'clinking glasses', keywords: ['cheers','toast'] },
      { emoji: '🥃', name: 'tumbler glass', keywords: ['whiskey','drink'] },
      { emoji: '🫗', name: 'pouring liquid', keywords: ['pour','drink'] },
      { emoji: '🥤', name: 'cup with straw', keywords: ['drink','soda'] },
      { emoji: '🧋', name: 'bubble tea', keywords: ['boba','milk tea'] },
      { emoji: '🧃', name: 'beverage box', keywords: ['juice','box'] },
      { emoji: '🧉', name: 'mate', keywords: ['mate','drink'] },
      { emoji: '🧊', name: 'ice', keywords: ['ice','cold','cube'] },
    ]
  },
  {
    id: 'travel', label: 'Travel & Places', icon: '✈',
    emojis: [
      { emoji: '🌍', name: 'globe showing Europe-Africa', keywords: ['world','earth','globe'] },
      { emoji: '🌎', name: 'globe showing Americas', keywords: ['world','earth','globe'] },
      { emoji: '🌏', name: 'globe showing Asia-Australia', keywords: ['world','earth','globe'] },
      { emoji: '🌐', name: 'globe with meridians', keywords: ['world','internet'] },
      { emoji: '🗺', name: 'world map', keywords: ['map','world'] },
      { emoji: '🧭', name: 'compass', keywords: ['compass','direction','navigate'] },
      { emoji: '🏔', name: 'snow-capped mountain', keywords: ['mountain','snow'] },
      { emoji: '⛰', name: 'mountain', keywords: ['mountain'] },
      { emoji: '🌋', name: 'volcano', keywords: ['volcano','eruption'] },
      { emoji: '🗻', name: 'mount fuji', keywords: ['mountain','japan','fuji'] },
      { emoji: '🏕', name: 'camping', keywords: ['camp','tent','nature'] },
      { emoji: '🏖', name: 'beach with umbrella', keywords: ['beach','vacation'] },
      { emoji: '🏜', name: 'desert', keywords: ['desert','sand'] },
      { emoji: '🏝', name: 'desert island', keywords: ['island','tropical'] },
      { emoji: '🏞', name: 'national park', keywords: ['park','nature'] },
      { emoji: '🏟', name: 'stadium', keywords: ['stadium','sports'] },
      { emoji: '🏛', name: 'classical building', keywords: ['building','museum'] },
      { emoji: '🏗', name: 'building construction', keywords: ['construction','building'] },
      { emoji: '🧱', name: 'brick', keywords: ['brick','wall'] },
      { emoji: '🪨', name: 'rock', keywords: ['rock','stone'] },
      { emoji: '🪵', name: 'wood', keywords: ['wood','log'] },
      { emoji: '🛖', name: 'hut', keywords: ['hut','house'] },
      { emoji: '🏠', name: 'house', keywords: ['house','home'] },
      { emoji: '🏡', name: 'house with garden', keywords: ['house','garden'] },
      { emoji: '🏢', name: 'office building', keywords: ['office','building','work'] },
      { emoji: '🏣', name: 'Japanese post office', keywords: ['post office','japan'] },
      { emoji: '🏥', name: 'hospital', keywords: ['hospital','medical'] },
      { emoji: '🏦', name: 'bank', keywords: ['bank','money'] },
      { emoji: '🏨', name: 'hotel', keywords: ['hotel','travel'] },
      { emoji: '🏪', name: 'convenience store', keywords: ['store','shop'] },
      { emoji: '🏫', name: 'school', keywords: ['school','education'] },
      { emoji: '🏬', name: 'department store', keywords: ['store','shopping'] },
      { emoji: '🏭', name: 'factory', keywords: ['factory','industry'] },
      { emoji: '🏯', name: 'Japanese castle', keywords: ['castle','japan'] },
      { emoji: '🏰', name: 'castle', keywords: ['castle','medieval'] },
      { emoji: '💒', name: 'wedding', keywords: ['wedding','marriage','church'] },
      { emoji: '🗼', name: 'Tokyo tower', keywords: ['tower','tokyo','japan'] },
      { emoji: '🗽', name: 'Statue of Liberty', keywords: ['liberty','america','nyc'] },
      { emoji: '⛪', name: 'church', keywords: ['church','religion'] },
      { emoji: '🕌', name: 'mosque', keywords: ['mosque','islam'] },
      { emoji: '🕍', name: 'synagogue', keywords: ['synagogue','jewish'] },
      { emoji: '⛩', name: 'shinto shrine', keywords: ['shrine','japan'] },
      { emoji: '🕋', name: 'kaaba', keywords: ['kaaba','islam','mecca'] },
      { emoji: '⛲', name: 'fountain', keywords: ['fountain','water'] },
      { emoji: '⛺', name: 'tent', keywords: ['tent','camping'] },
      { emoji: '🌁', name: 'foggy', keywords: ['fog','weather'] },
      { emoji: '🌃', name: 'night with stars', keywords: ['night','stars','city'] },
      { emoji: '🏙', name: 'cityscape', keywords: ['city','skyline'] },
      { emoji: '🌄', name: 'sunrise over mountains', keywords: ['sunrise','morning'] },
      { emoji: '🌅', name: 'sunrise', keywords: ['sunrise','morning'] },
      { emoji: '🌆', name: 'cityscape at dusk', keywords: ['city','sunset'] },
      { emoji: '🌇', name: 'sunset', keywords: ['sunset','evening'] },
      { emoji: '🌉', name: 'bridge at night', keywords: ['bridge','night'] },
      { emoji: '🛣', name: 'motorway', keywords: ['road','highway'] },
      { emoji: '🛤', name: 'railway track', keywords: ['train','railway'] },
      { emoji: '✈', name: 'airplane', keywords: ['plane','fly','travel'] },
      { emoji: '🛩', name: 'small airplane', keywords: ['plane','fly'] },
      { emoji: '🛫', name: 'airplane departure', keywords: ['plane','takeoff'] },
      { emoji: '🛬', name: 'airplane arrival', keywords: ['plane','landing'] },
      { emoji: '🚀', name: 'rocket', keywords: ['rocket','space','launch'] },
      { emoji: '🛸', name: 'flying saucer', keywords: ['ufo','alien'] },
      { emoji: '🚁', name: 'helicopter', keywords: ['helicopter','fly'] },
      { emoji: '🚂', name: 'locomotive', keywords: ['train','steam'] },
      { emoji: '🚃', name: 'railway car', keywords: ['train'] },
      { emoji: '🚄', name: 'high-speed train', keywords: ['train','fast','bullet'] },
      { emoji: '🚅', name: 'bullet train', keywords: ['train','fast','shinkansen'] },
      { emoji: '🚗', name: 'automobile', keywords: ['car','drive'] },
      { emoji: '🚕', name: 'taxi', keywords: ['taxi','cab'] },
      { emoji: '🚌', name: 'bus', keywords: ['bus','transit'] },
      { emoji: '🛴', name: 'kick scooter', keywords: ['scooter'] },
      { emoji: '🚲', name: 'bicycle', keywords: ['bike','cycling'] },
      { emoji: '🛵', name: 'motor scooter', keywords: ['scooter','vespa'] },
      { emoji: '🏍', name: 'motorcycle', keywords: ['motorcycle','bike'] },
      { emoji: '🚢', name: 'ship', keywords: ['ship','boat','cruise'] },
      { emoji: '⛵', name: 'sailboat', keywords: ['sailboat','yacht'] },
      { emoji: '🚤', name: 'speedboat', keywords: ['speedboat','boat'] },
      { emoji: '🚧', name: 'construction', keywords: ['construction','barrier'] },
      { emoji: '⛽', name: 'fuel pump', keywords: ['gas','fuel','station'] },
      { emoji: '🚥', name: 'horizontal traffic light', keywords: ['traffic','light'] },
      { emoji: '🚦', name: 'vertical traffic light', keywords: ['traffic','light'] },
      { emoji: '🚏', name: 'bus stop', keywords: ['bus','stop'] },
    ]
  },
  {
    id: 'activities', label: 'Activities', icon: '⚽',
    emojis: [
      { emoji: '⚽', name: 'soccer ball', keywords: ['soccer','football','sport'] },
      { emoji: '🏀', name: 'basketball', keywords: ['basketball','sport'] },
      { emoji: '🏈', name: 'american football', keywords: ['football','sport'] },
      { emoji: '⚾', name: 'baseball', keywords: ['baseball','sport'] },
      { emoji: '🥎', name: 'softball', keywords: ['softball','sport'] },
      { emoji: '🎾', name: 'tennis', keywords: ['tennis','sport'] },
      { emoji: '🏐', name: 'volleyball', keywords: ['volleyball','sport'] },
      { emoji: '🏉', name: 'rugby football', keywords: ['rugby','sport'] },
      { emoji: '🥏', name: 'flying disc', keywords: ['frisbee','disc'] },
      { emoji: '🎳', name: 'bowling', keywords: ['bowling','sport'] },
      { emoji: '🏏', name: 'cricket game', keywords: ['cricket','sport'] },
      { emoji: '🏑', name: 'field hockey', keywords: ['hockey','sport'] },
      { emoji: '🏒', name: 'ice hockey', keywords: ['hockey','sport','ice'] },
      { emoji: '🥍', name: 'lacrosse', keywords: ['lacrosse','sport'] },
      { emoji: '🏓', name: 'ping pong', keywords: ['table tennis','sport'] },
      { emoji: '🏸', name: 'badminton', keywords: ['badminton','sport'] },
      { emoji: '🥊', name: 'boxing glove', keywords: ['boxing','sport','fight'] },
      { emoji: '🥋', name: 'martial arts uniform', keywords: ['karate','martial arts'] },
      { emoji: '🥅', name: 'goal net', keywords: ['goal','sport'] },
      { emoji: '⛳', name: 'flag in hole', keywords: ['golf','sport'] },
      { emoji: '⛸', name: 'ice skate', keywords: ['ice skating','sport'] },
      { emoji: '🎣', name: 'fishing pole', keywords: ['fishing','sport'] },
      { emoji: '🤿', name: 'diving mask', keywords: ['diving','snorkel'] },
      { emoji: '🎽', name: 'running shirt', keywords: ['running','sport'] },
      { emoji: '🎿', name: 'skis', keywords: ['skiing','winter','sport'] },
      { emoji: '🛷', name: 'sled', keywords: ['sled','winter'] },
      { emoji: '🥌', name: 'curling stone', keywords: ['curling','sport'] },
      { emoji: '🎯', name: 'bullseye', keywords: ['target','dart','aim'] },
      { emoji: '🪀', name: 'yo-yo', keywords: ['yo-yo','toy'] },
      { emoji: '🪁', name: 'kite', keywords: ['kite','fly'] },
      { emoji: '🎱', name: 'pool 8 ball', keywords: ['billiards','pool'] },
      { emoji: '🔮', name: 'crystal ball', keywords: ['crystal','fortune','magic'] },
      { emoji: '🪄', name: 'magic wand', keywords: ['magic','wand'] },
      { emoji: '🧿', name: 'nazar amulet', keywords: ['evil eye','amulet'] },
      { emoji: '🪬', name: 'hamsa', keywords: ['hamsa','protection'] },
      { emoji: '🎮', name: 'video game', keywords: ['game','controller','play'] },
      { emoji: '🕹', name: 'joystick', keywords: ['game','joystick','arcade'] },
      { emoji: '🎰', name: 'slot machine', keywords: ['casino','gamble','slot'] },
      { emoji: '🎲', name: 'game die', keywords: ['dice','game','random'] },
      { emoji: '🧩', name: 'puzzle piece', keywords: ['puzzle','jigsaw'] },
      { emoji: '🧸', name: 'teddy bear', keywords: ['teddy','bear','toy'] },
      { emoji: '🪅', name: 'pinata', keywords: ['pinata','party'] },
      { emoji: '🪩', name: 'mirror ball', keywords: ['disco','party','dance'] },
      { emoji: '🪆', name: 'nesting dolls', keywords: ['matryoshka','russian'] },
      { emoji: '♠', name: 'spade suit', keywords: ['spade','card','poker'] },
      { emoji: '♥', name: 'heart suit', keywords: ['heart','card','poker'] },
      { emoji: '♦', name: 'diamond suit', keywords: ['diamond','card','poker'] },
      { emoji: '♣', name: 'club suit', keywords: ['club','card','poker'] },
      { emoji: '♟', name: 'chess pawn', keywords: ['chess','pawn'] },
      { emoji: '🃏', name: 'joker', keywords: ['joker','card','wild'] },
      { emoji: '🀄', name: 'mahjong red dragon', keywords: ['mahjong','game'] },
      { emoji: '🎴', name: 'flower playing cards', keywords: ['cards','game'] },
      { emoji: '🎭', name: 'performing arts', keywords: ['theater','drama','masks'] },
      { emoji: '🖼', name: 'framed picture', keywords: ['art','picture','painting'] },
      { emoji: '🎨', name: 'artist palette', keywords: ['art','paint','palette'] },
      { emoji: '🧵', name: 'thread', keywords: ['thread','sewing'] },
      { emoji: '🪡', name: 'sewing needle', keywords: ['sewing','needle'] },
      { emoji: '🧶', name: 'yarn', keywords: ['yarn','knitting','ball'] },
      { emoji: '🪢', name: 'knot', keywords: ['knot','rope'] },
      { emoji: '🎵', name: 'musical note', keywords: ['music','note'] },
      { emoji: '🎶', name: 'musical notes', keywords: ['music','notes','melody'] },
      { emoji: '🎙', name: 'studio microphone', keywords: ['microphone','record'] },
      { emoji: '🎤', name: 'microphone', keywords: ['karaoke','sing'] },
      { emoji: '🎧', name: 'headphone', keywords: ['headphones','music','listen'] },
      { emoji: '🎷', name: 'saxophone', keywords: ['sax','jazz','music'] },
      { emoji: '🪗', name: 'accordion', keywords: ['accordion','music'] },
      { emoji: '🎸', name: 'guitar', keywords: ['guitar','music','rock'] },
      { emoji: '🎹', name: 'musical keyboard', keywords: ['piano','keyboard','music'] },
      { emoji: '🎺', name: 'trumpet', keywords: ['trumpet','music','brass'] },
      { emoji: '🎻', name: 'violin', keywords: ['violin','music','classical'] },
      { emoji: '🪕', name: 'banjo', keywords: ['banjo','music','country'] },
      { emoji: '🥁', name: 'drum', keywords: ['drum','music','beat'] },
      { emoji: '🪘', name: 'long drum', keywords: ['drum','music'] },
      { emoji: '🪇', name: 'maracas', keywords: ['maracas','music','shake'] },
      { emoji: '🪈', name: 'flute', keywords: ['flute','music','woodwind'] },
    ]
  },
  {
    id: 'objects', label: 'Objects', icon: '💻',
    emojis: [
      { emoji: '💻', name: 'laptop', keywords: ['computer','laptop','code'] },
      { emoji: '🖥', name: 'desktop computer', keywords: ['computer','desktop','pc'] },
      { emoji: '🖨', name: 'printer', keywords: ['printer','print'] },
      { emoji: '⌨', name: 'keyboard', keywords: ['keyboard','type'] },
      { emoji: '🖱', name: 'computer mouse', keywords: ['mouse','click'] },
      { emoji: '🖲', name: 'trackball', keywords: ['trackball'] },
      { emoji: '💽', name: 'computer disk', keywords: ['disk','minidisk'] },
      { emoji: '💾', name: 'floppy disk', keywords: ['floppy','save','disk'] },
      { emoji: '💿', name: 'optical disk', keywords: ['cd','disk'] },
      { emoji: '📀', name: 'dvd', keywords: ['dvd','disk'] },
      { emoji: '🧮', name: 'abacus', keywords: ['abacus','math','count'] },
      { emoji: '📱', name: 'mobile phone', keywords: ['phone','mobile','cell'] },
      { emoji: '📲', name: 'mobile phone with arrow', keywords: ['phone','call'] },
      { emoji: '☎', name: 'telephone', keywords: ['phone','call','telephone'] },
      { emoji: '📞', name: 'telephone receiver', keywords: ['phone','call'] },
      { emoji: '📟', name: 'pager', keywords: ['pager','90s'] },
      { emoji: '📠', name: 'fax machine', keywords: ['fax','machine'] },
      { emoji: '🔋', name: 'battery', keywords: ['battery','power'] },
      { emoji: '🪫', name: 'low battery', keywords: ['battery','low','dying'] },
      { emoji: '🔌', name: 'electric plug', keywords: ['plug','electric','power'] },
      { emoji: '💡', name: 'light bulb', keywords: ['idea','light','bulb'] },
      { emoji: '🔦', name: 'flashlight', keywords: ['flashlight','torch','light'] },
      { emoji: '🕯', name: 'candle', keywords: ['candle','light','flame'] },
      { emoji: '🪔', name: 'diya lamp', keywords: ['lamp','diya','light'] },
      { emoji: '🧯', name: 'fire extinguisher', keywords: ['fire','safety'] },
      { emoji: '💰', name: 'money bag', keywords: ['money','dollar','rich'] },
      { emoji: '🪙', name: 'coin', keywords: ['coin','money'] },
      { emoji: '💵', name: 'dollar banknote', keywords: ['money','dollar'] },
      { emoji: '💶', name: 'euro banknote', keywords: ['money','euro'] },
      { emoji: '💷', name: 'pound banknote', keywords: ['money','pound'] },
      { emoji: '💸', name: 'money with wings', keywords: ['money','spend','fly'] },
      { emoji: '💳', name: 'credit card', keywords: ['credit','card','payment'] },
      { emoji: '📧', name: 'e-mail', keywords: ['email','mail'] },
      { emoji: '📨', name: 'incoming envelope', keywords: ['email','mail','inbox'] },
      { emoji: '📩', name: 'envelope with arrow', keywords: ['email','send'] },
      { emoji: '📪', name: 'open mailbox with lowered flag', keywords: ['mailbox'] },
      { emoji: '📫', name: 'closed mailbox with raised flag', keywords: ['mailbox','mail'] },
      { emoji: '📬', name: 'open mailbox with raised flag', keywords: ['mailbox'] },
      { emoji: '📭', name: 'closed mailbox with lowered flag', keywords: ['mailbox'] },
      { emoji: '📦', name: 'package', keywords: ['package','box','delivery'] },
      { emoji: '📮', name: 'postbox', keywords: ['mail','post'] },
      { emoji: '📝', name: 'memo', keywords: ['memo','write','note'] },
      { emoji: '📁', name: 'file folder', keywords: ['folder','file'] },
      { emoji: '📂', name: 'open file folder', keywords: ['folder','file','open'] },
      { emoji: '📅', name: 'calendar', keywords: ['calendar','date'] },
      { emoji: '📆', name: 'tear-off calendar', keywords: ['calendar','date'] },
      { emoji: '📇', name: 'card index', keywords: ['index','card','rolodex'] },
      { emoji: '📈', name: 'chart increasing', keywords: ['chart','graph','up'] },
      { emoji: '📉', name: 'chart decreasing', keywords: ['chart','graph','down'] },
      { emoji: '📊', name: 'bar chart', keywords: ['chart','graph','bar'] },
      { emoji: '📋', name: 'clipboard', keywords: ['clipboard','list'] },
      { emoji: '📌', name: 'pushpin', keywords: ['pin','pushpin'] },
      { emoji: '📍', name: 'round pushpin', keywords: ['pin','location'] },
      { emoji: '📎', name: 'paperclip', keywords: ['paperclip','attach'] },
      { emoji: '🖇', name: 'linked paperclips', keywords: ['paperclip','link'] },
      { emoji: '📏', name: 'straight ruler', keywords: ['ruler','measure'] },
      { emoji: '📐', name: 'triangular ruler', keywords: ['ruler','measure','triangle'] },
      { emoji: '✂', name: 'scissors', keywords: ['scissors','cut'] },
      { emoji: '🗃', name: 'card file box', keywords: ['file','box','archive'] },
      { emoji: '🗄', name: 'file cabinet', keywords: ['file','cabinet','archive'] },
      { emoji: '🗑', name: 'wastebasket', keywords: ['trash','delete','bin'] },
      { emoji: '🔒', name: 'locked', keywords: ['lock','locked','secure'] },
      { emoji: '🔓', name: 'unlocked', keywords: ['unlock','open'] },
      { emoji: '🔏', name: 'locked with pen', keywords: ['lock','privacy'] },
      { emoji: '🔐', name: 'locked with key', keywords: ['lock','key','secure'] },
      { emoji: '🔑', name: 'key', keywords: ['key','lock','password'] },
      { emoji: '🗝', name: 'old key', keywords: ['key','old','vintage'] },
      { emoji: '🔨', name: 'hammer', keywords: ['hammer','tool','build'] },
      { emoji: '🪓', name: 'axe', keywords: ['axe','chop'] },
      { emoji: '⛏', name: 'pick', keywords: ['pick','mine'] },
      { emoji: '🔩', name: 'nut and bolt', keywords: ['bolt','nut','hardware'] },
      { emoji: '⚙', name: 'gear', keywords: ['gear','settings','cog'] },
      { emoji: '🔗', name: 'link', keywords: ['link','chain','url'] },
      { emoji: '⛓', name: 'chains', keywords: ['chain','link'] },
      { emoji: '🪝', name: 'hook', keywords: ['hook','pirate'] },
      { emoji: '🧰', name: 'toolbox', keywords: ['tool','toolbox','fix'] },
      { emoji: '🧲', name: 'magnet', keywords: ['magnet','attract'] },
      { emoji: '🪜', name: 'ladder', keywords: ['ladder','climb'] },
      { emoji: '🔍', name: 'magnifying glass tilted left', keywords: ['search','find','zoom'] },
      { emoji: '🔎', name: 'magnifying glass tilted right', keywords: ['search','find','zoom'] },
    ]
  },
  {
    id: 'symbols', label: 'Symbols', icon: '❤',
    emojis: [
      { emoji: '❤', name: 'red heart', keywords: ['love','heart'] },
      { emoji: '🔥', name: 'fire', keywords: ['fire','hot','lit'] },
      { emoji: '⭐', name: 'star', keywords: ['star','favorite'] },
      { emoji: '🌟', name: 'glowing star', keywords: ['star','sparkle'] },
      { emoji: '✨', name: 'sparkles', keywords: ['sparkle','shine','clean'] },
      { emoji: '⚡', name: 'high voltage', keywords: ['lightning','electric','zap'] },
      { emoji: '💥', name: 'collision', keywords: ['boom','crash','explosion'] },
      { emoji: '✔', name: 'check mark', keywords: ['check','done','yes'] },
      { emoji: '❌', name: 'cross mark', keywords: ['x','no','wrong','delete'] },
      { emoji: '❎', name: 'cross mark button', keywords: ['x','no','wrong'] },
      { emoji: '➕', name: 'plus', keywords: ['plus','add'] },
      { emoji: '➖', name: 'minus', keywords: ['minus','subtract'] },
      { emoji: '➗', name: 'divide', keywords: ['divide','division'] },
      { emoji: '✖', name: 'multiply', keywords: ['multiply','times'] },
      { emoji: '♾', name: 'infinity', keywords: ['infinity','forever'] },
      { emoji: '⁉', name: 'exclamation question mark', keywords: ['interrobang'] },
      { emoji: '❓', name: 'question mark', keywords: ['question','what'] },
      { emoji: '❔', name: 'white question mark', keywords: ['question'] },
      { emoji: '❕', name: 'white exclamation mark', keywords: ['exclamation'] },
      { emoji: '❗', name: 'exclamation mark', keywords: ['exclamation','warning'] },
      { emoji: '‼', name: 'double exclamation mark', keywords: ['exclamation','alert'] },
      { emoji: '⚠', name: 'warning', keywords: ['warning','caution','alert'] },
      { emoji: '♻', name: 'recycling symbol', keywords: ['recycle','environment'] },
      { emoji: '⚛', name: 'atom symbol', keywords: ['atom','science','physics'] },
      { emoji: '🔰', name: 'Japanese symbol for beginner', keywords: ['beginner','japan'] },
      { emoji: '♈', name: 'Aries', keywords: ['aries','zodiac'] },
      { emoji: '♉', name: 'Taurus', keywords: ['taurus','zodiac'] },
      { emoji: '♊', name: 'Gemini', keywords: ['gemini','zodiac'] },
      { emoji: '♋', name: 'Cancer', keywords: ['cancer','zodiac'] },
      { emoji: '♌', name: 'Leo', keywords: ['leo','zodiac'] },
      { emoji: '♍', name: 'Virgo', keywords: ['virgo','zodiac'] },
      { emoji: '♎', name: 'Libra', keywords: ['libra','zodiac'] },
      { emoji: '♏', name: 'Scorpio', keywords: ['scorpio','zodiac'] },
      { emoji: '♐', name: 'Sagittarius', keywords: ['sagittarius','zodiac'] },
      { emoji: '♑', name: 'Capricorn', keywords: ['capricorn','zodiac'] },
      { emoji: '♒', name: 'Aquarius', keywords: ['aquarius','zodiac'] },
      { emoji: '♓', name: 'Pisces', keywords: ['pisces','zodiac'] },
      { emoji: '⛎', name: 'Ophiuchus', keywords: ['ophiuchus','zodiac'] },
      { emoji: '🔀', name: 'shuffle tracks button', keywords: ['shuffle','random'] },
      { emoji: '🔁', name: 'repeat button', keywords: ['repeat','loop'] },
      { emoji: '🔂', name: 'repeat single button', keywords: ['repeat','one'] },
      { emoji: '▶', name: 'play button', keywords: ['play','start'] },
      { emoji: '⏩', name: 'fast-forward button', keywords: ['forward','fast'] },
      { emoji: '⏭', name: 'next track button', keywords: ['next','skip'] },
      { emoji: '⏯', name: 'play or pause button', keywords: ['play','pause'] },
      { emoji: '◀', name: 'reverse button', keywords: ['reverse','back'] },
      { emoji: '⏪', name: 'fast reverse button', keywords: ['rewind','back'] },
      { emoji: '⏮', name: 'last track button', keywords: ['previous','back'] },
      { emoji: '⏸', name: 'pause button', keywords: ['pause','stop'] },
      { emoji: '⏹', name: 'stop button', keywords: ['stop'] },
      { emoji: '⏺', name: 'record button', keywords: ['record'] },
      { emoji: '🎵', name: 'musical note', keywords: ['music','note'] },
      { emoji: '📳', name: 'vibration mode', keywords: ['phone','vibrate'] },
      { emoji: '📴', name: 'mobile phone off', keywords: ['phone','off','silent'] },
      { emoji: '♀', name: 'female sign', keywords: ['female','woman','gender'] },
      { emoji: '♂', name: 'male sign', keywords: ['male','man','gender'] },
      { emoji: '⚧', name: 'transgender symbol', keywords: ['transgender','gender'] },
      { emoji: '💲', name: 'heavy dollar sign', keywords: ['dollar','money'] },
      { emoji: '©', name: 'copyright', keywords: ['copyright','c'] },
      { emoji: '®', name: 'registered', keywords: ['registered','trademark'] },
      { emoji: '™', name: 'trade mark', keywords: ['trademark','tm'] },
      { emoji: '#️⃣', name: 'keycap: #', keywords: ['hash','pound','number'] },
      { emoji: '*️⃣', name: 'keycap: *', keywords: ['asterisk','star'] },
      { emoji: '0️⃣', name: 'keycap: 0', keywords: ['zero','0'] },
      { emoji: '1️⃣', name: 'keycap: 1', keywords: ['one','1'] },
      { emoji: '2️⃣', name: 'keycap: 2', keywords: ['two','2'] },
      { emoji: '3️⃣', name: 'keycap: 3', keywords: ['three','3'] },
      { emoji: '4️⃣', name: 'keycap: 4', keywords: ['four','4'] },
      { emoji: '5️⃣', name: 'keycap: 5', keywords: ['five','5'] },
      { emoji: '6️⃣', name: 'keycap: 6', keywords: ['six','6'] },
      { emoji: '7️⃣', name: 'keycap: 7', keywords: ['seven','7'] },
      { emoji: '8️⃣', name: 'keycap: 8', keywords: ['eight','8'] },
      { emoji: '9️⃣', name: 'keycap: 9', keywords: ['nine','9'] },
      { emoji: '🔟', name: 'keycap: 10', keywords: ['ten','10'] },
      { emoji: '🔠', name: 'input latin uppercase', keywords: ['abc','uppercase'] },
      { emoji: '🔡', name: 'input latin lowercase', keywords: ['abc','lowercase'] },
      { emoji: '🔢', name: 'input numbers', keywords: ['123','numbers'] },
      { emoji: '🔣', name: 'input symbols', keywords: ['symbols','characters'] },
      { emoji: '🔤', name: 'input latin letters', keywords: ['abc','letters'] },
      { emoji: '🅰', name: 'A button (blood type)', keywords: ['a','blood'] },
      { emoji: '🆎', name: 'AB button (blood type)', keywords: ['ab','blood'] },
      { emoji: '🅱', name: 'B button (blood type)', keywords: ['b','blood'] },
      { emoji: '🆑', name: 'CL button', keywords: ['clear'] },
      { emoji: '🆒', name: 'COOL button', keywords: ['cool'] },
      { emoji: '🆓', name: 'FREE button', keywords: ['free'] },
      { emoji: '🆔', name: 'ID button', keywords: ['id','identity'] },
      { emoji: '🆕', name: 'NEW button', keywords: ['new'] },
      { emoji: '🆖', name: 'NG button', keywords: ['ng','no good'] },
      { emoji: '🆗', name: 'OK button', keywords: ['ok','yes'] },
      { emoji: '🆘', name: 'SOS button', keywords: ['sos','help','emergency'] },
      { emoji: '🆙', name: 'UP! button', keywords: ['up'] },
      { emoji: '🆚', name: 'VS button', keywords: ['versus','vs','fight'] },
    ]
  },
  {
    id: 'flags', label: 'Flags', icon: '🏴',
    emojis: [
      { emoji: '🏁', name: 'chequered flag', keywords: ['flag','race','finish'] },
      { emoji: '🚩', name: 'triangular flag', keywords: ['flag','pennant'] },
      { emoji: '🏳', name: 'white flag', keywords: ['flag','surrender','peace'] },
      { emoji: '🏳️‍🌈', name: 'rainbow flag', keywords: ['flag','pride','lgbtq','rainbow'] },
      { emoji: '🏳️‍⚧️', name: 'transgender flag', keywords: ['flag','transgender','pride'] },
      { emoji: '🏴', name: 'black flag', keywords: ['flag','pirate'] },
      { emoji: '🏴‍☠️', name: 'pirate flag', keywords: ['flag','pirate','skull'] },
      { emoji: '🇺🇸', name: 'flag: United States', keywords: ['flag','us','usa','america'] },
      { emoji: '🇬🇧', name: 'flag: United Kingdom', keywords: ['flag','uk','britain','england'] },
      { emoji: '🇨🇦', name: 'flag: Canada', keywords: ['flag','canada'] },
      { emoji: '🇦🇺', name: 'flag: Australia', keywords: ['flag','australia'] },
      { emoji: '🇩🇪', name: 'flag: Germany', keywords: ['flag','germany','deutsch'] },
      { emoji: '🇫🇷', name: 'flag: France', keywords: ['flag','france','french'] },
      { emoji: '🇪🇸', name: 'flag: Spain', keywords: ['flag','spain','espana'] },
      { emoji: '🇮🇹', name: 'flag: Italy', keywords: ['flag','italy','italian'] },
      { emoji: '🇵🇹', name: 'flag: Portugal', keywords: ['flag','portugal'] },
      { emoji: '🇧🇷', name: 'flag: Brazil', keywords: ['flag','brazil','brasil'] },
      { emoji: '🇲🇽', name: 'flag: Mexico', keywords: ['flag','mexico'] },
      { emoji: '🇦🇷', name: 'flag: Argentina', keywords: ['flag','argentina'] },
      { emoji: '🇨🇴', name: 'flag: Colombia', keywords: ['flag','colombia'] },
      { emoji: '🇨🇱', name: 'flag: Chile', keywords: ['flag','chile'] },
      { emoji: '🇵🇪', name: 'flag: Peru', keywords: ['flag','peru'] },
      { emoji: '🇯🇵', name: 'flag: Japan', keywords: ['flag','japan','japanese'] },
      { emoji: '🇰🇷', name: 'flag: South Korea', keywords: ['flag','korea','korean'] },
      { emoji: '🇨🇳', name: 'flag: China', keywords: ['flag','china','chinese'] },
      { emoji: '🇮🇳', name: 'flag: India', keywords: ['flag','india','indian'] },
      { emoji: '🇷🇺', name: 'flag: Russia', keywords: ['flag','russia','russian'] },
      { emoji: '🇸🇦', name: 'flag: Saudi Arabia', keywords: ['flag','saudi','arabia'] },
      { emoji: '🇦🇪', name: 'flag: United Arab Emirates', keywords: ['flag','uae','emirates','dubai'] },
      { emoji: '🇹🇷', name: 'flag: Turkey', keywords: ['flag','turkey','turkish'] },
      { emoji: '🇮🇱', name: 'flag: Israel', keywords: ['flag','israel'] },
      { emoji: '🇪🇬', name: 'flag: Egypt', keywords: ['flag','egypt'] },
      { emoji: '🇳🇬', name: 'flag: Nigeria', keywords: ['flag','nigeria'] },
      { emoji: '🇿🇦', name: 'flag: South Africa', keywords: ['flag','south africa'] },
      { emoji: '🇰🇪', name: 'flag: Kenya', keywords: ['flag','kenya'] },
      { emoji: '🇸🇪', name: 'flag: Sweden', keywords: ['flag','sweden','swedish'] },
      { emoji: '🇳🇴', name: 'flag: Norway', keywords: ['flag','norway'] },
      { emoji: '🇩🇰', name: 'flag: Denmark', keywords: ['flag','denmark'] },
      { emoji: '🇫🇮', name: 'flag: Finland', keywords: ['flag','finland'] },
      { emoji: '🇳🇱', name: 'flag: Netherlands', keywords: ['flag','netherlands','dutch','holland'] },
      { emoji: '🇧🇪', name: 'flag: Belgium', keywords: ['flag','belgium'] },
      { emoji: '🇨🇭', name: 'flag: Switzerland', keywords: ['flag','switzerland','swiss'] },
      { emoji: '🇦🇹', name: 'flag: Austria', keywords: ['flag','austria'] },
      { emoji: '🇵🇱', name: 'flag: Poland', keywords: ['flag','poland','polish'] },
      { emoji: '🇬🇷', name: 'flag: Greece', keywords: ['flag','greece','greek'] },
      { emoji: '🇮🇪', name: 'flag: Ireland', keywords: ['flag','ireland','irish'] },
      { emoji: '🇮🇩', name: 'flag: Indonesia', keywords: ['flag','indonesia'] },
      { emoji: '🇵🇭', name: 'flag: Philippines', keywords: ['flag','philippines'] },
      { emoji: '🇹🇭', name: 'flag: Thailand', keywords: ['flag','thailand','thai'] },
      { emoji: '🇻🇳', name: 'flag: Vietnam', keywords: ['flag','vietnam'] },
      { emoji: '🇸🇬', name: 'flag: Singapore', keywords: ['flag','singapore'] },
      { emoji: '🇲🇾', name: 'flag: Malaysia', keywords: ['flag','malaysia'] },
      { emoji: '🇳🇿', name: 'flag: New Zealand', keywords: ['flag','new zealand','nz'] },
      { emoji: '🇵🇷', name: 'flag: Puerto Rico', keywords: ['flag','puerto rico'] },
      { emoji: '🇨🇺', name: 'flag: Cuba', keywords: ['flag','cuba'] },
      { emoji: '🇨🇷', name: 'flag: Costa Rica', keywords: ['flag','costa rica'] },
      { emoji: '🇵🇦', name: 'flag: Panama', keywords: ['flag','panama'] },
      { emoji: '🇪🇨', name: 'flag: Ecuador', keywords: ['flag','ecuador'] },
      { emoji: '🇺🇾', name: 'flag: Uruguay', keywords: ['flag','uruguay'] },
      { emoji: '🇵🇾', name: 'flag: Paraguay', keywords: ['flag','paraguay'] },
      { emoji: '🇧🇴', name: 'flag: Bolivia', keywords: ['flag','bolivia'] },
      { emoji: '🇻🇪', name: 'flag: Venezuela', keywords: ['flag','venezuela'] },
      { emoji: '🇩🇴', name: 'flag: Dominican Republic', keywords: ['flag','dominican'] },
      { emoji: '🇭🇳', name: 'flag: Honduras', keywords: ['flag','honduras'] },
      { emoji: '🇬🇹', name: 'flag: Guatemala', keywords: ['flag','guatemala'] },
      { emoji: '🇸🇻', name: 'flag: El Salvador', keywords: ['flag','el salvador'] },
      { emoji: '🇳🇮', name: 'flag: Nicaragua', keywords: ['flag','nicaragua'] },
    ]
  },
];

@Component({
  selector: 'app-emoji-picker',
  templateUrl: './emoji-picker.component.html',
  styleUrls: ['./emoji-picker.component.css'],
  standalone: false
})
export class EmojiPickerComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Emoji Picker & Search — 500+ emojis, copy as emoji, HTML entity, or Unicode. No sign-up!')}&url=${encodeURIComponent(SITE_URL + '/tools/emoji-picker')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/emoji-picker')}`;

  readonly categories = EMOJI_DATA;
  readonly skinTones = SKIN_TONES;

  // State
  searchQuery = '';
  activeCategoryId = EMOJI_DATA[0].id;
  selectedSkinToneIndex = 0;
  copyFormat: CopyFormat = 'emoji';
  gridSize: 'small' | 'medium' | 'large' = 'medium';
  selectedEmoji: SelectedEmoji | null = null;
  recentEmojis: string[] = [];
  copied = false;
  copiedText = '';
  showSkinTonePicker = false;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Computed
  filteredCategories: EmojiCategory[] = [];
  flatFilteredCount = 0;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadRecent();
    this.applyFilter();
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  onSearchInput(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.applyFilter(), 150);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilter();
  }

  private applyFilter(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.filteredCategories = this.categories;
    } else {
      this.filteredCategories = this.categories
        .map(cat => ({
          ...cat,
          emojis: cat.emojis.filter(e =>
            e.name.toLowerCase().includes(q) ||
            e.keywords.some(k => k.includes(q))
          )
        }))
        .filter(cat => cat.emojis.length > 0);
    }
    this.flatFilteredCount = this.filteredCategories.reduce((sum, c) => sum + c.emojis.length, 0);
  }

  // ── Category tabs ─────────────────────────────────────────────────────────

  setActiveCategory(id: string): void {
    this.activeCategoryId = id;
    if (this.isBrowser) {
      const el = document.getElementById('ep-cat-' + id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ── Skin tone ─────────────────────────────────────────────────────────────

  toggleSkinTonePicker(): void {
    this.showSkinTonePicker = !this.showSkinTonePicker;
  }

  selectSkinTone(index: number): void {
    this.selectedSkinToneIndex = index;
    this.showSkinTonePicker = false;
  }

  applySkinTone(emoji: string): string {
    if (this.selectedSkinToneIndex === 0) return emoji;
    if (!SKIN_TONE_COMPATIBLE.has(emoji)) return emoji;
    return emoji + SKIN_TONES[this.selectedSkinToneIndex].modifier;
  }

  get currentSkinToneSwatch(): string {
    const swatches = ['✋', '✋🏻', '✋🏼', '✋🏽', '✋🏾', '✋🏿'];
    return swatches[this.selectedSkinToneIndex];
  }

  // ── Grid size ─────────────────────────────────────────────────────────────

  setGridSize(size: 'small' | 'medium' | 'large'): void {
    this.gridSize = size;
  }

  // ── Copy format ───────────────────────────────────────────────────────────

  setCopyFormat(format: CopyFormat): void {
    this.copyFormat = format;
  }

  // ── Select / Copy ─────────────────────────────────────────────────────────

  onEmojiClick(entry: EmojiEntry): void {
    const displayed = this.applySkinTone(entry.emoji);
    const codepoints = [...displayed].map(c => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' ');
    const htmlEntity = [...displayed].map(c => '&#x' + c.codePointAt(0)!.toString(16).toUpperCase() + ';').join('');

    this.selectedEmoji = {
      emoji: displayed,
      name: entry.name,
      codepoint: codepoints,
      htmlEntity: htmlEntity,
    };

    let textToCopy = displayed;
    if (this.copyFormat === 'html') textToCopy = htmlEntity;
    else if (this.copyFormat === 'unicode') textToCopy = codepoints;

    this.copyToClipboard(textToCopy);
    this.addToRecent(displayed);

    // Easter egg: skull emoji
    if (entry.emoji === '💀') {
      this.eggs.trigger('emoji-skull');
    }
  }

  onRecentClick(emoji: string): void {
    const codepoints = [...emoji].map(c => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' ');
    const htmlEntity = [...emoji].map(c => '&#x' + c.codePointAt(0)!.toString(16).toUpperCase() + ';').join('');

    this.selectedEmoji = {
      emoji,
      name: 'recently used',
      codepoint: codepoints,
      htmlEntity: htmlEntity,
    };

    let textToCopy = emoji;
    if (this.copyFormat === 'html') textToCopy = htmlEntity;
    else if (this.copyFormat === 'unicode') textToCopy = codepoints;

    this.copyToClipboard(textToCopy);

    // Easter egg: skull emoji
    if (emoji === '💀') {
      this.eggs.trigger('emoji-skull');
    }
  }

  private async copyToClipboard(text: string): Promise<void> {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showCopiedFeedback(text);
    } catch {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string): void {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.showCopiedFeedback(text);
  }

  private showCopiedFeedback(text: string): void {
    this.copied = true;
    this.copiedText = text;
    setTimeout(() => {
      this.copied = false;
      this.copiedText = '';
    }, 2000);
  }

  // ── Recent emojis ─────────────────────────────────────────────────────────

  private addToRecent(emoji: string): void {
    if (!this.isBrowser) return;
    this.recentEmojis = [emoji, ...this.recentEmojis.filter(e => e !== emoji)].slice(0, 24);
    localStorage.setItem('ep-recent-emojis', JSON.stringify(this.recentEmojis));
  }

  private loadRecent(): void {
    if (!this.isBrowser) return;
    try {
      const stored = localStorage.getItem('ep-recent-emojis');
      if (stored) this.recentEmojis = JSON.parse(stored);
    } catch { /* silent */ }
  }

  clearRecent(): void {
    this.recentEmojis = [];
    if (this.isBrowser) localStorage.removeItem('ep-recent-emojis');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getEmojiCodepoint(emoji: string): string {
    return [...emoji].map(c => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' ');
  }

  getEmojiHtmlEntity(emoji: string): string {
    return [...emoji].map(c => '&#x' + c.codePointAt(0)!.toString(16).toUpperCase() + ';').join('');
  }

  get totalEmojiCount(): number {
    return this.categories.reduce((sum, c) => sum + c.emojis.length, 0);
  }
}
