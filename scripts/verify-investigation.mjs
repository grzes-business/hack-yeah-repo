// Explicit opt-in automatic Stage 8 check. Creates/cleans two disposable accounts.
// Never operates on an existing user's records or prints tokens/transcripts.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createHealthRepository } from '../.contract-tests/db/repository.js';
import { seedDemoHistory } from '../.contract-tests/demo/seed.js';
const base=process.env.INVESTIGATION_CHECK_URL||'http://localhost:3000';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url&&key&&secret,'Hosted automatic check requires Supabase configuration');
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}),clients=[],users=[];
function ok(result){assert.equal(result.error,null,result.error?.code||'Database operation failed');return result.data;}
async function call(path,token,input){
 const response=await fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(input),signal:AbortSignal.timeout(120000)});
 assert.ok(response.headers.get('content-type')?.includes('application/json'),`Expected JSON from ${path}, received HTTP ${response.status}; restart the local server if routes changed.`);
 return {status:response.status,body:await response.json()};
}
async function get(path,token){const response=await fetch(`${base}${path}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});return {status:response.status,body:await response.json()};}
try{
 assert.equal((await call('/api/investigate',null,{outcome:'hrv',date:'2026-10-03'})).status,401);
 for(let i=0;i<2;i++){
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),auth=ok(await client.auth.signInAnonymously());
  assert.ok(auth.user&&auth.session);clients.push({client,token:auth.session.access_token});users.push(auth.user.id);
  ok(await client.from('profiles').insert({user_id:auth.user.id,display_name:'Disposable investigation check',time_zone:'Europe/Warsaw'}));
 }
 const selected='2026-10-03',input={mode:'investigate',outcome:'hrv',date:selected,scope:'demo',language:'en'};
 assert.equal((await call('/api/investigate',null,input)).status,401);
 for(const bad of [{outcome:'weight'},{userId:users[1]},{mode:'doctor_prep'},{date:'2099-01-01'},{bundle:{userId:users[1]}}])assert.equal((await call('/api/investigate',clients[0].token,{...input,...bad})).status,400);
 console.log('PASS request auth, allow-list, strict ownership/mode/payload and future-date rejection.');
 await seedDemoHistory(createHealthRepository(clients[0].client),{endDate:selected,timeZone:'Europe/Warsaw'});
 const first=await call('/api/investigate',clients[0].token,input);assert.equal(first.status,200);assert.equal(first.body.bundle.dailyFeatures.userId,users[0]);
 assert.equal(first.body.bundle.outcome,'hrv');assert.equal(first.body.bundle.relationships.length,1);
 assert.equal(first.body.bundle.contextDays[0].date,'2026-10-02');assert.equal(first.body.scope,'demo');
 assert.ok(first.body.explanation.facts.some(fact=>fact.id==='synthetic'));assert.equal(first.body.explanation.summary,first.body.explanation.facts.map(f=>f.text).join(' '));
 assert.ok(first.body.bundle.relationships[0].sampleSize>=10);assert.equal(first.body.bundle.relationships[0].effect.kind,'exposure');assert.ok(first.body.bundle.relationships[0].effect.medianDifference<0);
 const providerMode=first.body.explanation.source;
 const b=await call('/api/investigate',clients[1].token,input);assert.equal(b.status,200);assert.equal(b.body.bundle.dailyFeatures.userId,users[1]);
 assert.equal(b.body.bundle.dailyFeatures.features.hrv.status,'unknown');assert.equal(b.body.bundle.relationships[0].effect,null);assert.equal(b.body.bundle.currentAnomalies.length,0);
 assert.deepEqual(ok(await clients[1].client.from('relationship_results').select('*').eq('user_id',users[0])),[]);
 const denied=await clients[0].client.rpc('commit_relationship_results',{p_owner:users[0],p_generation:first.body.inputGeneration,p_zone:'Europe/Warsaw',p_builder:'daily-v1:demo',p_rows:first.body.bundle.relationships});assert.ok(denied.error,'Browser analytical writer must be denied');
 console.log(`PASS seeded live investigation, exact lag, independent owner/unknown history, guarded explanation (${providerMode}) and browser-writer denial.`);
 const before=await get(`/api/analytics?date=${selected}&scope=demo`,clients[0].token);assert.equal(before.status,200);assert.equal(before.body.needsAnalysis,false);
 const fixture=ok(await clients[0].client.from('subjective_events').select('id,payload').eq('user_id',users[0]).eq('event_type','stress').order('observed_at',{ascending:false}).limit(1))[0];
 const changed={...fixture.payload,value:fixture.payload.value===2?3:2};ok(await clients[0].client.from('subjective_events').update({payload:changed}).eq('user_id',users[0]).eq('id',fixture.id));
 const stale=await get(`/api/analytics?date=${selected}&scope=demo`,clients[0].token);assert.equal(stale.status,200);assert.equal(stale.body.needsAnalysis,true);
 const rebuilt=await call('/api/investigate',clients[0].token,input);assert.equal(rebuilt.status,200);assert.notEqual(rebuilt.body.inputGeneration,first.body.inputGeneration);
 console.log('PASS raw mutation invalidates analytical history and investigation recomputes a new generation.');
 const now=new Date().toISOString(),conversation='automatic-investigation',turn='automatic-investigation-turn';
 ok(await clients[0].client.from('conversations').insert({user_id:users[0],id:conversation,mode:'capture',started_at:now,ended_at:null}));
 ok(await clients[0].client.from('conversation_turns').insert({user_id:users[0],id:turn,conversation_id:conversation,role:'user',transcript:'Investigate my energy today.',occurred_at:now}));
 const voice=await call('/api/voice/turn',clients[0].token,{turnId:turn,targetRootId:null});assert.equal(voice.status,200);assert.equal(voice.body.outcome.disposition,'conversation');assert.equal(voice.body.outcome.investigation.bundle.outcome,'energy');
 const replay=await call('/api/voice/turn',clients[0].token,{turnId:turn,targetRootId:null});assert.equal(replay.status,200);assert.equal(replay.body.outcome.disposition,'conversation');
 const demoTurn='automatic-demo-investigation-turn';
 ok(await clients[0].client.from('conversation_turns').insert({user_id:users[0],id:demoTurn,conversation_id:conversation,role:'user',transcript:'Investigate the synthetic demo HRV for October third, 2026.',occurred_at:now}));
 const demoVoice=await call('/api/voice/turn',clients[0].token,{turnId:demoTurn,targetRootId:null});assert.equal(demoVoice.status,200);assert.equal(demoVoice.body.outcome.investigation.bundle.outcome,'hrv');assert.equal(demoVoice.body.outcome.investigation.scope,'demo');const demoPlan=ok(await clients[0].client.from('voice_turn_runs').select('plan').eq('turn_id',demoTurn))[0]?.plan;assert.equal(demoVoice.body.outcome.investigation.bundle.dailyFeatures.date,selected,JSON.stringify({kind:demoPlan?.kind,query:demoPlan?.query,outcome:demoPlan?.investigationOutcome}));
 ok(await clients[0].client.from('profiles').update({time_zone:'UTC'}).eq('user_id',users[0]));
 const staleVoice=await call('/api/voice/turn',clients[0].token,{turnId:turn,targetRootId:null});assert.equal(staleVoice.status,200);assert.equal(staleVoice.body.outcome.investigation,undefined);assert.match(staleVoice.body.outcome.reply,/no longer current/);
 console.log('PASS live typed voice-intent dispatch, durable replay and stale investigation receipt refusal.');
}finally{
 const failures=[];
 for(const owner of users){const result=await admin.auth.admin.deleteUser(owner);if(result.error)failures.push(result.error.code||'cleanup failed');}
 if(failures.length)throw new Error(`Disposable account cleanup failed: ${failures.join(',')}`);
 console.log(`Cleaned ${users.length} disposable accounts and their records; existing user history was preserved.`);
}
