import { createInterface } from "node:readline";
import { EmberError, ValidationError } from "./errors.mjs";
import { cloneState, initialState, nowUtc } from "./model.mjs";
import { explanationView, inspectionView } from "./projection.mjs";
import { startRuntime, stopRuntime, runCognition } from "./runtime.mjs";
import { attachDetail, rememberEpisode, rememberFact, rememberPreference, rememberRelationship, supersede, undertake, withholdDetail } from "./semantics.mjs";
import { StateStore } from "./store.mjs";

export async function main(argv=process.argv.slice(2),io={input:process.stdin,output:process.stdout,error:process.stderr}){
  try{const args=parseArgs(argv);switch(args.command){
    case "init":await new StateStore(args.state).create(initialState(args.name,args.principal));io.output.write("initialized schema v1 continuity state\n");break;
    case "run":return await runInteractive(args,io);
    case "inspect":{const state=await loadForPrincipal(new StateStore(args.state),args.principal),view=inspectionView(state);io.output.write(args.json?`${JSON.stringify(view,null,2)}\n`:renderInspection(view));break;}
    case "explain":{const state=await loadForPrincipal(new StateStore(args.state),args.principal);io.output.write(`${JSON.stringify(explanationView(state,args.meaningId),null,2)}\n`);break;}
    case "correct":{const store=new StateStore(args.state),lease=await store.acquireWriteLease();try{const state=await loadForPrincipal(store,args.principal),candidate=cloneState(state),id=supersede(candidate,args.principal,args.meaningId,args.text,{reason:args.reason});await store.commit(state.revision,candidate);io.output.write(`${id}\n`);}finally{await store.releaseWriteLease(lease);}break;}
    case "check":{const store=new StateStore(args.state),state=await store.load(),lock=await store.lockStatus();io.output.write(`valid schema v1 revision ${state.revision}; lock ${JSON.stringify(lock)}\n`);break;}
    case "lock-status":{const status=await new StateStore(args.state).lockStatus();io.output.write(`${JSON.stringify(status,null,2)}\n`);break;}
    case "quarantine-stale-lock":{const destination=await new StateStore(args.state).quarantineStaleLock({ownerToken:args.ownerToken,confirmQuiescent:args.confirmQuiescent});io.output.write(`${destination}\n`);break;}
  }return 0;}catch(error){if(error instanceof EmberError||error instanceof SyntaxError||isOperationalSystemError(error)){io.error.write(`ember: ${error.message}\n`);return 2;}throw error;}
}

async function runInteractive(args,io){const store=new StateStore(args.state),lease=await store.acquireWriteLease();try{let state=await loadForPrincipal(store,args.principal);const started=startRuntime(state,args.principal,args.scope);state=await store.commit(state.revision,started.state);io.output.write(`runtime ${started.runtimeId} started\n`);let stopReason="input_eof";const lines=createInterface({input:io.input,crlfDelay:Infinity,terminal:false});for await(const line of lines){if(!line.trim())continue;if(line===":quit"){stopReason="explicit_cli_exit";break;}try{if(line.startsWith(":")){if(line.startsWith(":ask ")){const result=await ask(args,store,state,started.runtimeId,line,io.output);state=result.state;if(result.providerFailure)io.error.write(`provider: ${result.providerFailure}\n`);}else{const result=await semanticCommand(store,state,started.runtimeId,args.principal,args.scope,line);state=result.state;io.output.write(`${result.id}\n`);}}else{const result=await runCognition(store,state,{runtimeId:started.runtimeId,principal:args.principal,scope:args.scope,text:line,command:args.providerCommand,arguments_:args.providerArgs,timeoutSeconds:args.providerTimeoutSeconds,output:io.output});state=result.state;if(result.providerFailure)io.error.write(`provider: ${result.providerFailure}\n`);}}catch(error){if(error instanceof EmberError)io.error.write(`command rejected: ${error.message}\n`);else throw error;}}
    const stopped=stopRuntime(state,started.runtimeId,{reason:stopReason});await store.commit(state.revision,stopped);return 0;}finally{await store.releaseWriteLease(lease);}}
