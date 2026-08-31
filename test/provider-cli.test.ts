import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { parseArgs } from "../src/ember/cli.ts";
import { ProviderError } from "../src/ember/errors.ts";
import { cloneState, initialState, validateState } from "../src/ember/model.ts";
import { buildProjection } from "../src/ember/projection.ts";
import { invokeProvider, validateProviderResult } from "../src/ember/provider.ts";
import { runCognition, startRuntime } from "../src/ember/runtime.ts";
import { StateStore } from "../src/ember/store.ts";
import { captureError, command, emptyRequest, populatedState, PRINCIPAL, PROVIDER, readJson, ROOT, SCOPE, tempDir } from "./support.ts";

async function providerError(mode,request=emptyRequest(),timeoutSeconds=1){return captureError(()=>invokeProvider(process.execPath,[PROVIDER,"--mode",mode],request,{timeoutSeconds}));}
async function startedStore(){const directory=await tempDir(),path=join(directory,"ember.json"),store=new StateStore(path),{state}=populatedState();await store.create(state);const lease=await store.acquireWriteLease(),loaded=await store.load(),started=startRuntime(loaded,PRINCIPAL,SCOPE,{timestamp:"2026-08-29T10:00:00Z"}),committed=await store.commit(loaded.revision,started.state);return{directory,path,store,lease,state:committed,runtimeId:started.runtimeId};}

test("scripted provider should stay outside automatic discovery when repository tests run",()=>{
  // Given
  const automaticDiscoveryRoot=join(ROOT,"test");
  // When
  const providerIsInside=PROVIDER===automaticDiscoveryRoot||PROVIDER.startsWith(`${automaticDiscoveryRoot}/`);
  // Then
  assert.equal(providerIsInside,false);
});

