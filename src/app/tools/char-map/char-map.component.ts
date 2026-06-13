import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, NgIf, NgFor } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

interface CharEntry {
  char: string;
  name: string;
  unicode: string;
  html: string;
  keywords: string[];
}

interface CharCategory {
  id: string;
  label: string;
  icon: string;
  chars: CharEntry[];
}

interface SelectedChar {
  char: string;
  name: string;
  unicode: string;
  html: string;
}

type CopyFormat = 'char' | 'html' | 'unicode';

function ch(char: string, name: string, html: string, keywords: string[] = []): CharEntry {
  const cp = char.codePointAt(0)!;
  return {
    char,
    name,
    unicode: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
    html,
    keywords: [name.toLowerCase(), ...keywords],
  };
}

const CHAR_DATA: CharCategory[] = [
  {
    id: 'arrows', label: 'Arrows', icon: '→',
    chars: [
      ch('→', 'Rightwards Arrow', '&rarr;', ['right','direction']),
      ch('←', 'Leftwards Arrow', '&larr;', ['left','direction']),
      ch('↑', 'Upwards Arrow', '&uarr;', ['up','direction']),
      ch('↓', 'Downwards Arrow', '&darr;', ['down','direction']),
      ch('↔', 'Left Right Arrow', '&harr;', ['horizontal','both']),
      ch('↕', 'Up Down Arrow', '&#x2195;', ['vertical','both']),
      ch('↗', 'North East Arrow', '&#x2197;', ['diagonal','northeast']),
      ch('↘', 'South East Arrow', '&#x2198;', ['diagonal','southeast']),
      ch('↙', 'South West Arrow', '&#x2199;', ['diagonal','southwest']),
      ch('↖', 'North West Arrow', '&#x2196;', ['diagonal','northwest']),
      ch('⇒', 'Rightwards Double Arrow', '&rArr;', ['implies','double']),
      ch('⇐', 'Leftwards Double Arrow', '&lArr;', ['double']),
      ch('⇑', 'Upwards Double Arrow', '&uArr;', ['double']),
      ch('⇓', 'Downwards Double Arrow', '&dArr;', ['double']),
      ch('⇔', 'Left Right Double Arrow', '&hArr;', ['iff','equivalent','double']),
      ch('⇕', 'Up Down Double Arrow', '&#x21D5;', ['double']),
      ch('⟵', 'Long Leftwards Arrow', '&#x27F5;', ['long']),
      ch('⟶', 'Long Rightwards Arrow', '&#x27F6;', ['long']),
      ch('⟷', 'Long Left Right Arrow', '&#x27F7;', ['long']),
      ch('⟸', 'Long Leftwards Double Arrow', '&#x27F8;', ['long','double']),
      ch('⟹', 'Long Rightwards Double Arrow', '&#x27F9;', ['long','double','implies']),
      ch('⟺', 'Long Left Right Double Arrow', '&#x27FA;', ['long','double']),
      ch('↩', 'Leftwards Arrow with Hook', '&#x21A9;', ['return','hook']),
      ch('↪', 'Rightwards Arrow with Hook', '&#x21AA;', ['hook']),
      ch('↰', 'Upwards Arrow with Tip Leftwards', '&#x21B0;', ['corner']),
      ch('↱', 'Upwards Arrow with Tip Rightwards', '&#x21B1;', ['corner']),
      ch('↲', 'Downwards Arrow with Tip Leftwards', '&#x21B2;', ['corner']),
      ch('↳', 'Downwards Arrow with Tip Rightwards', '&#x21B3;', ['corner']),
      ch('↴', 'Rightwards Arrow with Corner Downwards', '&#x21B4;', ['wrap']),
      ch('↵', 'Downwards Arrow with Corner Leftwards', '&#x21B5;', ['enter','return','newline']),
      ch('⇠', 'Leftwards Dashed Arrow', '&#x21E0;', ['dashed']),
      ch('⇢', 'Rightwards Dashed Arrow', '&#x21E2;', ['dashed']),
      ch('⇡', 'Upwards Dashed Arrow', '&#x21E1;', ['dashed']),
      ch('⇣', 'Downwards Dashed Arrow', '&#x21E3;', ['dashed']),
      ch('➔', 'Heavy Wide-Headed Rightwards Arrow', '&#x2794;', ['heavy','bold']),
      ch('➜', 'Heavy Round-Tipped Rightwards Arrow', '&#x279C;', ['heavy','round']),
      ch('➝', 'Drafting Point Rightwards Arrow', '&#x279D;', ['drafting']),
      ch('➞', 'Heavy Round-Tipped Rightwards Arrow', '&#x279E;', ['heavy']),
      ch('➡', 'Black Rightwards Arrow', '&#x27A1;', ['black','solid']),
      ch('➤', 'Black Right-Pointing Triangle', '&#x27A4;', ['pointer','triangle']),
      ch('➧', 'Squat Black Rightwards Arrow', '&#x27A7;', ['squat']),
      ch('➨', 'Heavy Concave-Pointed Rightwards Arrow', '&#x27A8;', ['concave']),
      ch('➩', 'Right-Shaded White Rightwards Arrow', '&#x27A9;', ['shaded']),
      ch('➪', 'Left-Shaded White Rightwards Arrow', '&#x27AA;', ['shaded']),
      ch('➫', 'Back-Tilted Shadowed Rightwards Arrow', '&#x27AB;', ['shadow']),
      ch('➬', 'Front-Tilted Shadowed Rightwards Arrow', '&#x27AC;', ['shadow']),
      ch('➭', 'Heavy Lower Right-Shadowed Rightwards Arrow', '&#x27AD;', ['shadow']),
      ch('➮', 'Heavy Upper Right-Shadowed Rightwards Arrow', '&#x27AE;', ['shadow']),
      ch('➯', 'Notched Lower Right-Shadowed Rightwards Arrow', '&#x27AF;', ['notched']),
      ch('➱', 'Notched Upper Right-Shadowed Rightwards Arrow', '&#x27B1;', ['notched']),
      ch('➲', 'Circled Heavy White Rightwards Arrow', '&#x27B2;', ['circled']),
    ],
  },
  {
    id: 'math', label: 'Mathematics', icon: '±',
    chars: [
      ch('±', 'Plus-Minus Sign', '&plusmn;', ['plus','minus']),
      ch('×', 'Multiplication Sign', '&times;', ['multiply','cross']),
      ch('÷', 'Division Sign', '&divide;', ['divide']),
      ch('≠', 'Not Equal To', '&ne;', ['not equal','inequality']),
      ch('≈', 'Almost Equal To', '&asymp;', ['approximately','approx']),
      ch('≡', 'Identical To', '&equiv;', ['identical','congruent']),
      ch('≤', 'Less-Than or Equal To', '&le;', ['less equal']),
      ch('≥', 'Greater-Than or Equal To', '&ge;', ['greater equal']),
      ch('∞', 'Infinity', '&infin;', ['infinite','forever']),
      ch('∑', 'N-Ary Summation', '&sum;', ['sum','sigma']),
      ch('∏', 'N-Ary Product', '&prod;', ['product','pi']),
      ch('∫', 'Integral', '&int;', ['calculus']),
      ch('∂', 'Partial Differential', '&part;', ['partial','derivative']),
      ch('√', 'Square Root', '&radic;', ['root','sqrt']),
      ch('∛', 'Cube Root', '&#x221B;', ['root','cbrt']),
      ch('∜', 'Fourth Root', '&#x221C;', ['root']),
      ch('∇', 'Nabla', '&nabla;', ['del','gradient','vector']),
      ch('∆', 'Increment', '&#x2206;', ['delta','change']),
      ch('∈', 'Element Of', '&isin;', ['member','set']),
      ch('∉', 'Not an Element Of', '&notin;', ['not member','set']),
      ch('∋', 'Contains as Member', '&ni;', ['contains','set']),
      ch('∅', 'Empty Set', '&empty;', ['null','void']),
      ch('∩', 'Intersection', '&cap;', ['and','set']),
      ch('∪', 'Union', '&cup;', ['or','set']),
      ch('⊂', 'Subset Of', '&sub;', ['subset']),
      ch('⊃', 'Superset Of', '&sup;', ['superset']),
      ch('⊆', 'Subset Of or Equal To', '&sube;', ['subset equal']),
      ch('⊇', 'Superset Of or Equal To', '&supe;', ['superset equal']),
      ch('⊕', 'Circled Plus', '&oplus;', ['xor','direct sum']),
      ch('⊗', 'Circled Times', '&otimes;', ['tensor']),
      ch('⊥', 'Up Tack', '&perp;', ['perpendicular','orthogonal']),
      ch('∠', 'Angle', '&ang;', ['angle']),
      ch('∟', 'Right Angle', '&#x221F;', ['angle','right']),
      ch('°', 'Degree Sign', '&deg;', ['degree','temperature']),
      ch('′', 'Prime', '&prime;', ['prime','feet','minutes']),
      ch('″', 'Double Prime', '&Prime;', ['double prime','inches','seconds']),
      ch('‰', 'Per Mille Sign', '&permil;', ['per mille','thousand']),
      ch('‱', 'Per Ten Thousand Sign', '&#x2031;', ['basis point']),
      ch('∝', 'Proportional To', '&prop;', ['proportional']),
      ch('∀', 'For All', '&forall;', ['universal','quantifier']),
      ch('∃', 'There Exists', '&exist;', ['existential','quantifier']),
      ch('∄', 'There Does Not Exist', '&#x2204;', ['not exists']),
      ch('∧', 'Logical And', '&and;', ['conjunction']),
      ch('∨', 'Logical Or', '&or;', ['disjunction']),
      ch('¬', 'Not Sign', '&not;', ['negation','logical not']),
      ch('⊢', 'Right Tack', '&#x22A2;', ['proves','turnstile']),
      ch('⊣', 'Left Tack', '&#x22A3;', ['reverse turnstile']),
      ch('⊤', 'Down Tack', '&#x22A4;', ['true','tautology']),
      ch('≪', 'Much Less-Than', '&#x226A;', ['much less']),
      ch('≫', 'Much Greater-Than', '&#x226B;', ['much greater']),
      ch('≅', 'Approximately Equal To', '&cong;', ['congruent']),
      ch('≇', 'Neither Approximately Nor Actually Equal To', '&#x2247;', []),
      ch('≜', 'Delta Equal To', '&#x225C;', ['defined as']),
      ch('⊙', 'Circled Dot Operator', '&#x2299;', ['circled dot']),
      ch('∘', 'Ring Operator', '&#x2218;', ['compose','function']),
      ch('ℵ', 'Alef Symbol', '&alefsym;', ['aleph','cardinality']),
      ch('ℶ', 'Bet Symbol', '&#x2136;', ['beth']),
    ],
  },
  {
    id: 'currency', label: 'Currency', icon: '¤',
    chars: [
      ch('$', 'Dollar Sign', '&dollar;', ['usd','money']),
      ch('€', 'Euro Sign', '&euro;', ['eur','money']),
      ch('£', 'Pound Sign', '&pound;', ['gbp','sterling','money']),
      ch('¥', 'Yen Sign', '&yen;', ['jpy','cny','money']),
      ch('¢', 'Cent Sign', '&cent;', ['cents','money']),
      ch('₹', 'Indian Rupee Sign', '&#x20B9;', ['inr','rupee','money']),
      ch('₩', 'Won Sign', '&#x20A9;', ['krw','money']),
      ch('₱', 'Peso Sign', '&#x20B1;', ['php','money']),
      ch('₿', 'Bitcoin Sign', '&#x20BF;', ['btc','crypto','money']),
      ch('Ξ', 'Ethereum (Xi)', '&Xi;', ['eth','crypto']),
      ch('₫', 'Dong Sign', '&#x20AB;', ['vnd','money']),
      ch('₴', 'Hryvnia Sign', '&#x20B4;', ['uah','money']),
      ch('₸', 'Tenge Sign', '&#x20B8;', ['kzt','money']),
      ch('₺', 'Turkish Lira Sign', '&#x20BA;', ['try','money']),
      ch('₽', 'Ruble Sign', '&#x20BD;', ['rub','money']),
      ch('₡', 'Colon Sign', '&#x20A1;', ['crc','money']),
      ch('₢', 'Cruzeiro Sign', '&#x20A2;', ['brz','money']),
      ch('₣', 'French Franc Sign', '&#x20A3;', ['frf','money']),
      ch('₤', 'Lira Sign', '&#x20A4;', ['itl','money']),
      ch('₥', 'Mill Sign', '&#x20A5;', ['mil','money']),
      ch('₦', 'Naira Sign', '&#x20A6;', ['ngn','money']),
      ch('₧', 'Peseta Sign', '&#x20A7;', ['esp','money']),
      ch('₨', 'Rupee Sign', '&#x20A8;', ['rupee','money']),
      ch('₪', 'New Sheqel Sign', '&#x20AA;', ['ils','money']),
      ch('€', 'Manat Sign', '&#x20AC;', ['azn','money']),
      ch('₭', 'Kip Sign', '&#x20AD;', ['lak','money']),
      ch('₮', 'Tugrik Sign', '&#x20AE;', ['mnt','money']),
      ch('₯', 'Drachma Sign', '&#x20AF;', ['grd','money']),
      ch('₰', 'German Penny Sign', '&#x20B0;', ['pfennig','money']),
      ch('₲', 'Guarani Sign', '&#x20B2;', ['pyg','money']),
      ch('₳', 'Austral Sign', '&#x20B3;', ['money']),
      ch('¤', 'Currency Sign', '&curren;', ['generic','money']),
      ch('ƒ', 'Latin Small Letter F with Hook', '&fnof;', ['florin','guilder','money']),
    ],
  },
  {
    id: 'greek', label: 'Greek Letters', icon: 'Ω',
    chars: [
      ch('Α', 'Greek Capital Letter Alpha', '&Alpha;', ['alpha']),
      ch('Β', 'Greek Capital Letter Beta', '&Beta;', ['beta']),
      ch('Γ', 'Greek Capital Letter Gamma', '&Gamma;', ['gamma']),
      ch('Δ', 'Greek Capital Letter Delta', '&Delta;', ['delta']),
      ch('Ε', 'Greek Capital Letter Epsilon', '&Epsilon;', ['epsilon']),
      ch('Ζ', 'Greek Capital Letter Zeta', '&Zeta;', ['zeta']),
      ch('Η', 'Greek Capital Letter Eta', '&Eta;', ['eta']),
      ch('Θ', 'Greek Capital Letter Theta', '&Theta;', ['theta']),
      ch('Ι', 'Greek Capital Letter Iota', '&Iota;', ['iota']),
      ch('Κ', 'Greek Capital Letter Kappa', '&Kappa;', ['kappa']),
      ch('Λ', 'Greek Capital Letter Lambda', '&Lambda;', ['lambda']),
      ch('Μ', 'Greek Capital Letter Mu', '&Mu;', ['mu']),
      ch('Ν', 'Greek Capital Letter Nu', '&Nu;', ['nu']),
      ch('Ξ', 'Greek Capital Letter Xi', '&Xi;', ['xi']),
      ch('Ο', 'Greek Capital Letter Omicron', '&Omicron;', ['omicron']),
      ch('Π', 'Greek Capital Letter Pi', '&Pi;', ['pi']),
      ch('Ρ', 'Greek Capital Letter Rho', '&Rho;', ['rho']),
      ch('Σ', 'Greek Capital Letter Sigma', '&Sigma;', ['sigma']),
      ch('Τ', 'Greek Capital Letter Tau', '&Tau;', ['tau']),
      ch('Υ', 'Greek Capital Letter Upsilon', '&Upsilon;', ['upsilon']),
      ch('Φ', 'Greek Capital Letter Phi', '&Phi;', ['phi']),
      ch('Χ', 'Greek Capital Letter Chi', '&Chi;', ['chi']),
      ch('Ψ', 'Greek Capital Letter Psi', '&Psi;', ['psi']),
      ch('Ω', 'Greek Capital Letter Omega', '&Omega;', ['omega','ohm']),
      ch('α', 'Greek Small Letter Alpha', '&alpha;', ['alpha']),
      ch('β', 'Greek Small Letter Beta', '&beta;', ['beta']),
      ch('γ', 'Greek Small Letter Gamma', '&gamma;', ['gamma']),
      ch('δ', 'Greek Small Letter Delta', '&delta;', ['delta']),
      ch('ε', 'Greek Small Letter Epsilon', '&epsilon;', ['epsilon']),
      ch('ζ', 'Greek Small Letter Zeta', '&zeta;', ['zeta']),
      ch('η', 'Greek Small Letter Eta', '&eta;', ['eta']),
      ch('θ', 'Greek Small Letter Theta', '&theta;', ['theta']),
      ch('ι', 'Greek Small Letter Iota', '&iota;', ['iota']),
      ch('κ', 'Greek Small Letter Kappa', '&kappa;', ['kappa']),
      ch('λ', 'Greek Small Letter Lambda', '&lambda;', ['lambda']),
      ch('μ', 'Greek Small Letter Mu', '&mu;', ['mu','micro']),
      ch('ν', 'Greek Small Letter Nu', '&nu;', ['nu']),
      ch('ξ', 'Greek Small Letter Xi', '&xi;', ['xi']),
      ch('ο', 'Greek Small Letter Omicron', '&omicron;', ['omicron']),
      ch('π', 'Greek Small Letter Pi', '&pi;', ['pi','circle']),
      ch('ρ', 'Greek Small Letter Rho', '&rho;', ['rho']),
      ch('ς', 'Greek Small Letter Final Sigma', '&sigmaf;', ['sigma','final']),
      ch('σ', 'Greek Small Letter Sigma', '&sigma;', ['sigma']),
      ch('τ', 'Greek Small Letter Tau', '&tau;', ['tau']),
      ch('υ', 'Greek Small Letter Upsilon', '&upsilon;', ['upsilon']),
      ch('φ', 'Greek Small Letter Phi', '&phi;', ['phi']),
      ch('χ', 'Greek Small Letter Chi', '&chi;', ['chi']),
      ch('ψ', 'Greek Small Letter Psi', '&psi;', ['psi']),
      ch('ω', 'Greek Small Letter Omega', '&omega;', ['omega']),
      ch('ϑ', 'Greek Theta Symbol', '&thetasym;', ['theta','variant']),
      ch('ϒ', 'Greek Upsilon with Hook Symbol', '&upsih;', ['upsilon','hook']),
      ch('ϖ', 'Greek Pi Symbol', '&piv;', ['pi','variant']),
    ],
  },
  {
    id: 'technical', label: 'Technical & Keyboard', icon: '⌘',
    chars: [
      ch('⌘', 'Place of Interest Sign', '&#x2318;', ['command','cmd','mac']),
      ch('⌥', 'Option Key', '&#x2325;', ['option','alt','mac']),
      ch('⇧', 'Upwards White Arrow', '&#x21E7;', ['shift','mac']),
      ch('⌃', 'Up Arrowhead', '&#x2303;', ['control','ctrl','mac']),
      ch('⎋', 'Broken Circle with Northwest Arrow', '&#x238B;', ['escape','esc']),
      ch('⌫', 'Erase to the Left', '&#x232B;', ['delete','backspace']),
      ch('⌦', 'Erase to the Right', '&#x2326;', ['forward delete']),
      ch('⏎', 'Return Symbol', '&#x23CE;', ['return','enter']),
      ch('⇥', 'Rightwards Arrow to Bar', '&#x21E5;', ['tab']),
      ch('⇤', 'Leftwards Arrow to Bar', '&#x21E4;', ['backtab']),
      ch('⇪', 'Upwards White Arrow from Bar', '&#x21EA;', ['caps lock']),
      ch('␣', 'Open Box', '&#x2423;', ['space','spacebar']),
      ch('⌨', 'Keyboard', '&#x2328;', ['keyboard']),
      ch('⎇', 'Alternative Key Symbol', '&#x2387;', ['alt']),
      ch('⊞', 'Squared Plus', '&#x229E;', ['windows','win key']),
      ch('⎈', 'Helm Symbol', '&#x2388;', ['control']),
      ch('⏏', 'Eject Symbol', '&#x23CF;', ['eject']),
      ch('⌧', 'X in a Rectangle Box', '&#x2327;', ['clear']),
      ch('⏻', 'Power Symbol', '&#x23FB;', ['power','on off']),
      ch('⏼', 'Power On-Off Symbol', '&#x23FC;', ['toggle power']),
      ch('⏽', 'Power On Symbol', '&#x23FD;', ['power on']),
      ch('⭘', 'Heavy Large Circle', '&#x2B58;', ['power off']),
      ch('⏾', 'Power Sleep Symbol', '&#x23FE;', ['sleep']),
      ch('⌀', 'Diameter Sign', '&#x2300;', ['diameter']),
      ch('⌂', 'House', '&#x2302;', ['home']),
      ch('⌐', 'Reversed Not Sign', '&#x2310;', ['reversed not']),
      ch('⌑', 'Square Lozenge', '&#x2311;', ['lozenge']),
      ch('⌒', 'Arc', '&#x2312;', ['arc']),
      ch('⏣', 'Benzene Ring', '&#x23E3;', ['hexagon','chemistry']),
      ch('⎍', 'Monostable Symbol', '&#x238D;', ['electronics']),
      ch('⏀', 'Dentistry Symbol Light Vertical and Wave', '&#x23C0;', ['dentistry']),
      ch('⏁', 'Dentistry Symbol Light Down and Horizontal', '&#x23C1;', ['dentistry']),
    ],
  },
  {
    id: 'box', label: 'Box Drawing', icon: '┌',
    chars: [
      ch('─', 'Box Drawings Light Horizontal', '&#x2500;', ['line','horizontal']),
      ch('│', 'Box Drawings Light Vertical', '&#x2502;', ['line','vertical']),
      ch('┌', 'Box Drawings Light Down and Right', '&#x250C;', ['corner','top left']),
      ch('┐', 'Box Drawings Light Down and Left', '&#x2510;', ['corner','top right']),
      ch('└', 'Box Drawings Light Up and Right', '&#x2514;', ['corner','bottom left']),
      ch('┘', 'Box Drawings Light Up and Left', '&#x2518;', ['corner','bottom right']),
      ch('├', 'Box Drawings Light Vertical and Right', '&#x251C;', ['tee','junction']),
      ch('┤', 'Box Drawings Light Vertical and Left', '&#x2524;', ['tee','junction']),
      ch('┬', 'Box Drawings Light Down and Horizontal', '&#x252C;', ['tee','junction']),
      ch('┴', 'Box Drawings Light Up and Horizontal', '&#x2534;', ['tee','junction']),
      ch('┼', 'Box Drawings Light Vertical and Horizontal', '&#x253C;', ['cross','junction']),
      ch('═', 'Box Drawings Double Horizontal', '&#x2550;', ['double','line']),
      ch('║', 'Box Drawings Double Vertical', '&#x2551;', ['double','line']),
      ch('╔', 'Box Drawings Double Down and Right', '&#x2554;', ['double','corner']),
      ch('╗', 'Box Drawings Double Down and Left', '&#x2557;', ['double','corner']),
      ch('╚', 'Box Drawings Double Up and Right', '&#x255A;', ['double','corner']),
      ch('╝', 'Box Drawings Double Up and Left', '&#x255D;', ['double','corner']),
      ch('╠', 'Box Drawings Double Vertical and Right', '&#x2560;', ['double','tee']),
      ch('╣', 'Box Drawings Double Vertical and Left', '&#x2563;', ['double','tee']),
      ch('╦', 'Box Drawings Double Down and Horizontal', '&#x2566;', ['double','tee']),
      ch('╩', 'Box Drawings Double Up and Horizontal', '&#x2569;', ['double','tee']),
      ch('╬', 'Box Drawings Double Vertical and Horizontal', '&#x256C;', ['double','cross']),
      ch('┄', 'Box Drawings Light Triple Dash Horizontal', '&#x2504;', ['dashed']),
      ch('┆', 'Box Drawings Light Triple Dash Vertical', '&#x2506;', ['dashed']),
      ch('┈', 'Box Drawings Light Quadruple Dash Horizontal', '&#x2508;', ['dotted']),
      ch('┊', 'Box Drawings Light Quadruple Dash Vertical', '&#x250A;', ['dotted']),
      ch('╭', 'Box Drawings Light Arc Down and Right', '&#x256D;', ['rounded','corner']),
      ch('╮', 'Box Drawings Light Arc Down and Left', '&#x256E;', ['rounded','corner']),
      ch('╯', 'Box Drawings Light Arc Up and Left', '&#x256F;', ['rounded','corner']),
      ch('╰', 'Box Drawings Light Arc Up and Right', '&#x2570;', ['rounded','corner']),
      ch('▀', 'Upper Half Block', '&#x2580;', ['block','upper']),
      ch('▄', 'Lower Half Block', '&#x2584;', ['block','lower']),
      ch('█', 'Full Block', '&#x2588;', ['block','full','solid']),
      ch('▌', 'Left Half Block', '&#x258C;', ['block','left']),
      ch('▐', 'Right Half Block', '&#x2590;', ['block','right']),
      ch('░', 'Light Shade', '&#x2591;', ['shade','light']),
      ch('▒', 'Medium Shade', '&#x2592;', ['shade','medium']),
      ch('▓', 'Dark Shade', '&#x2593;', ['shade','dark']),
    ],
  },
  {
    id: 'bullets', label: 'Bullets & Shapes', icon: '●',
    chars: [
      ch('•', 'Bullet', '&bull;', ['dot','list']),
      ch('◦', 'White Bullet', '&#x25E6;', ['circle','open']),
      ch('▪', 'Black Small Square', '&#x25AA;', ['square','small']),
      ch('▫', 'White Small Square', '&#x25AB;', ['square','small']),
      ch('▬', 'Black Rectangle', '&#x25AC;', ['rectangle']),
      ch('▭', 'White Rectangle', '&#x25AD;', ['rectangle']),
      ch('▮', 'Black Vertical Rectangle', '&#x25AE;', ['rectangle']),
      ch('▯', 'White Vertical Rectangle', '&#x25AF;', ['rectangle']),
      ch('▰', 'Black Parallelogram', '&#x25B0;', ['parallelogram']),
      ch('▱', 'White Parallelogram', '&#x25B1;', ['parallelogram']),
      ch('▲', 'Black Up-Pointing Triangle', '&#x25B2;', ['triangle','up']),
      ch('△', 'White Up-Pointing Triangle', '&#x25B3;', ['triangle','up']),
      ch('▶', 'Black Right-Pointing Triangle', '&#x25B6;', ['play','triangle']),
      ch('▷', 'White Right-Pointing Triangle', '&#x25B7;', ['triangle']),
      ch('▼', 'Black Down-Pointing Triangle', '&#x25BC;', ['triangle','down']),
      ch('▽', 'White Down-Pointing Triangle', '&#x25BD;', ['triangle','down']),
      ch('◀', 'Black Left-Pointing Triangle', '&#x25C0;', ['triangle','left']),
      ch('◁', 'White Left-Pointing Triangle', '&#x25C1;', ['triangle','left']),
      ch('◆', 'Black Diamond', '&#x25C6;', ['diamond']),
      ch('◇', 'White Diamond', '&#x25C7;', ['diamond']),
      ch('◈', 'White Diamond Containing Black Small Diamond', '&#x25C8;', ['diamond']),
      ch('○', 'White Circle', '&#x25CB;', ['circle','ring']),
      ch('●', 'Black Circle', '&#x25CF;', ['circle','dot','filled']),
      ch('◉', 'Fisheye', '&#x25C9;', ['circle','bullseye']),
      ch('◎', 'Bullseye', '&#x25CE;', ['target','circle']),
      ch('◐', 'Circle with Left Half Black', '&#x25D0;', ['half','circle']),
      ch('◑', 'Circle with Right Half Black', '&#x25D1;', ['half','circle']),
      ch('◒', 'Circle with Lower Half Black', '&#x25D2;', ['half','circle']),
      ch('◓', 'Circle with Upper Half Black', '&#x25D3;', ['half','circle']),
      ch('◔', 'Circle with Upper Right Quadrant Black', '&#x25D4;', ['quarter','circle']),
      ch('★', 'Black Star', '&#x2605;', ['star','filled']),
      ch('☆', 'White Star', '&#x2606;', ['star','outline']),
      ch('✦', 'Black Four Pointed Star', '&#x2726;', ['star','sparkle']),
      ch('✧', 'White Four Pointed Star', '&#x2727;', ['star','sparkle']),
      ch('✪', 'Circled White Star', '&#x272A;', ['star','circled']),
      ch('✫', 'Open Centre Black Star', '&#x272B;', ['star']),
      ch('✬', 'Black Centre White Star', '&#x272C;', ['star']),
      ch('✭', 'Outlined Black Star', '&#x272D;', ['star']),
      ch('✮', 'Heavy Outlined Black Star', '&#x272E;', ['star']),
      ch('✯', 'Pinwheel Star', '&#x272F;', ['star','pinwheel']),
      ch('✰', 'Shadowed White Star', '&#x2730;', ['star','shadow']),
      ch('⬟', 'Pentagon', '&#x2B1F;', ['pentagon','shape']),
      ch('⬡', 'Hexagon', '&#x2B21;', ['hexagon','shape']),
      ch('⬢', 'Black Hexagon', '&#x2B22;', ['hexagon','shape']),
    ],
  },
  {
    id: 'dingbats', label: 'Dingbats & Symbols', icon: '✿',
    chars: [
      ch('✓', 'Check Mark', '&#x2713;', ['check','tick','done']),
      ch('✔', 'Heavy Check Mark', '&#x2714;', ['check','tick','done']),
      ch('✕', 'Multiplication X', '&#x2715;', ['cross','x','cancel']),
      ch('✖', 'Heavy Multiplication X', '&#x2716;', ['cross','x','cancel']),
      ch('✗', 'Ballot X', '&#x2717;', ['cross','x','wrong']),
      ch('✘', 'Heavy Ballot X', '&#x2718;', ['cross','x','wrong']),
      ch('✚', 'Heavy Greek Cross', '&#x271A;', ['plus','cross']),
      ch('✜', 'Heavy Open Centre Cross', '&#x271C;', ['cross']),
      ch('✝', 'Latin Cross', '&#x271D;', ['cross','christian']),
      ch('✞', 'Shadowed White Latin Cross', '&#x271E;', ['cross']),
      ch('✟', 'Outlined Latin Cross', '&#x271F;', ['cross']),
      ch('✠', 'Maltese Cross', '&#x2720;', ['cross','maltese']),
      ch('✡', 'Star of David', '&#x2721;', ['jewish','hexagram']),
      ch('✢', 'Four Teardrop-Spoked Asterisk', '&#x2722;', ['asterisk']),
      ch('✣', 'Four Balloon-Spoked Asterisk', '&#x2723;', ['asterisk']),
      ch('✤', 'Heavy Four Balloon-Spoked Asterisk', '&#x2724;', ['asterisk']),
      ch('✥', 'Four Club-Spoked Asterisk', '&#x2725;', ['asterisk']),
      ch('❖', 'Black Diamond Minus White X', '&#x2756;', ['diamond']),
      ch('❛', 'Heavy Single Turned Comma Quotation Mark', '&#x275B;', ['quote']),
      ch('❜', 'Heavy Single Comma Quotation Mark', '&#x275C;', ['quote']),
      ch('❝', 'Heavy Double Turned Comma Quotation Mark', '&#x275D;', ['quote']),
      ch('❞', 'Heavy Double Comma Quotation Mark', '&#x275E;', ['quote']),
      ch('❡', 'Reversed Rotated Floral Heart Bullet', '&#x2761;', ['heart','floral']),
      ch('❢', 'Heavy Exclamation Mark Ornament', '&#x2762;', ['exclamation']),
      ch('❣', 'Heavy Heart Exclamation Mark', '&#x2763;', ['heart']),
      ch('❤', 'Heavy Black Heart', '&#x2764;', ['heart','love']),
      ch('❥', 'Rotated Heavy Black Heart Bullet', '&#x2765;', ['heart']),
      ch('❦', 'Floral Heart', '&#x2766;', ['heart','floral']),
      ch('❧', 'Rotated Floral Heart Bullet', '&#x2767;', ['heart','floral','aldus']),
      ch('☀', 'Black Sun with Rays', '&#x2600;', ['sun','weather']),
      ch('☁', 'Cloud', '&#x2601;', ['cloud','weather']),
      ch('☂', 'Umbrella', '&#x2602;', ['umbrella','rain']),
      ch('☃', 'Snowman', '&#x2603;', ['snowman','winter']),
      ch('☄', 'Comet', '&#x2604;', ['comet','space']),
      ch('☮', 'Peace Symbol', '&#x262E;', ['peace']),
      ch('☯', 'Yin Yang', '&#x262F;', ['yinyang','tao','balance']),
      ch('☸', 'Wheel of Dharma', '&#x2638;', ['dharma','buddhism']),
      ch('☠', 'Skull and Crossbones', '&#x2620;', ['skull','danger','poison']),
      ch('☢', 'Radioactive Sign', '&#x2622;', ['radioactive','nuclear']),
      ch('☣', 'Biohazard Sign', '&#x2623;', ['biohazard','toxic']),
      ch('⚛', 'Atom Symbol', '&#x269B;', ['atom','science']),
      ch('⚠', 'Warning Sign', '&#x26A0;', ['warning','caution']),
      ch('⚡', 'High Voltage Sign', '&#x26A1;', ['lightning','electric']),
      ch('⚙', 'Gear', '&#x2699;', ['gear','settings','cog']),
      ch('⚖', 'Scales', '&#x2696;', ['balance','justice','law']),
      ch('⚗', 'Alembic', '&#x2697;', ['alchemy','chemistry']),
      ch('⚘', 'Flower', '&#x2698;', ['flower']),
      ch('⚜', 'Fleur-de-Lis', '&#x269C;', ['fleur','lily']),
      ch('⚝', 'Outlined White Star', '&#x269D;', ['star']),
      ch('⚐', 'White Flag', '&#x2690;', ['flag','surrender']),
      ch('⚑', 'Black Flag', '&#x2691;', ['flag']),
      ch('✿', 'Black Florette', '&#x273F;', ['flower']),
      ch('❀', 'White Florette', '&#x2740;', ['flower']),
      ch('❁', 'Eight Petalled Outlined Black Florette', '&#x2741;', ['flower']),
      ch('❂', 'Open Centre Asterisk', '&#x2742;', ['asterisk','sun']),
      ch('❃', 'Heavy Teardrop-Spoked Asterisk', '&#x2743;', ['asterisk']),
      ch('✾', 'Six Petalled Black and White Florette', '&#x273E;', ['flower']),
      ch('✽', 'Heavy Teardrop-Spoked Pinwheel Asterisk', '&#x273D;', ['asterisk']),
      ch('✼', 'Open Centre Teardrop-Spoked Asterisk', '&#x273C;', ['asterisk']),
      ch('♻', 'Recycling Symbol', '&#x267B;', ['recycle','eco']),
      ch('♲', 'Universal Recycling Symbol', '&#x2672;', ['recycle']),
    ],
  },
  {
    id: 'music', label: 'Musical Notes', icon: '♪',
    chars: [
      ch('♩', 'Quarter Note', '&#x2669;', ['music','note']),
      ch('♪', 'Eighth Note', '&#x266A;', ['music','note']),
      ch('♫', 'Beamed Eighth Notes', '&#x266B;', ['music','notes','beamed']),
      ch('♬', 'Beamed Sixteenth Notes', '&#x266C;', ['music','notes','beamed']),
      ch('♭', 'Music Flat Sign', '&#x266D;', ['flat','music']),
      ch('♮', 'Music Natural Sign', '&#x266E;', ['natural','music']),
      ch('♯', 'Music Sharp Sign', '&#x266F;', ['sharp','music']),
      ch('𝄀', 'Musical Symbol Final Barline', '&#x1D100;', ['barline','music']),
      ch('𝄁', 'Musical Symbol Repeat Barline', '&#x1D101;', ['barline','repeat']),
      ch('𝄂', 'Musical Symbol Final Barline', '&#x1D102;', ['barline','end']),
      ch('𝄃', 'Musical Symbol Reverse Final Barline', '&#x1D103;', ['barline']),
      ch('𝄞', 'Musical Symbol G Clef', '&#x1D11E;', ['treble','clef','music']),
      ch('𝄡', 'Musical Symbol C Clef', '&#x1D121;', ['alto','clef','music']),
      ch('𝄢', 'Musical Symbol F Clef', '&#x1D122;', ['bass','clef','music']),
      ch('𝅗𝅥', 'Musical Symbol Half Note', '&#x1D15E;', ['half note','music']),
      ch('𝅘𝅥', 'Musical Symbol Quarter Note', '&#x1D15F;', ['quarter note','music']),
      ch('𝅘𝅥𝅮', 'Musical Symbol Eighth Note', '&#x1D160;', ['eighth note','music']),
      ch('𝅘𝅥𝅯', 'Musical Symbol Sixteenth Note', '&#x1D161;', ['sixteenth note','music']),
      ch('𝆺𝅥𝅮', 'Musical Symbol Beamed Notes', '&#x1D1BA;', ['beamed','music']),
      ch('𝄪', 'Musical Symbol Double Sharp', '&#x1D12A;', ['double sharp','music']),
      ch('𝄫', 'Musical Symbol Double Flat', '&#x1D12B;', ['double flat','music']),
    ],
  },
  {
    id: 'typography', label: 'Typography', icon: '¶',
    chars: [
      ch('©', 'Copyright Sign', '&copy;', ['copyright']),
      ch('®', 'Registered Sign', '&reg;', ['registered','trademark']),
      ch('™', 'Trade Mark Sign', '&trade;', ['trademark']),
      ch('℠', 'Service Mark', '&#x2120;', ['service mark']),
      ch('¶', 'Pilcrow Sign', '&para;', ['paragraph']),
      ch('§', 'Section Sign', '&sect;', ['section']),
      ch('†', 'Dagger', '&dagger;', ['footnote','cross']),
      ch('‡', 'Double Dagger', '&Dagger;', ['footnote','cross']),
      ch('※', 'Reference Mark', '&#x203B;', ['reference','komejirushi']),
      ch('⁂', 'Asterism', '&#x2042;', ['asterism','stars']),
      ch('⁕', 'Flower Punctuation Mark', '&#x2055;', ['flower','ornament']),
      ch('⁖', 'Three Dot Punctuation', '&#x2056;', ['dots']),
      ch('⁘', 'Four Dot Mark', '&#x2058;', ['dots']),
      ch('⁙', 'Five Dot Mark', '&#x2059;', ['dots']),
      ch('…', 'Horizontal Ellipsis', '&hellip;', ['dots','ellipsis']),
      ch('·', 'Middle Dot', '&middot;', ['dot','interpunct']),
      ch('‣', 'Triangular Bullet', '&#x2023;', ['bullet','list']),
      ch('⁃', 'Hyphen Bullet', '&#x2043;', ['bullet','dash','list']),
      ch('–', 'En Dash', '&ndash;', ['dash','range']),
      ch('—', 'Em Dash', '&mdash;', ['dash','long']),
      ch('―', 'Horizontal Bar', '&#x2015;', ['bar','quotation dash']),
      ch('\u2018', 'Left Single Quotation Mark', '&lsquo;', ['quote','smart']),
      ch('\u2019', 'Right Single Quotation Mark', '&rsquo;', ['quote','smart','apostrophe']),
      ch('\u201C', 'Left Double Quotation Mark', '&ldquo;', ['quote','smart']),
      ch('\u201D', 'Right Double Quotation Mark', '&rdquo;', ['quote','smart']),
      ch('«', 'Left-Pointing Double Angle Quotation Mark', '&laquo;', ['guillemet','quote']),
      ch('»', 'Right-Pointing Double Angle Quotation Mark', '&raquo;', ['guillemet','quote']),
      ch('‹', 'Single Left-Pointing Angle Quotation Mark', '&lsaquo;', ['guillemet','quote']),
      ch('›', 'Single Right-Pointing Angle Quotation Mark', '&rsaquo;', ['guillemet','quote']),
      ch('&', 'Ampersand', '&amp;', ['and','ampersand']),
      ch('@', 'At Sign', '&#x0040;', ['at','email']),
      ch('#', 'Number Sign', '&#x0023;', ['hash','pound','hashtag']),
      ch('¡', 'Inverted Exclamation Mark', '&iexcl;', ['exclamation','spanish']),
      ch('¿', 'Inverted Question Mark', '&iquest;', ['question','spanish']),
      ch('‽', 'Interrobang', '&#x203D;', ['interrobang','question','exclamation']),
      ch('⁇', 'Double Question Mark', '&#x2047;', ['question','double']),
      ch('⁈', 'Question Exclamation Mark', '&#x2048;', ['question','exclamation']),
      ch('⁉', 'Exclamation Question Mark', '&#x2049;', ['exclamation','question']),
      ch('№', 'Numero Sign', '&#x2116;', ['number','numero']),
      ch('℅', 'Care Of', '&#x2105;', ['care of']),
      ch('℃', 'Degree Celsius', '&#x2103;', ['celsius','temperature']),
      ch('℉', 'Degree Fahrenheit', '&#x2109;', ['fahrenheit','temperature']),
      ch('Å', 'Angstrom Sign', '&#x212B;', ['angstrom','unit']),
      ch('℮', 'Estimated Symbol', '&#x212E;', ['estimated']),
    ],
  },
  {
    id: 'cards', label: 'Playing Cards & Dice', icon: '♠',
    chars: [
      ch('♠', 'Black Spade Suit', '&spades;', ['spade','card']),
      ch('♤', 'White Spade Suit', '&#x2664;', ['spade','card']),
      ch('♣', 'Black Club Suit', '&clubs;', ['club','card']),
      ch('♧', 'White Club Suit', '&#x2667;', ['club','card']),
      ch('♥', 'Black Heart Suit', '&hearts;', ['heart','card']),
      ch('♡', 'White Heart Suit', '&#x2661;', ['heart','card']),
      ch('♦', 'Black Diamond Suit', '&diams;', ['diamond','card']),
      ch('♢', 'White Diamond Suit', '&#x2662;', ['diamond','card']),
      ch('🂠', 'Playing Card Back', '&#x1F0A0;', ['card','back']),
      ch('🂡', 'Ace of Spades', '&#x1F0A1;', ['card','ace','spade']),
      ch('🂢', 'Two of Spades', '&#x1F0A2;', ['card','spade']),
      ch('🂣', 'Three of Spades', '&#x1F0A3;', ['card','spade']),
      ch('🂮', 'King of Spades', '&#x1F0AE;', ['card','king','spade']),
      ch('🃁', 'Ace of Diamonds', '&#x1F0C1;', ['card','ace','diamond']),
      ch('🃎', 'King of Diamonds', '&#x1F0CE;', ['card','king','diamond']),
      ch('🃑', 'Ace of Hearts', '&#x1F0D1;', ['card','ace','heart']),
      ch('🃞', 'King of Hearts', '&#x1F0DE;', ['card','king','heart']),
      ch('🃟', 'Black Joker', '&#x1F0DF;', ['joker','card']),
      ch('🃏', 'White Joker', '&#x1F0CF;', ['joker','card']),
      ch('⚀', 'Die Face-1', '&#x2680;', ['dice','one']),
      ch('⚁', 'Die Face-2', '&#x2681;', ['dice','two']),
      ch('⚂', 'Die Face-3', '&#x2682;', ['dice','three']),
      ch('⚃', 'Die Face-4', '&#x2683;', ['dice','four']),
      ch('⚄', 'Die Face-5', '&#x2684;', ['dice','five']),
      ch('⚅', 'Die Face-6', '&#x2685;', ['dice','six']),
    ],
  },
  {
    id: 'chess', label: 'Chess & Games', icon: '♞',
    chars: [
      ch('♔', 'White Chess King', '&#x2654;', ['chess','king']),
      ch('♕', 'White Chess Queen', '&#x2655;', ['chess','queen']),
      ch('♖', 'White Chess Rook', '&#x2656;', ['chess','rook','castle']),
      ch('♗', 'White Chess Bishop', '&#x2657;', ['chess','bishop']),
      ch('♘', 'White Chess Knight', '&#x2658;', ['chess','knight','horse']),
      ch('♙', 'White Chess Pawn', '&#x2659;', ['chess','pawn']),
      ch('♚', 'Black Chess King', '&#x265A;', ['chess','king']),
      ch('♛', 'Black Chess Queen', '&#x265B;', ['chess','queen']),
      ch('♜', 'Black Chess Rook', '&#x265C;', ['chess','rook','castle']),
      ch('♝', 'Black Chess Bishop', '&#x265D;', ['chess','bishop']),
      ch('♞', 'Black Chess Knight', '&#x265E;', ['chess','knight','horse']),
      ch('♟', 'Black Chess Pawn', '&#x265F;', ['chess','pawn']),
    ],
  },
  {
    id: 'zodiac', label: 'Zodiac & Astrology', icon: '♈',
    chars: [
      ch('♈', 'Aries', '&#x2648;', ['zodiac','aries','ram']),
      ch('♉', 'Taurus', '&#x2649;', ['zodiac','taurus','bull']),
      ch('♊', 'Gemini', '&#x264A;', ['zodiac','gemini','twins']),
      ch('♋', 'Cancer', '&#x264B;', ['zodiac','cancer','crab']),
      ch('♌', 'Leo', '&#x264C;', ['zodiac','leo','lion']),
      ch('♍', 'Virgo', '&#x264D;', ['zodiac','virgo']),
      ch('♎', 'Libra', '&#x264E;', ['zodiac','libra','scales']),
      ch('♏', 'Scorpio', '&#x264F;', ['zodiac','scorpio']),
      ch('♐', 'Sagittarius', '&#x2650;', ['zodiac','sagittarius','archer']),
      ch('♑', 'Capricorn', '&#x2651;', ['zodiac','capricorn','goat']),
      ch('♒', 'Aquarius', '&#x2652;', ['zodiac','aquarius','water']),
      ch('♓', 'Pisces', '&#x2653;', ['zodiac','pisces','fish']),
      ch('☉', 'Sun', '&#x2609;', ['astrology','sun']),
      ch('☽', 'First Quarter Moon', '&#x263D;', ['moon','crescent']),
      ch('☾', 'Last Quarter Moon', '&#x263E;', ['moon','crescent']),
      ch('☿', 'Mercury', '&#x263F;', ['planet','mercury']),
      ch('♀', 'Venus / Female', '&#x2640;', ['venus','female','woman']),
      ch('♁', 'Earth', '&#x2641;', ['earth','planet']),
      ch('♂', 'Mars / Male', '&#x2642;', ['mars','male','man']),
      ch('♃', 'Jupiter', '&#x2643;', ['planet','jupiter']),
      ch('♄', 'Saturn', '&#x2644;', ['planet','saturn']),
      ch('♅', 'Uranus', '&#x2645;', ['planet','uranus']),
      ch('♆', 'Neptune', '&#x2646;', ['planet','neptune']),
      ch('♇', 'Pluto', '&#x2647;', ['planet','pluto']),
    ],
  },
  {
    id: 'braille', label: 'Braille Patterns', icon: '⠿',
    chars: [
      ch('⠁', 'Braille Pattern Dots-1', '&#x2801;', ['braille','a']),
      ch('⠃', 'Braille Pattern Dots-12', '&#x2803;', ['braille','b']),
      ch('⠉', 'Braille Pattern Dots-14', '&#x2809;', ['braille','c']),
      ch('⠙', 'Braille Pattern Dots-145', '&#x2819;', ['braille','d']),
      ch('⠑', 'Braille Pattern Dots-15', '&#x2811;', ['braille','e']),
      ch('⠋', 'Braille Pattern Dots-124', '&#x280B;', ['braille','f']),
      ch('⠛', 'Braille Pattern Dots-1245', '&#x281B;', ['braille','g']),
      ch('⠓', 'Braille Pattern Dots-125', '&#x2813;', ['braille','h']),
      ch('⠊', 'Braille Pattern Dots-24', '&#x280A;', ['braille','i']),
      ch('⠚', 'Braille Pattern Dots-245', '&#x281A;', ['braille','j']),
      ch('⠅', 'Braille Pattern Dots-13', '&#x2805;', ['braille','k']),
      ch('⠇', 'Braille Pattern Dots-123', '&#x2807;', ['braille','l']),
      ch('⠍', 'Braille Pattern Dots-134', '&#x280D;', ['braille','m']),
      ch('⠝', 'Braille Pattern Dots-1345', '&#x281D;', ['braille','n']),
      ch('⠕', 'Braille Pattern Dots-135', '&#x2815;', ['braille','o']),
      ch('⠏', 'Braille Pattern Dots-1234', '&#x280F;', ['braille','p']),
      ch('⠟', 'Braille Pattern Dots-12345', '&#x281F;', ['braille','q']),
      ch('⠗', 'Braille Pattern Dots-1235', '&#x2817;', ['braille','r']),
      ch('⠎', 'Braille Pattern Dots-234', '&#x280E;', ['braille','s']),
      ch('⠞', 'Braille Pattern Dots-2345', '&#x281E;', ['braille','t']),
      ch('⠥', 'Braille Pattern Dots-136', '&#x2825;', ['braille','u']),
      ch('⠧', 'Braille Pattern Dots-1236', '&#x2827;', ['braille','v']),
      ch('⠺', 'Braille Pattern Dots-2456', '&#x283A;', ['braille','w']),
      ch('⠭', 'Braille Pattern Dots-1346', '&#x282D;', ['braille','x']),
      ch('⠽', 'Braille Pattern Dots-13456', '&#x283D;', ['braille','y']),
      ch('⠵', 'Braille Pattern Dots-1356', '&#x2835;', ['braille','z']),
      ch('⠿', 'Braille Pattern Dots-123456', '&#x283F;', ['braille','full']),
      ch('⠀', 'Braille Pattern Blank', '&#x2800;', ['braille','space','blank']),
    ],
  },
  {
    id: 'superscript', label: 'Super & Subscript', icon: 'x\u00B2',
    chars: [
      ch('\u2070', 'Superscript Zero', '&#x2070;', ['superscript','0','power']),
      ch('\u00B9', 'Superscript One', '&sup1;', ['superscript','1','power']),
      ch('\u00B2', 'Superscript Two', '&sup2;', ['superscript','2','squared','power']),
      ch('\u00B3', 'Superscript Three', '&sup3;', ['superscript','3','cubed','power']),
      ch('\u2074', 'Superscript Four', '&#x2074;', ['superscript','4','power']),
      ch('\u2075', 'Superscript Five', '&#x2075;', ['superscript','5','power']),
      ch('\u2076', 'Superscript Six', '&#x2076;', ['superscript','6','power']),
      ch('\u2077', 'Superscript Seven', '&#x2077;', ['superscript','7','power']),
      ch('\u2078', 'Superscript Eight', '&#x2078;', ['superscript','8','power']),
      ch('\u2079', 'Superscript Nine', '&#x2079;', ['superscript','9','power']),
      ch('\u207A', 'Superscript Plus Sign', '&#x207A;', ['superscript','plus']),
      ch('\u207B', 'Superscript Minus', '&#x207B;', ['superscript','minus']),
      ch('\u207C', 'Superscript Equals Sign', '&#x207C;', ['superscript','equals']),
      ch('\u207D', 'Superscript Left Parenthesis', '&#x207D;', ['superscript','paren']),
      ch('\u207E', 'Superscript Right Parenthesis', '&#x207E;', ['superscript','paren']),
      ch('\u207F', 'Superscript Latin Small Letter N', '&#x207F;', ['superscript','n']),
      ch('\u2080', 'Subscript Zero', '&#x2080;', ['subscript','0']),
      ch('\u2081', 'Subscript One', '&#x2081;', ['subscript','1']),
      ch('\u2082', 'Subscript Two', '&#x2082;', ['subscript','2']),
      ch('\u2083', 'Subscript Three', '&#x2083;', ['subscript','3']),
      ch('\u2084', 'Subscript Four', '&#x2084;', ['subscript','4']),
      ch('\u2085', 'Subscript Five', '&#x2085;', ['subscript','5']),
      ch('\u2086', 'Subscript Six', '&#x2086;', ['subscript','6']),
      ch('\u2087', 'Subscript Seven', '&#x2087;', ['subscript','7']),
      ch('\u2088', 'Subscript Eight', '&#x2088;', ['subscript','8']),
      ch('\u2089', 'Subscript Nine', '&#x2089;', ['subscript','9']),
      ch('\u208A', 'Subscript Plus Sign', '&#x208A;', ['subscript','plus']),
      ch('\u208B', 'Subscript Minus', '&#x208B;', ['subscript','minus']),
      ch('\u208C', 'Subscript Equals Sign', '&#x208C;', ['subscript','equals']),
      ch('\u208D', 'Subscript Left Parenthesis', '&#x208D;', ['subscript','paren']),
      ch('\u208E', 'Subscript Right Parenthesis', '&#x208E;', ['subscript','paren']),
    ],
  },
  {
    id: 'misc', label: 'Miscellaneous', icon: '~',
    chars: [
      ch('~', 'Tilde', '&tilde;', ['tilde','approximately']),
      ch('|', 'Vertical Line', '&#x007C;', ['pipe','bar']),
      ch('\\', 'Reverse Solidus', '&#x005C;', ['backslash']),
      ch('^', 'Circumflex Accent', '&#x005E;', ['caret','hat']),
      ch('`', 'Grave Accent', '&#x0060;', ['backtick','grave']),
      ch('\u00A0', 'No-Break Space', '&nbsp;', ['space','non-breaking']),
      ch('\u200B', 'Zero Width Space', '&#x200B;', ['zero width','invisible']),
      ch('\u200D', 'Zero Width Joiner', '&#x200D;', ['zwj','joiner','invisible']),
      ch('\u200C', 'Zero Width Non-Joiner', '&#x200C;', ['zwnj','invisible']),
      ch('\u2060', 'Word Joiner', '&#x2060;', ['word joiner','invisible']),
      ch('\uFEFF', 'Zero Width No-Break Space', '&#xFEFF;', ['bom','byte order mark']),
      ch('\u00AD', 'Soft Hyphen', '&shy;', ['hyphen','optional']),
      ch('⟨', 'Mathematical Left Angle Bracket', '&#x27E8;', ['angle','bracket']),
      ch('⟩', 'Mathematical Right Angle Bracket', '&#x27E9;', ['angle','bracket']),
      ch('⟪', 'Mathematical Left Double Angle Bracket', '&#x27EA;', ['angle','bracket','double']),
      ch('⟫', 'Mathematical Right Double Angle Bracket', '&#x27EB;', ['angle','bracket','double']),
      ch('⌈', 'Left Ceiling', '&#x2308;', ['ceiling','bracket','math']),
      ch('⌉', 'Right Ceiling', '&#x2309;', ['ceiling','bracket','math']),
      ch('⌊', 'Left Floor', '&#x230A;', ['floor','bracket','math']),
      ch('⌋', 'Right Floor', '&#x230B;', ['floor','bracket','math']),
      ch('〈', 'Left Angle Bracket', '&#x2329;', ['angle','bracket','cjk']),
      ch('〉', 'Right Angle Bracket', '&#x232A;', ['angle','bracket','cjk']),
      ch('¦', 'Broken Bar', '&brvbar;', ['broken bar','pipe']),
      ch('µ', 'Micro Sign', '&micro;', ['micro','mu']),
      ch('¼', 'Vulgar Fraction One Quarter', '&frac14;', ['fraction','quarter']),
      ch('½', 'Vulgar Fraction One Half', '&frac12;', ['fraction','half']),
      ch('¾', 'Vulgar Fraction Three Quarters', '&frac34;', ['fraction','three quarters']),
      ch('⅓', 'Vulgar Fraction One Third', '&#x2153;', ['fraction','third']),
      ch('⅔', 'Vulgar Fraction Two Thirds', '&#x2154;', ['fraction','two thirds']),
      ch('⅛', 'Vulgar Fraction One Eighth', '&#x215B;', ['fraction','eighth']),
      ch('⅜', 'Vulgar Fraction Three Eighths', '&#x215C;', ['fraction']),
      ch('⅝', 'Vulgar Fraction Five Eighths', '&#x215D;', ['fraction']),
      ch('⅞', 'Vulgar Fraction Seven Eighths', '&#x215E;', ['fraction']),
      ch('ℓ', 'Script Small L', '&#x2113;', ['liter','litre']),
      ch('℗', 'Sound Recording Copyright', '&#x2117;', ['phonogram','copyright']),
      ch('Ω', 'Ohm Sign', '&#x2126;', ['ohm','resistance','omega']),
      ch('℧', 'Inverted Ohm Sign', '&#x2127;', ['mho','conductance']),
      ch('℞', 'Prescription Take', '&#x211E;', ['rx','prescription','pharmacy']),
      ch('⅊', 'Property Line', '&#x214A;', ['property']),
    ],
  },
];

