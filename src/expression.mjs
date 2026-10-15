// Strict mathematical expression parser: no eval, globals or property access.
const tokens=s=>{const re=/\s*([0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|[A-Za-z]+|[()+*/^,-])/gy;let pos=0,out=[];while(pos<s.length){re.lastIndex=pos;const m=re.exec(s);if(!m)throw Error("Invalid character at "+pos);out.push(m[1]);pos=re.lastIndex;if(out.length>256)throw Error("Expression too long")}return out};
export function compileExpression(source){
 const t=tokens(source);let i=0,nodes=0;
 const node=(type,extra={})=>{if(++nodes>256)throw Error("Expression too complex");return {type,...extra}};
 const peek=()=>t[i],take=v=>peek()===v?(i++,true):false;
 function primary(){if(take("(")){const e=add();if(!take(")"))throw Error("Expected )");return e}const v=t[i++];if(v===undefined)throw Error("Unexpected end");if(/^\d/.test(v))return node("number",{value:Number(v)});if(v==="x"||v==="pi"||v==="e")return node("symbol",{name:v});if(["sin","cos","exp","log","sqrt","abs"].includes(v)){if(!take("("))throw Error("Expected ( after function");const arg=add();if(!take(")"))throw Error("Expected )");return node("call",{name:v,arg})}throw Error("Unsupported symbol: "+v)}
 function unary(){if(take("+"))return unary();if(take("-"))return node("neg",{arg:unary()});return primary()}
 function power(){const left=unary();return take("^")?node("binary",{op:"^",left,right:power()}):left}
 function mult(){let a=power();while(peek()==="*"||peek()==="/"){const op=t[i++];a=node("binary",{op,left:a,right:power()})}return a}
 function add(){let a=mult();while(peek()==="+"||peek()==="-"){const op=t[i++];a=node("binary",{op,left:a,right:mult()})}return a}
 const ast=add();if(i!==t.length)throw Error("Unexpected token: "+peek());
 function calc(a,x){switch(a.type){case "number":return a.value;case "symbol":return a.name==="x"?x:a.name==="pi"?Math.PI:Math.E;case "neg":return -calc(a.arg,x);case "call":return ({sin:Math.sin,cos:Math.cos,exp:Math.exp,log:Math.log,sqrt:Math.sqrt,abs:Math.abs})[a.name](calc(a.arg,x));case "binary":{const l=calc(a.left,x),r=calc(a.right,x);return ({"+":()=>l+r,"-":()=>l-r,"*":()=>l*r,"/":()=>l/r,"^":()=>l**r})[a.op]()}}}
 return {ast,evaluate:x=>{if(!Number.isFinite(x))throw Error("x must be finite");return calc(ast,x)}};
}