test("provider adapter should accept one result when result uses only selected meanings",async()=>{
  // Given
  const {state}=populatedState(),started=startRuntime(state,PRINCIPAL,SCOPE,{timestamp:"2026-08-29T10:00:00Z"}),projection=buildProjection(started.state,{principal:PRINCIPAL,scope:SCOPE,currentInput:"hello",currentTime:"2026-08-29T10:00:01Z",runtimeId:started.runtimeId}),request={contract_version:1,cognition_id:"cognition-test",projection,input:{text:"hello"}};
  // When
  const result=await invokeProvider(process.execPath,[PROVIDER],request,{timeoutSeconds:1});
  // Then
  assert.deepEqual(new Set(result.used_meaning_ids),new Set(projection.selection.meaning_ids));
});
test("provider adapter should reject result when provider requests canonical mutation",async()=>{
  // Given
  const request=emptyRequest();
  // When
  const error=await providerError("unknown-field",request);
  // Then
  assert.match(error.message,/unsupported fields/);
});
test("provider adapter should reject output when stdout contains extra data",async()=>{
  // Given
  const request=emptyRequest();
  // When
  const error=await providerError("extra",request);
  // Then
  assert.match(error.message,/exactly one JSON object/);
});
test("provider adapter should report timeout when fresh process exceeds limit",async()=>{
  // Given
  const request=emptyRequest();
  // When
  const error=await providerError("timeout",request,0.03);
  // Then
  assert.equal(error.outcome,"timed_out");
});
test("provider adapter should close local pipes and report unknown when termination is unconfirmed",async()=>{
  // Given
  const child=new EventEmitter(),signals=[];Object.assign(child,{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough(),kill:signal=>{signals.push(signal);return true;}});
  // When
  const error=await captureError(()=>invokeProvider("fixture",[],emptyRequest(),{timeoutSeconds:0.005,spawnImpl:()=>child,terminationGraceMs:5,finalTerminationMs:20}));
  // Then
  assert.deepEqual([error.outcome,error.terminationConfirmed,signals,child.stdin.destroyed,child.stdout.destroyed,child.stderr.destroyed,child.stdout.listenerCount("data"),child.stderr.listenerCount("data")],["outcome_unknown",false,["SIGTERM","SIGKILL"],true,true,true,0,0]);
});
test("provider adapter should reject timeout when value is not finite",async()=>{
  // Given
  const request=emptyRequest();
  // When
  const error=await captureError(()=>invokeProvider(process.execPath,[PROVIDER],request,{timeoutSeconds:NaN}));
  // Then
  assert.match(error.message,/positive finite/);
});
test("provider adapter should reject result when boolean impersonates contract version",async()=>{
  // Given
  const result={contract_version:true,reply:"text",used_meaning_ids:[]};
  // When
  const error=await captureError(()=>validateProviderResult(result,new Set()));
  // Then
  assert.match(error.message,/unsupported/);
});
test("provider adapter should reject output when stdout is malformed JSON",async()=>{
  // Given
  const request=emptyRequest();
  // When
  const error=await providerError("malformed",request);
  // Then
  assert.match(error.message,/exactly one JSON object/);
});
test("provider adapter should reject output when reply is empty",async()=>{
  // Given
  const request=emptyRequest();
  // When
  const error=await providerError("empty",request);
  // Then
  assert.match(error.message,/non-empty/);
});
test("provider adapter should reject output when stdout exceeds contract limit",async()=>{
  // Given
  const request=emptyRequest();
  // When
  const error=await providerError("oversized",request);
  // Then
  assert.match(error.message,/exceeds 1 MiB/);
});
test("provider adapter should reject output when stdout is invalid UTF-8",async()=>{
  // Given
  const request=emptyRequest();
  // When
  const error=await providerError("invalid-utf8",request);
  // Then
  assert.match(error.message,/not UTF-8/);
});
test("provider adapter should drain stderr while retaining bounded diagnostic when child is noisy",async()=>{
  // Given
  const request=emptyRequest();
  // When
  const error=await providerError("noisy-nonzero",request);
  // Then
  assert.ok(error.message.length<=65536+100);
});
test("runtime should preserve semantic state and inspection when provider fails",async()=>{
  // Given
  const fixture=await startedStore(),before=cloneState(fixture.state.meanings);
  // When
  const result=await runCognition(fixture.store,fixture.state,{runtimeId:fixture.runtimeId,principal:PRINCIPAL,scope:SCOPE,text:"fail safely",command:process.execPath,arguments_:[PROVIDER,"--mode","nonzero"],timeoutSeconds:1,output:()=>{}}),serialized=await readFile(fixture.path,"utf8");await fixture.store.releaseWriteLease(fixture.lease);
  // Then
  assert.deepEqual([result.state.meanings,result.state.operations.cognition_episodes.at(-1).status,serialized.includes("provider diagnostic"),serialized.includes("fail safely")],[before,"failed",false,true]);
});
test("runtime should preserve pending delivery when output fails after expression commit",async()=>{
  // Given
  const fixture=await startedStore();
  // When
  const error=await captureError(()=>runCognition(fixture.store,fixture.state,{runtimeId:fixture.runtimeId,principal:PRINCIPAL,scope:SCOPE,text:"render",command:process.execPath,arguments_:[PROVIDER],timeoutSeconds:1,output:()=>{throw new Error("display failed");}})),persisted=(await fixture.store.load()).operations.cognition_episodes.at(-1);await fixture.store.releaseWriteLease(fixture.lease);
  // Then
  assert.deepEqual([error.message,persisted.status,persisted.delivery_status,Boolean(persisted.expression_evidence_id)],["display failed","completed","pending",true]);
});
test("runtime should preserve pending delivery when stdout fails asynchronously after accepting write",async()=>{
  // Given
  const fixture=await startedStore(),output=new Writable({write(_chunk,_encoding,callback){setImmediate(()=>callback(new Error("async display failed")));}});
  // When
  const error=await captureError(()=>runCognition(fixture.store,fixture.state,{runtimeId:fixture.runtimeId,principal:PRINCIPAL,scope:SCOPE,text:"render",command:process.execPath,arguments_:[PROVIDER],timeoutSeconds:1,output})),persisted=(await fixture.store.load()).operations.cognition_episodes.at(-1);await fixture.store.releaseWriteLease(fixture.lease);
  // Then
  assert.deepEqual([error.message,persisted.delivery_status],["async display failed","pending"]);
});
test("runtime should commit displayed only when stdout write callback completes",async()=>{
  // Given
  const fixture=await startedStore();let flushed=false,observed=false;const output=new Writable({write(_chunk,_encoding,callback){setTimeout(()=>{flushed=true;callback();},5);}});
  // When
  const result=await runCognition(fixture.store,fixture.state,{runtimeId:fixture.runtimeId,principal:PRINCIPAL,scope:SCOPE,text:"render",command:process.execPath,arguments_:[PROVIDER],timeoutSeconds:1,output,hooks:{afterDisplay:()=>{observed=flushed;}}});await fixture.store.releaseWriteLease(fixture.lease);
  // Then
  assert.deepEqual([observed,result.state.operations.cognition_episodes.at(-1).delivery_status],[true,"displayed"]);
});
test("runtime should keep delivery unknown when crash follows display before status commit",async()=>{
  // Given
  const fixture=await startedStore();let output="";
  // When
  const error=await captureError(()=>runCognition(fixture.store,fixture.state,{runtimeId:fixture.runtimeId,principal:PRINCIPAL,scope:SCOPE,text:"display",command:process.execPath,arguments_:[PROVIDER],timeoutSeconds:1,output:text=>{output+=text;},hooks:{afterDisplay:()=>{throw new Error("simulated crash");}}})),persisted=(await fixture.store.load()).operations.cognition_episodes.at(-1);await fixture.store.releaseWriteLease(fixture.lease);
  // Then
  assert.deepEqual([error.message,output.includes("CONTINUITY_RESPONSE"),persisted.delivery_status],["simulated crash",true,"pending"]);
});
test("state validator should reject orphan expression when second descriptor targets one cognition",async()=>{
  // Given
  const fixture=await startedStore(),result=await runCognition(fixture.store,fixture.state,{runtimeId:fixture.runtimeId,principal:PRINCIPAL,scope:SCOPE,text:"one",command:process.execPath,arguments_:[PROVIDER],timeoutSeconds:1,output:()=>{}}),duplicate=cloneState(result.state.evidence.find(e=>e.source_role==="ember_expression_via_provider"));duplicate.evidence_id+="-orphan";result.state.evidence.push(duplicate);await fixture.store.releaseWriteLease(fixture.lease);
  // When
  const error=await captureError(()=>validateState(result.state));
  // Then
  assert.match(error.message,/exactly one completed cognition/);
});
test("state validator should reject cognition when scope differs from owning runtime",async()=>{
  // Given
  const fixture=await startedStore(),result=await runCognition(fixture.store,fixture.state,{runtimeId:fixture.runtimeId,principal:PRINCIPAL,scope:SCOPE,text:"scope",command:process.execPath,arguments_:[PROVIDER],timeoutSeconds:1,output:()=>{}});result.state.operations.cognition_episodes.at(-1).active_scope="project:other";await fixture.store.releaseWriteLease(fixture.lease);
  // When
  const error=await captureError(()=>validateState(result.state));
  // Then
  assert.match(error.message,/scope differs from owning runtime/);
});
test("CLI run should reject timeout before runtime start when value is infinite",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await command(["init","--state",path,"--name","Ember","--principal",PRINCIPAL]);
  // When
  const attempted=await command(["run","--state",path,"--principal",PRINCIPAL,"--scope",SCOPE,"--provider-command",process.execPath,"--provider-timeout-seconds","Infinity"]),state=await readJson(path);
  // Then
  assert.deepEqual([attempted.code,state.operations.runtime_episodes],[2,[]]);
});
test("CLI run should reject malformed quote and stop cleanly when command parser fails",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await command(["init","--state",path,"--name","Ember","--principal",PRINCIPAL]);
  // When
  const attempted=await command(["run","--state",path,"--principal",PRINCIPAL,"--scope",SCOPE,"--provider-command",process.execPath,"--provider-timeout-seconds","1"],{stdin:":prefer 'unterminated\n"}),state=await readJson(path);
  // Then
  assert.deepEqual([attempted.code,attempted.stderr.includes("command rejected"),state.operations.runtime_episodes.at(-1).stop_reason],[0,true,"input_eof"]);
});
test("CLI correct should create attributable successor when current fact is corrected",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await command(["init","--state",path,"--name","Ember","--principal",PRINCIPAL]);await command(["run","--state",path,"--principal",PRINCIPAL,"--scope",SCOPE,"--provider-command",process.execPath,"--provider-arg",PROVIDER,"--provider-timeout-seconds","1"],{stdin:`:remember fact user:${PRINCIPAL} server ${SCOPE} "It is a Pi 4"\n:quit\n`});const before=JSON.parse((await command(["inspect","--state",path,"--principal",PRINCIPAL,"--json"])).stdout),original=before.current_meanings.find(m=>m.slot==="server").meaning_id;
  // When
  const corrected=await command(["correct","--state",path,"--principal",PRINCIPAL,original,"--text","It is a Pi 5","--reason","The user corrected the model"]),after=JSON.parse((await command(["inspect","--state",path,"--principal",PRINCIPAL,"--json"])).stdout),explained=await command(["explain","--state",path,"--principal",PRINCIPAL,corrected.stdout.trim()]);
  // Then
  assert.deepEqual([corrected.code,after.current_meanings.find(m=>m.slot==="server").content,after.historical_meanings.find(m=>m.meaning_id===original).currentness,explained.stdout.includes("The user corrected the model")],[0,"It is a Pi 5","superseded",true]);
});
test("CLI should refuse wrong principal before rendering when inspection is requested",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json"),secret="PRIVATE_FIXTURE_TEXT";await command(["init","--state",path,"--name","Ember","--principal",PRINCIPAL]);const established=await command(["run","--state",path,"--principal",PRINCIPAL,"--scope",SCOPE,"--provider-command",process.execPath,"--provider-arg",PROVIDER,"--provider-timeout-seconds","1"],{stdin:`:remember fact user:${PRINCIPAL} private ${SCOPE} ${secret}\n:quit\n`});
  // When
  const inspected=await command(["inspect","--state",path,"--principal","intruder","--json"]);
  // Then
  assert.deepEqual([established.code,inspected.code,(inspected.stdout+inspected.stderr).includes(secret)],[0,2,false]);
});
test("CLI check should fail closed when state is semantically incomplete",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(path,JSON.stringify({schema_version:1,revision:0}));
  // When
  const checked=await command(["check","--state",path]);
  // Then
  assert.deepEqual([checked.code,checked.stderr.includes("schema v1")],[2,true]);
});
test("CLI check should report typed failure when state is invalid UTF-8",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(path,Buffer.from([0xff,0xfe]));
  // When
  const checked=await command(["check","--state",path]);
  // Then
  assert.deepEqual([checked.code,checked.stderr.includes("not valid UTF-8"),checked.stderr.includes("stack")],[2,true,false]);
});
test("CLI check should report lock metadata and liveness when cooperating writer is live",async()=>{
  // Given
  const fixture=await startedStore();
  // When
  const checked=await command(["check","--state",fixture.path]);await fixture.store.releaseWriteLease(fixture.lease);
  // Then
  assert.deepEqual([checked.code,checked.stdout.includes('"status":"live"'),checked.stdout.includes('"owner_token"'),checked.stdout.includes('"liveness":"alive"')],[0,true,true,true]);
});
test("CLI parser should reject option when flag is unknown for command",async()=>{
  // Given
  const args=["check","--state","/tmp/ember.json","--typo","ignored"];
  // When
  const error=await captureError(()=>parseArgs(args));
  // Then
  assert.match(error.message,/unsupported option/);
});
test("CLI parser should reject arguments when surplus positional is present",async()=>{
  // Given
  const args=["init","surplus","--state","/tmp/ember.json","--name","Ember","--principal",PRINCIPAL];
  // When
  const error=await captureError(()=>parseArgs(args));
  // Then
  assert.match(error.message,/0 positional arguments/);
});
test("CLI parser should reject option when singular flag is duplicated",async()=>{
  // Given
  const args=["check","--state","/tmp/a.json","--state","/tmp/b.json"];
  // When
  const error=await captureError(()=>parseArgs(args));
  // Then
  assert.match(error.message,/must not be repeated/);
});
test("CLI init should report typed failure when state parent is not a directory",async()=>{
  // Given
  const path="/dev/null/ember.json";
  // When
  const attempted=await command(["init","--state",path,"--name","Ember","--principal",PRINCIPAL]);
  // Then
  assert.deepEqual([attempted.code,attempted.stderr.startsWith("ember: "),attempted.stderr.includes("\n    at ")],[2,true,false]);
});
