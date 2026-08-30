import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ConcurrentWriter, DurabilityUncertain, StaleRevision, StoreExists, StoreUnavailable, ValidationError } from "../src/ember/errors.ts";
import { cloneState, initialState, newId, validateState } from "../src/ember/model.ts";
import { startRuntime } from "../src/ember/runtime.ts";
import { userEvidence } from "../src/ember/semantics.ts";
import { StateStore } from "../src/ember/store.ts";
import { captureError, populatedState, PRINCIPAL, SCOPE, tempDir } from "./support.ts";

test("state validator should accept state when schema and invariants are complete",()=>{
  const {state}=populatedState(); validateState(state); assert.equal(state.schema_version,1);
});
test("state validator should reject state when two current meanings share exact slot",async()=>{
  const {state,ids}=populatedState(),duplicate=cloneState(state.meanings.find(m=>m.meaning_id===ids.preference));duplicate.meaning_id+="-duplicate";state.meanings.push(duplicate);
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/duplicate current meaning/);
});
test("state validator should reject state when evidence reference is absent",async()=>{
  const {state,ids}=populatedState();state.meanings.find(m=>m.meaning_id===ids.fact).source_evidence_ids=["evidence-absent"];
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/cites absent evidence/);
});
test("state validator should reject state when unavailable evidence leaks payload",async()=>{
  const {state,ids}=populatedState(),e=state.evidence.find(e=>e.evidence_id===ids.detail);e.availability="unavailable";e.unavailable_reason="fixture detail payload unavailable";
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/leaks unavailable payload/);
});
test("state validator should reject state when governing fact evidence becomes unavailable",async()=>{
  const {state,ids}=populatedState(),m=state.meanings.find(m=>m.meaning_id===ids.fact),e=state.evidence.find(e=>e.evidence_id===m.source_evidence_ids[0]);e.availability="unavailable";e.unavailable_reason="source unavailable";delete e.payload;delete e.content_digest;
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/governing evidence cannot degrade locally/);
});
test("state validator should reject state when unattached evidence claims unavailability",async()=>{
  const {state}=populatedState(),e=state.evidence.find(e=>e.source_role==="user_command");e.availability="unavailable";e.unavailable_reason="source unavailable";delete e.payload;delete e.content_digest;
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/must relate to episode_meta/);
});
test("state validator should reject state when supersession crosses scope",async()=>{
  const {state,ids}=populatedState(),old=state.meanings.find(m=>m.meaning_id===ids.preference),later=cloneState(old);later.meaning_id+="-later";later.scope="project:other";later.supersedes=old.meaning_id;old.currentness="superseded";old.superseded_by=later.meaning_id;state.meanings.push(later);
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/crosses kind, owner, slot, or scope/);
});
test("state validator should reject state when principal binding is changed",async()=>{
  const {state}=populatedState();state.runtime_contract.local_principal="intruder";
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/principal/);
});
test("state validator should reject state when constitutive boundary becomes meaning",async()=>{
  const {state,ids}=populatedState();state.meanings.find(m=>m.meaning_id===ids.fact).kind="constitutive";
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/kind is unsupported/);
});
test("state validator should reject state when boolean impersonates integer version",async()=>{
  const {state}=populatedState();state.schema_version=true;state.revision=true;
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/unsupported schema_version/);
});
test("state validator should reject state when unsafe integer impersonates revision",async()=>{
  const {state}=populatedState();state.revision=Number.MAX_SAFE_INTEGER+1;
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/safe integer/);
});
test("state validator should reject state when adoption retains payload",async()=>{
  const {state}=populatedState(),e=state.evidence.find(e=>e.source_role==="ember_adoption");Object.assign(e,{payload_mode:"retained_optional",availability:"available",payload:"duplicated",content_digest:"sha256:wrong"});
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/adoption must be descriptor-only/);
});
test("state validator should reject state when current meaning has past applicability end",async()=>{
  const {state,ids}=populatedState();state.meanings.find(m=>m.meaning_id===ids.fact).applicable_until="2026-08-28T10:00:00Z";
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/applicability interval cannot be rewritten/);
});
test("state validator should reject timestamp when calendar date does not exist",async()=>{
  const {state}=populatedState();state.lineage.established_at="2026-02-31T10:00:00Z";
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/RFC 3339 UTC/);
});
test("state validator should reject state when commitment claims discharge without occurrence",async()=>{
  const {state,ids}=populatedState(),m=state.meanings.find(m=>m.meaning_id===ids.commitment);m.currentness="historical";m.prospective_lifecycle="fulfilled";
  const error=await captureError(()=>validateState(state)); assert.match(error.message,/discharge is unsupported/);
});
test("state validator should return typed failure when nested JSON shapes are malformed",async()=>{
  const {state,ids}=populatedState(),variants=[];for(const value of [null,[["nested"]]]){const c=cloneState(state);c.meanings.find(m=>m.meaning_id===ids.fact).source_evidence_ids=value;variants.push(c);}const derived=cloneState(state);derived.evidence[0].derived_from_evidence_ids=null;variants.push(derived);for(const value of ["not-an-object",7,[],{}]){const c=cloneState(state);if(value==="not-an-object")c.operations.runtime_episodes=[value];else if(value===7)c.operations.cognition_episodes=[value];else if(Array.isArray(value))c.meanings[0].currentness=value;else c.evidence[0].payload_mode=value;variants.push(c);}
  const errors=await Promise.all(variants.map(v=>captureError(()=>validateState(v)))); assert.ok(errors.every(error=>error instanceof ValidationError));
});
test("state store should round trip complete document when commit succeeds",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json"),store=new StateStore(path),state=initialState("Ember",PRINCIPAL,"2026-08-29T10:00:00Z");await store.create(state);const lease=await store.acquireWriteLease();
  const committed=await store.commit(0,cloneState(state));await store.releaseWriteLease(lease);const loaded=await store.load(); assert.deepEqual([loaded.revision,loaded],[1,committed]);
});
test("state store should reject stale candidate when revision changed",async()=>{
  const directory=await tempDir(),store=new StateStore(join(directory,"ember.json")),state=initialState("Ember",PRINCIPAL,"2026-08-29T10:00:00Z");await store.create(state);const lease=await store.acquireWriteLease();await store.commit(0,cloneState(state));
  const error=await captureError(()=>store.commit(0,cloneState(state)));await store.releaseWriteLease(lease); assert.ok(error instanceof StaleRevision);
});
test("state store should refuse overwrite when lineage already exists",async()=>{
  const directory=await tempDir(),store=new StateStore(join(directory,"ember.json")),state=initialState("Ember",PRINCIPAL,"2026-08-29T10:00:00Z");await store.create(state);
  const error=await captureError(()=>store.create(state)); assert.ok(error instanceof StoreExists);
});
test("state store should ignore orphan temporary file when canonical document is complete",async()=>{
  const directory=await tempDir(),store=new StateStore(join(directory,"ember.json")),state=initialState("Ember",PRINCIPAL,"2026-08-29T10:00:00Z");await store.create(state);await writeFile(join(directory,".ember.json.interrupted.tmp"),"{");
  const loaded=await store.load(); assert.deepEqual(loaded,state);
});
test("state store should report uncertain durability when directory sync fails after replace",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json"),state=initialState("Ember",PRINCIPAL,"2026-08-29T10:00:00Z"),store=new StateStore(path);await store.create(state);store.directorySync=async()=>{throw new Error("sync");};const lease=await store.acquireWriteLease();
  const error=await captureError(()=>store.commit(0,cloneState(state)));const exposed=await store.load();await store.releaseWriteLease(lease); assert.deepEqual([error.constructor,exposed.revision],[DurabilityUncertain,1]);
});
test("state store should fail closed when canonical JSON is partial",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(path,'{"schema_version":1');
  const error=await captureError(()=>new StateStore(path).load()); assert.ok(error instanceof StoreUnavailable);
});
test("state store should report unavailable when canonical file is invalid UTF-8",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(path,Buffer.from([0xff,0xfe]));
  const error=await captureError(()=>new StateStore(path).load()); assert.match(error.message,/not valid UTF-8/);
});
test("write lease should refuse second writer when live PID owns lock",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json"),first=new StateStore(path),second=new StateStore(path);const lease=await first.acquireWriteLease();
  const error=await captureError(()=>second.acquireWriteLease());await first.releaseWriteLease(lease); assert.equal(error.diagnosis.status,"live");
});
test("write lease should fail closed without probing when lock PID is unsafe",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json"),calls=[];await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"t",pid:0,hostname:"h",acquired_at:"2026-08-29T10:00:00Z"}));const store=new StateStore(path,{hostname:"h",kill:(...args)=>calls.push(args)});
  const status=await store.lockStatus(); assert.deepEqual([status.status,calls.length],["malformed",0]);
});
test("write lease should classify metadata malformed when acquired timestamp is calendar-invalid",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"t",pid:123,hostname:"h",acquired_at:"2026-02-31T10:00:00Z"}));const store=new StateStore(path,{hostname:"h"});
  const status=await store.lockStatus(); assert.equal(status.status,"malformed");
});
test("write lease should diagnose absent PID when same-host process no longer exists",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"t",pid:123,hostname:"h",acquired_at:"2026-08-29T10:00:00Z"}));const store=new StateStore(path,{hostname:"h",kill:()=>{const e=new Error();e.code="ESRCH";throw e;}});
  const status=await store.lockStatus(); assert.equal(status.status,"apparently_stale");
});
test("write lease should keep lock indeterminate when PID probe lacks permission",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"t",pid:123,hostname:"h",acquired_at:"2026-08-29T10:00:00Z"}));const store=new StateStore(path,{hostname:"h",kill:()=>{const e=new Error();e.code="EPERM";throw e;}});
  const status=await store.lockStatus(); assert.equal(status.status,"permission_denied");
});
test("write lease should keep foreign-host lock indeterminate when hostname differs",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"t",pid:123,hostname:"elsewhere",acquired_at:"2026-08-29T10:00:00Z"}));const store=new StateStore(path,{hostname:"here",kill:()=>{throw new Error("must not probe");}});
  const status=await store.lockStatus(); assert.equal(status.status,"foreign_host");
});
test("write lease should preserve lock when owner token changes before release",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json"),store=new StateStore(path),lease=await store.acquireWriteLease();await writeFile(`${path}.lock`,JSON.stringify({...lease.metadata,owner_token:"different"}));
  const error=await captureError(()=>store.releaseWriteLease(lease)); assert.ok(error instanceof ConcurrentWriter);
});
test("stale lock quarantine should rename artifact when token and quiescence are confirmed",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json"),metadata={lock_version:1,owner_token:"expected",pid:123,hostname:"h",acquired_at:"2026-08-29T10:00:00Z"};await writeFile(`${path}.lock`,JSON.stringify(metadata));const store=new StateStore(path,{hostname:"h",kill:()=>{const e=new Error();e.code="ESRCH";throw e;}});
  const quarantined=await store.quarantineStaleLock({ownerToken:"expected",confirmQuiescent:true}); await assert.doesNotReject(()=>access(quarantined));
});
test("stale lock quarantine should refuse mutation when quiescence is not confirmed",async()=>{
  const directory=await tempDir(),store=new StateStore(join(directory,"ember.json"));
  const error=await captureError(()=>store.quarantineStaleLock({ownerToken:"expected",confirmQuiescent:false})); assert.ok(error instanceof ConcurrentWriter);
});
test("stale lock quarantine should preserve availability failure when PID is reused",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"expected",pid:123,hostname:"h",acquired_at:"2026-08-29T10:00:00Z"}));const store=new StateStore(path,{hostname:"h",kill:()=>{}});
  const error=await captureError(()=>store.quarantineStaleLock({ownerToken:"expected",confirmQuiescent:true})); assert.equal(error.diagnosis.status,"live");
});
test("write lease should fail closed when lock metadata is malformed",async()=>{
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,"{");const store=new StateStore(path);
  const error=await captureError(()=>store.acquireWriteLease()); assert.equal(error.diagnosis.status,"malformed");
});