async function semanticCommand(store,state,runtimeId,principal,scope,line){const parts=splitCommand(line),candidate=cloneState(state);let id;if(parts[0]===":remember"&&parts[1]==="relationship"&&parts.length>=5)id=rememberRelationship(candidate,principal,parts[2],parts[3],parts.slice(4).join(" "));else if(parts[0]===":remember"&&parts[1]==="fact"&&parts.length>=6)id=rememberFact(candidate,principal,parts[2],parts[3],parts[4],parts.slice(5).join(" "));else if(parts[0]===":prefer"&&parts.length>=5)id=rememberPreference(candidate,principal,parts[1],parts[2],parts[3],parts.slice(4).join(" "));else if(parts[0]===":supersede"&&parts.length>=3)id=supersede(candidate,principal,parts[1],parts.slice(2).join(" "));else if(parts[0]===":undertake"&&parts.length>=4)id=undertake(candidate,principal,parts[1],parts[2],parts.slice(3).join(" "));else if(parts[0]===":remember"&&parts[1]==="episode"&&parts.length>=6)id=rememberEpisode(candidate,principal,parts[2],parts[3],parts[4],parts.slice(5).join(" "));else if(parts[0]===":attach-detail"&&parts.length>=3)id=attachDetail(candidate,principal,parts[1],parts.slice(2).join(" "));else if(parts[0]===":fixture-withhold"&&parts.length===2){if(process.env.EMBER_ENABLE_FIXTURE_FAULTS!=="1")throw new ValidationError("fixture fault command is available only to deterministic test harness");id=withholdDetail(candidate,principal,parts[1]);}else throw new ValidationError("unsupported or malformed semantic command");const runtime=candidate.operations.runtime_episodes.find(r=>r.runtime_id===runtimeId);if(runtime.clean_stop_at===null)runtime.last_durable_observation_at=nowUtc();return {state:await store.commit(state.revision,candidate),id};}
async function ask(args,store,state,runtimeId,line,output){const parts=splitCommand(line);if(parts.length<4||parts[0]!==":ask"||parts[1]!=="--explain")throw new ValidationError("expected :ask --explain ID[,ID...] TEXT");const ids=parts[2].split(",").filter(Boolean);if(!ids.length)throw new ValidationError("at least one explanation ID is required");return runCognition(store,state,{runtimeId,principal:args.principal,scope:args.scope,text:parts.slice(3).join(" "),command:args.providerCommand,arguments_:args.providerArgs,timeoutSeconds:args.providerTimeoutSeconds,output,purpose:"explain",explainIds:ids});}
async function loadForPrincipal(store,principal){const state=await store.load();if(principal!==state.runtime_contract.local_principal)throw new ValidationError("asserted principal does not match initialized local principal");return state;}
function renderInspection(view){let text=`Lineage ${view.lineage.lineage_id} (${view.lineage.display_name}), revision ${view.revision}\nConstitutive boundaries:\n`;for(const b of view.lineage.constitutive_boundaries)text+=`  ${b.boundary_id}: ${b.text}\n`;for(const [label,key] of [["Current meanings","current_meanings"],["Historical/superseded meanings","historical_meanings"],["Unavailable gaps","gaps"],["Runtime episodes","runtime_episodes"],["Cognition episodes","cognition_episodes"]]){text+=`${label}:\n`;for(const item of view[key])text+=`  ${JSON.stringify(item)}\n`;}return text;}

export function splitCommand(line){const result=[];let token="",quote=null,escaping=false,started=false;for(const char of line){if(escaping){token+=char;escaping=false;started=true;continue;}if(char==="\\"&&quote!=="'"){escaping=true;started=true;continue;}if(quote){if(char===quote){quote=null;started=true;}else token+=char;continue;}if(char==="'"||char==='"'){quote=char;started=true;continue;}if(/\s/.test(char)){if(started){result.push(token);token="";started=false;}continue;}token+=char;started=true;}if(escaping)throw new ValidationError("malformed quoted command: dangling escape");if(quote)throw new ValidationError("malformed quoted command: unterminated quote");if(started)result.push(token);return result;}

export function parseArgs(argv){
  if(!argv.length)throw new ValidationError("a command is required");
  const command=argv[0];
  const specs={
    init:{flags:["--state","--name","--principal"],positionals:0},
    run:{flags:["--state","--principal","--scope","--provider-command","--provider-arg","--provider-timeout-seconds"],repeatable:["--provider-arg"],positionals:0},
    inspect:{flags:["--state","--principal","--json"],booleans:["--json"],positionals:0},
    explain:{flags:["--state","--principal"],positionals:1},
    correct:{flags:["--state","--principal","--text","--reason"],positionals:1},
    check:{flags:["--state"],positionals:0},
    "lock-status":{flags:["--state"],positionals:0},
    "quarantine-stale-lock":{flags:["--state","--owner-token","--confirm-quiescent"],booleans:["--confirm-quiescent"],positionals:0},
  };
  const spec=specs[command];if(!spec)throw new ValidationError(`unsupported command: ${command}`);
  const allowed=new Set(spec.flags),booleans=new Set(spec.booleans??[]),repeatable=new Set(spec.repeatable??[]),values={},positionals=[];
  for(let i=1;i<argv.length;i++){
    const item=argv[i];
    if(!item.startsWith("--")){positionals.push(item);continue;}
    if(!allowed.has(item))throw new ValidationError(`unsupported option for ${command}: ${item}`);
    if(item in values&&!repeatable.has(item))throw new ValidationError(`${item} must not be repeated`);
    if(booleans.has(item)){values[item]=true;continue;}
    if(i+1>=argv.length)throw new ValidationError(`${item} requires a value`);
    if(repeatable.has(item))(values[item]??=[]).push(argv[++i]);else values[item]=argv[++i];
  }
  if(positionals.length!==spec.positionals)throw new ValidationError(`${command} requires ${spec.positionals} positional argument${spec.positionals===1?"":"s"}`);
  const required=flag=>{if(typeof values[flag]!=="string"||!values[flag])throw new ValidationError(`${flag} is required`);return values[flag];};
  const base={command};
  if(command==="init")return{...base,state:required("--state"),name:required("--name"),principal:required("--principal")};
  if(command==="run"){const timeout=Number(required("--provider-timeout-seconds"));if(!Number.isFinite(timeout)||timeout<=0)throw new ValidationError("--provider-timeout-seconds must be a positive finite number");return{...base,state:required("--state"),principal:required("--principal"),scope:required("--scope"),providerCommand:required("--provider-command"),providerArgs:values["--provider-arg"]??[],providerTimeoutSeconds:timeout};}
  if(command==="inspect")return{...base,state:required("--state"),principal:required("--principal"),json:values["--json"]===true};
  if(command==="explain")return{...base,state:required("--state"),principal:required("--principal"),meaningId:positionals[0]};
  if(command==="correct")return{...base,state:required("--state"),principal:required("--principal"),meaningId:positionals[0],text:required("--text"),reason:required("--reason")};
  if(command==="check"||command==="lock-status")return{...base,state:required("--state")};
  return{...base,state:required("--state"),ownerToken:required("--owner-token"),confirmQuiescent:values["--confirm-quiescent"]===true};
}

function isOperationalSystemError(error){return error!==null&&typeof error==="object"&&typeof error.code==="string"&&/^E[A-Z0-9]+$/.test(error.code);}
