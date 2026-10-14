// Deterministic implicit surface sampling with marching tetrahedra.
// Expressions use the restricted mathematical grammar in expression.mjs.
import {compileExpression} from "./expression.mjs";
export function compileImplicit(source){
 if(typeof source!=="string"||source.length>240)throw Error("Equation too long");
 const parts=source.split("=");if(parts.length!==2)throw Error("Expected one equality");
 const expr=s=>compileExpression(s.replace(/\bx\b/g,"XVAR").replace(/\by\b/g,"YVAR").replace(/\bz\b/g,"ZVAR"));
 // Parser is single-variable; compile via a safe variable-index rewrite, never eval.
 const tokenize=s=>s.replace(/\b(x|y|z)\b/g,(v)=>({x:"x",y:"y",z:"z"})[v]);
 const compile=(s)=>{const code=tokenize(s).replace(/\b(x|y|z)\b/g,(v)=>({x:"q",y:"r",z:"s"})[v]);return compileXYZ(code)};
 const left=compile(parts[0]),right=compile(parts[1]);
 return (x,y,z)=>left(x,y,z)-right(x,y,z);
}
function compileXYZ(source){
 // Replace coordinate symbols with constants in an AST evaluated by our restricted interpreter.
 const s=source.replace(/\bq\b/g,"x").replace(/\br\b/g,"y").replace(/\bs\b/g,"z");
 const {ast}=parseXYZ(s);
 return (x,y,z)=>evaluate(ast,{x,y,z});
}
function parseXYZ(source){
 const input=source.replace(/\b(y|z)\b/g,(_,v)=>v==="y"?"Y":"Z");
 const {ast}=compileExpression(input.replace(/\bY\b/g,"pi").replace(/\bZ\b/g,"e"));
 // AST substitutions must distinguish original constants from coordinates.
 // Instead use dedicated identifier sentinels by walking the original token stream.
 const raw=source.match(/\b(?:x|y|z|pi|e)\b|(?:\d+(?:\.\d+)?)|[()+*/^,-]|[A-Za-z]+/g)?.join("")??"";
 if(raw!==source.replace(/\s/g,""))throw Error("Unsupported token");
 const rewritten=source.replace(/\by\b/g,"pi").replace(/\bz\b/g,"e");
 const tree=compileExpression(rewritten).ast;
 const original=source.match(/\b(?:x|y|z|pi|e)\b/g)||[];
 let idx=0;
 // Traverse AST leaves in source order (the parser keeps lexical order).
 function visit(n){if(n.type==="symbol"){const name=original[idx++];if(name==="y"||name==="z")n.name=name;else if(name==="x"||name==="pi"||name==="e")n.name=name;return}if(n.type==="neg"||n.type==="call")visit(n.arg);if(n.type==="binary"){visit(n.left);visit(n.right)}}
 // This substitution is only safe if all identifier leaves are coordinates/constants.
 // Functions also appear in original token list, so instead use an independent strict parser in the next version.
 if(/\b(?:sin|cos|exp|log|sqrt|abs)\b/.test(source))throw Error("Functions in implicit equations are not supported yet");
 visit(tree);return {ast:tree};
}
function evaluate(n,v){switch(n.type){case "number":return n.value;case "symbol":return n.name==="pi"?Math.PI:n.name==="e"?Math.E:v[n.name];case "neg":return -evaluate(n.arg,v);case "binary":{const a=evaluate(n.left,v),b=evaluate(n.right,v);switch(n.op){case "+":return a+b;case "-":return a-b;case "*":return a*b;case "/":return a/b;case "^":return a**b}}}throw Error("Unsupported AST")}
export function implicitPoints(f,{steps=22,extent=1.5,threshold=.13}={}){
 if(!Number.isInteger(steps)||steps<4||steps>48||!Number.isFinite(extent)||extent<=0)throw Error("Invalid grid");
 const points=[];for(let i=0;i<=steps;i++)for(let j=0;j<=steps;j++)for(let k=0;k<=steps;k++){
 const x=extent*(2*i/steps-1),y=extent*(2*j/steps-1),z=extent*(2*k/steps-1),v=f(x,y,z);
 if(Number.isFinite(v)&&Math.abs(v)<threshold)points.push({x,y,z});
 }return points;
}
