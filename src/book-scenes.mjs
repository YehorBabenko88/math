// Curated from the uploaded books; not automated OCR.
export const bookScenes=[
 {id:"hartshorne-conic",book:"Hartshorne, Algebraic Geometry",page:17,title:"Аффинное многообразие",kind:"implicit",equation:"x²+y²−1=0",source:"Глава I, §1: нули многочленов задают алгебраические множества",description:"Окружность — множество нулей x²+y²−1. В 3D это цилиндр, если z свободен.",parameters:{radius:1}},
 {id:"hartshorne-intersection",book:"Hartshorne, Algebraic Geometry",page:32,title:"Пересечение квадрик",kind:"intersection",equation:"z=x²−y²; z=0",source:"Глава I, §2: пересечения алгебраических многообразий",description:"Пересечение гиперболического параболоида с плоскостью z=0: две прямые y=±x.",parameters:{}},
 {id:"sveshnikov-wave",book:"Sveshnikov, Bogolyubov, Kravtsov, Lectures on Mathematical Physics",page:11,title:"Колебание упругого стержня",kind:"wave",equation:"u_tt = a²u_xx",source:"Глава I, §1, уравнение (1.8): малые продольные колебания",description:"Демонстрационное решение u(x,t)=sin(πx)cos(πat) при закреплённых концах.",parameters:{a:1}},
 {id:"sveshnikov-heat",book:"Sveshnikov, Bogolyubov, Kravtsov, Lectures on Mathematical Physics",page:26,title:"Теплопроводность",kind:"heat",equation:"u_t = κu_xx",source:"Глава I, §2, уравнения теплового баланса; упрощение для постоянных коэффициентов",description:"Синусоидальная температурная неоднородность затухает: u(x,t)=sin(πx)exp(−κπ²t).",parameters:{kappa:0.15}}
];
export function sampleScene(id,t=0,count=81){
 const s=bookScenes.find(x=>x.id===id);if(!s)throw Error("Unknown book scene");
 return Array.from({length:count},(_,i)=>{const x=i/(count-1),y=s.kind==="wave"?Math.sin(Math.PI*x)*Math.cos(Math.PI*s.parameters.a*t):s.kind==="heat"?Math.sin(Math.PI*x)*Math.exp(-s.parameters.kappa*Math.PI**2*t):s.kind==="implicit"?Math.sqrt(Math.max(0,1-(2*x-1)**2)):Math.abs(2*x-1);return {x,y}});
}
