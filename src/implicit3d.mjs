// Restricted implicit equation parser, independent of JavaScript evaluation.
const functions={sin:Math.sin,cos:Math.cos,exp:Math.exp,log:Math.log,sqrt:Math.sqrt,abs:Math.abs};
export function compileImplicit(source){
 if(typeof source!=="string"||source.length>240)throw Error("Equation too long");
 const sides=source.split("=");if(sides.length!==2)throw Error("Exactly one equality required");
 function parse(src){
  const re=/\s*(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[a-zA-Z]+|[()+*/^,-])/gy;let pos=0,t=[];
  while(pos<src.length){re.lastIndex=pos;const m=re.exec(src);if(!m)throw Error("Unexpected character");t.push(m[1]);pos=re.lastIndex;if(t.length>180)throw Error("Too many tokens")}
  let i=0,complexity=0;const take=v=>t[i]===v?(i++,true):false;
  const node=(fn)=>{if(++complexity>180)throw Error("Expression too complex");return fn};
  function atom(){
   if(take("(")){const f=sum();if(!take(")"))throw Error("Expected )");return f}
   const v=t[i++];if(v===undefined)throw Error("Incomplete expression");
   if(/^\d/.test(v)){const n=Number(v);if(!Number.isFinite(n))throw Error("Nonfinite number");return node(()=>n)}
   if(["x","y","z"].includes(v))return node(p=>p[v]);
   if(v==="pi")return node(()=>Math.PI);if(v==="e")return node(()=>Math.E);
   if(Object.hasOwn(functions,v)){if(!take("("))throw Error("Expected function (");const f=sum();if(!take(")"))throw Error("Expected )");return node(p=>functions[v](f(p)))}
   throw Error("Unknown symbol "+v);
  }
  function power(){let f=atom();if(take("^")){const a=f,b=unary();f=node(p=>a(p)**b(p))}return f}
  function unary(){if(take("-")){const f=unary();return node(p=>-f(p))}if(take("+"))return unary();return power()}
  function product(){let f=unary();while(t[i]==="*"||t[i]==="/"){const op=t[i++],a=f,b=unary();f=node(p=>op==="*"?a(p)*b(p):a(p)/b(p))}return f}
  function sum(){let f=product();while(t[i]==="+"||t[i]==="-"){const op=t[i++],a=f,b=product();f=node(p=>op==="+"?a(p)+b(p):a(p)-b(p))}return f}
  const f=sum();if(i!==t.length)throw Error("Trailing tokens");return f;
 }
 const a=parse(sides[0]),b=parse(sides[1]);
 return (x,y,z)=>{if(![x,y,z].every(Number.isFinite))throw Error("Coordinates must be finite");return a({x,y,z})-b({x,y,z})};
}
export function implicitPoints(f,{steps=22,extent=1.5,threshold=.13}={}){
 if(!Number.isInteger(steps)||steps<4||steps>48||!Number.isFinite(extent)||extent<=0||!Number.isFinite(threshold)||threshold<=0)throw Error("Invalid sampling settings");
 const points=[];for(let i=0;i<=steps;i++)for(let j=0;j<=steps;j++)for(let k=0;k<=steps;k++){
 const x=extent*(2*i/steps-1),y=extent*(2*j/steps-1),z=extent*(2*k/steps-1),v=f(x,y,z);
 if(Number.isFinite(v)&&Math.abs(v)<threshold)points.push({x,y,z});
 }return points;
}
