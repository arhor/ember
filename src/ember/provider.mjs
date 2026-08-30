import { spawn } from "node:child_process";
import { basename } from "node:path";
import { ProviderError } from "./errors.mjs";

export const CONTRACT_VERSION=1,MAX_STDOUT_BYTES=1024*1024,MAX_STDERR_BYTES=64*1024;
const decoder=new TextDecoder("utf-8",{fatal:true});

export async function invokeProvider(command,arguments_,request,{timeoutSeconds,spawnImpl=spawn,terminationGraceMs=100,finalTerminationMs=500}={}){
  if(!Number.isFinite(timeoutSeconds)||timeoutSeconds<=0)throw new ProviderError("provider timeout must be a positive finite number");
  let child;try{child=spawnImpl(command,[...arguments_],{shell:false,stdio:["pipe","pipe","pipe"]});}catch(error){throw new ProviderError(`provider is unavailable: ${error.message}`,{cause:error});}
  const stdout=[],stderr=[];let stdoutBytes=0,stderrBytes=0,oversized=false,timedOut=false,spawnError=null,closed=false,exitCode=null,exitSignal=null,settled=false,terminationStarted=false,killTimer=null,finalTimer=null;
  let resolveDone;const done=new Promise(resolve=>{resolveDone=resolve;});
  const onStdinError=()=>{};
  const closePipes=()=>{child.stdin?.destroy();child.stdout?.destroy();child.stderr?.destroy();};
  const terminate=()=>{if(settled||terminationStarted)return;terminationStarted=true;closePipes();try{child.kill("SIGTERM");}catch{}killTimer=setTimeout(()=>{if(!closed){try{child.kill("SIGKILL");}catch{}}},terminationGraceMs);finalTimer=setTimeout(()=>{if(!closed&&!settled){settled=true;closePipes();resolveDone({unconfirmed:true});}},finalTerminationMs);};
  const onStdout=chunk=>{stdoutBytes+=chunk.length;if(stdoutBytes<=MAX_STDOUT_BYTES)stdout.push(chunk);else if(!oversized){oversized=true;terminate();}};
  const onStderr=chunk=>{if(stderrBytes<MAX_STDERR_BYTES){const keep=chunk.subarray(0,MAX_STDERR_BYTES-stderrBytes);stderr.push(keep);stderrBytes+=keep.length;}};
  const onSpawnError=error=>{spawnError=error;};
  const onClose=(code,signal)=>{closed=true;exitCode=code;exitSignal=signal;clearTimeout(killTimer);clearTimeout(finalTimer);if(!settled){settled=true;resolveDone({unconfirmed:false});}};
  child.stdout.on("data",onStdout);child.stderr.on("data",onStderr);child.on("error",onSpawnError);child.on("close",onClose);
  const timer=setTimeout(()=>{timedOut=true;terminate();},timeoutSeconds*1000);
  const wire=Buffer.from(JSON.stringify(request),"utf8");child.stdin.on("error",onStdinError);try{child.stdin.end(wire);}catch(error){spawnError=error;terminate();}
  const terminal=await done;clearTimeout(timer);clearTimeout(killTimer);clearTimeout(finalTimer);child.stdin.off("error",onStdinError);child.stdout.off("data",onStdout);child.stderr.off("data",onStderr);child.off("error",onSpawnError);child.off("close",onClose);if(terminal.unconfirmed)closePipes();
  const diagnostic=decodeDiagnostic(Buffer.concat(stderr));
  if(terminal.unconfirmed)throw new ProviderError(`${timedOut?"provider timed out":oversized?"provider stdout exceeds 1 MiB":"provider termination was not observed"}; direct-child termination unconfirmed`,{outcome:"outcome_unknown",terminationConfirmed:false});
  if(spawnError)throw new ProviderError(`provider is unavailable: ${spawnError.message}`,{cause:spawnError});
  if(timedOut)throw new ProviderError(`provider timed out${diagnostic?`: ${diagnostic}`:""}`,{outcome:"timed_out"});
  if(oversized||stdoutBytes>MAX_STDOUT_BYTES)throw new ProviderError("provider stdout exceeds 1 MiB");
  if(exitCode!==0)throw new ProviderError(`provider exited with ${exitSignal?`signal ${exitSignal}`:`status ${exitCode}`}${diagnostic?`: ${diagnostic}`:""}`);
  let text;try{text=decoder.decode(Buffer.concat(stdout));}catch(error){throw new ProviderError("provider stdout is not UTF-8",{cause:error});}
  let result;try{result=JSON.parse(text);}catch(error){throw new ProviderError(`provider stdout is not exactly one JSON object: ${error.message}`,{cause:error});}
  validateProviderResult(result,new Set(request.projection.selection.meaning_ids));return result;
}
export function validateProviderResult(result,selected){if(result===null||typeof result!=="object"||Array.isArray(result))throw new ProviderError("provider result must be an object");const fields=Object.keys(result).sort();if(JSON.stringify(fields)!==JSON.stringify(["contract_version","reply","used_meaning_ids"].sort()))throw new ProviderError("provider result contains missing or unsupported fields");if(!Number.isSafeInteger(result.contract_version)||result.contract_version!==1)throw new ProviderError("provider result contract_version is unsupported");if(typeof result.reply!=="string"||!result.reply.trim())throw new ProviderError("provider reply must be non-empty");if(!Array.isArray(result.used_meaning_ids)||!result.used_meaning_ids.every(v=>typeof v==="string"))throw new ProviderError("used_meaning_ids must be a string list");if(new Set(result.used_meaning_ids).size!==result.used_meaning_ids.length)throw new ProviderError("used_meaning_ids must not contain duplicates");if(!result.used_meaning_ids.every(id=>selected.has(id)))throw new ProviderError("provider claimed a meaning outside its projection");}
export function providerLabel(command){return basename(command)||command;}
function decodeDiagnostic(bytes){return new TextDecoder("utf-8",{fatal:false}).decode(bytes).trim();}
