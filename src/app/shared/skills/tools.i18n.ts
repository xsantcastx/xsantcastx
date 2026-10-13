/**
 * tools.i18n.ts — the plain words for tools: the satchel rule, power, swing
 * pace, what each tier opens and the skill cap. Lazy: merged by
 * TranslationService.register() from the surfaces that show tools, checked by
 * scripts/check-i18n-keys.js.
 */
export const TOOLS_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'toolStat.fromSatchel':     { en: 'Tools work from your satchel — no need to equip.', es: 'Las herramientas funcionan desde tu morral: no hace falta equiparlas.' },
  'toolStat.title':           { en: 'Tools', es: 'Herramientas' },
  'toolStat.power':           { en: '{{skill}} power {{n}}', es: 'Poder de {{skill}} {{n}}' },
  'toolStat.swing':           { en: '{{s}} s per swing', es: '{{s}} s por golpe' },
  'toolStat.swingStarter':    { en: '{{s}} s per swing (slowest)', es: '{{s}} s por golpe (el mas lento)' },
  'toolStat.worksAs':         { en: 'Works as tier {{tier}} until {{skill}} {{level}}', es: 'Funciona como nivel {{tier}} hasta {{skill}} {{level}}' },
  'toolStat.row':             { en: '{{name}} · tier {{tier}}', es: '{{name}} · nivel {{tier}}' },
  'toolStat.none':            { en: 'None — forge one at the Crafting Bench', es: 'Ninguna: forja una en el Banco de fabricacion' },
  'toolStat.starterHint':     { en: 'A forged one swings faster.', es: 'Una forjada golpea mas rapido.' },
  'toolStat.family.pickaxe':  { en: 'Pickaxe', es: 'Pico' },
  'toolStat.family.axe':      { en: 'Axe', es: 'Hacha' },
  'toolStat.family.sickle':   { en: 'Sickle', es: 'Hoz' },
  'toolStat.family.staff':    { en: 'Staff', es: 'Baculo' },
  'toolStat.skill.mining':      { en: 'Mining', es: 'Mineria' },
  'toolStat.skill.woodcutting': { en: 'Woodcutting', es: 'Tala' },
  'toolStat.skill.foraging':    { en: 'Foraging', es: 'Recoleccion' },
  'toolStat.skill.enchanting':  { en: 'Enchanting', es: 'Encantamiento' },
  'toolStat.opens.pickaxe.1': { en: 'Digs Cinder veins', es: 'Pica vetas de Ceniza' },
  'toolStat.opens.pickaxe.2': { en: 'Digs Slag veins', es: 'Pica vetas de Escoria' },
  'toolStat.opens.pickaxe.3': { en: 'Digs Heartstone veins', es: 'Pica vetas de Piedracorazon' },
  'toolStat.opens.pickaxe.4': { en: 'Digs Emberheart veins', es: 'Pica vetas de Corazon de ascua' },
  'toolStat.opens.axe.1':     { en: 'Fells World-Root saplings', es: 'Tala brotes de Raiz del mundo' },
  'toolStat.opens.axe.2':     { en: 'Taps sap trees', es: 'Sangra arboles de savia' },
  'toolStat.opens.axe.3':     { en: 'Fells Golden Oaks', es: 'Tala Robles dorados' },
  'toolStat.opens.axe.4':     { en: 'Fells Shadowbark trees', es: 'Tala arboles de Corteza sombria' },
  'toolStat.opens.sickle.1':  { en: 'Cuts Starlight Herb', es: 'Corta Hierba de luz estelar' },
  'toolStat.opens.sickle.2':  { en: 'Cuts Sunbloom', es: 'Corta Flor del sol' },
  'toolStat.opens.sickle.3':  { en: 'Cuts Nightbloom', es: 'Corta Flor nocturna' },
  'toolStat.opens.sickle.4':  { en: 'Cuts Thornroot', es: 'Corta Raiz espinosa' },
  'toolStat.opens.staff.1':   { en: 'Breaks ember wards', es: 'Rompe sellos de ascua' },
  'toolStat.opens.staff.2':   { en: 'Shatters prism clusters', es: 'Quiebra racimos de prisma' },
  'toolStat.opens.staff.3':   { en: 'Shatters quartz geodes', es: 'Quiebra geodas de cuarzo' },
  'toolStat.opens.staff.4':   { en: 'Shatters void geodes', es: 'Quiebra geodas del vacio' },
};
