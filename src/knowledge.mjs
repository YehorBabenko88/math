// Small, curated and attributable starter graph; AI-extracted claims must be reviewed.
export const concepts=[
{id:"sets",title:"Множества",area:"Основы",description:"Принадлежность, пересечение, объединение"},
{id:"functions",title:"Функции",area:"Анализ",description:"Соответствие входа и выхода"},
{id:"polynomials",title:"Многочлены",area:"Алгебра",description:"Корни и коэффициенты"},
{id:"complex",title:"Комплексная плоскость",area:"Алгебра",description:"Действительная и мнимая координаты"},
{id:"signals",title:"Временные ряды",area:"Прикладная математика",description:"Измерения во времени"},
{id:"spectra",title:"Спектральный анализ",area:"Анализ",description:"Частотные компоненты сигналов"}
];
export const links=[
{from:"sets",to:"functions",kind:"foundation"},
{from:"functions",to:"polynomials",kind:"example"},
{from:"polynomials",to:"complex",kind:"roots"},
{from:"signals",to:"spectra",kind:"transform"},
{from:"signals",to:"polynomials",kind:"experimental",warning:"Выбор коэффициентов произволен"}
];
export function neighbors(id){return links.filter(e=>e.from===id||e.to===id)}