// Pre-compute total count
const TOTAL_CHARS = CHAR_DATA.reduce((sum, cat) => sum + cat.chars.length, 0);

@Component({
    selector: 'app-char-map',
    templateUrl: './char-map.component.html',
    styleUrls: ['./char-map.component.css'],
    imports: [ToolsSharedModule, FormsModule, NgIf, NgFor]
})
export class CharMapComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Special Characters & Symbols Map -- 400+ characters, click to copy with Unicode & HTML entities. No sign-up!')}&url=${encodeURIComponent(SITE_URL + '/tools/char-map')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/char-map')}`;

  readonly categories = CHAR_DATA;

  // State
  searchQuery = '';
  activeCategoryId = CHAR_DATA[0].id;
  copyFormat: CopyFormat = 'char';
  selectedChar: SelectedChar | null = null;
  recentChars: string[] = [];
  copied = false;
  copiedText = '';

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Computed
  filteredCategories: CharCategory[] = [];
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

  // -- Search ---------------------------------------------------------------

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
      this.filteredCategories = this.activeCategoryId === 'all'
        ? CHAR_DATA
        : CHAR_DATA.filter(c => c.id === this.activeCategoryId);
    } else {
      this.filteredCategories = CHAR_DATA
        .map(cat => ({
          ...cat,
          chars: cat.chars.filter(entry =>
            entry.char === q ||
            entry.name.toLowerCase().includes(q) ||
            entry.unicode.toLowerCase().includes(q) ||
            entry.html.toLowerCase().includes(q) ||
            entry.keywords.some(kw => kw.includes(q))
          ),
        }))
        .filter(cat => cat.chars.length > 0);
    }
    this.flatFilteredCount = this.filteredCategories.reduce((sum, cat) => sum + cat.chars.length, 0);
  }

  // -- Category tabs --------------------------------------------------------

  setActiveCategory(id: string): void {
    this.activeCategoryId = id;
    this.applyFilter();
  }

  // -- Copy format ----------------------------------------------------------

  setCopyFormat(format: CopyFormat): void {
    this.copyFormat = format;
  }

  // -- Char click -----------------------------------------------------------

  onCharClick(entry: CharEntry): void {
    this.selectedChar = {
      char: entry.char,
      name: entry.name,
      unicode: entry.unicode,
      html: entry.html,
    };

    let textToCopy = entry.char;
    if (this.copyFormat === 'html') textToCopy = entry.html;
    else if (this.copyFormat === 'unicode') textToCopy = entry.unicode;

    this.copyToClipboard(textToCopy);
    this.addToRecent(entry.char);

    // Easter egg: infinity symbol
    if (entry.char === '\u221E') {
      this.eggs.trigger('char-infinity');
    }
  }

  onRecentClick(char: string): void {
    // Find original entry for metadata
    let found: CharEntry | undefined;
    for (const cat of CHAR_DATA) {
      found = cat.chars.find(e => e.char === char);
      if (found) break;
    }

    const name = found ? found.name : 'recently used';
    const cp = char.codePointAt(0)!;
    const unicode = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
    const html = found ? found.html : '&#x' + cp.toString(16).toUpperCase() + ';';

    this.selectedChar = { char, name, unicode, html };

    let textToCopy = char;
    if (this.copyFormat === 'html') textToCopy = html;
    else if (this.copyFormat === 'unicode') textToCopy = unicode;

    this.copyToClipboard(textToCopy);

    // Easter egg: infinity symbol
    if (char === '\u221E') {
      this.eggs.trigger('char-infinity');
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

  // -- Recent chars ---------------------------------------------------------

  private addToRecent(char: string): void {
    if (!this.isBrowser) return;
    this.recentChars = [char, ...this.recentChars.filter(c => c !== char)].slice(0, 24);
    localStorage.setItem('cm-recent-chars', JSON.stringify(this.recentChars));
  }

  private loadRecent(): void {
    if (!this.isBrowser) return;
    try {
      const stored = localStorage.getItem('cm-recent-chars');
      if (stored) this.recentChars = JSON.parse(stored);
    } catch { /* silent */ }
  }

  clearRecent(): void {
    this.recentChars = [];
    if (this.isBrowser) localStorage.removeItem('cm-recent-chars');
  }

  // -- Helpers --------------------------------------------------------------

  get totalChars(): number {
    return TOTAL_CHARS;
  }
}
