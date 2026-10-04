// Opt-in live Stage 9 checks. Only disposable accounts are seeded/reset/deleted.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createHealthRepository } from '../.contract-tests/db/repository.js';
import { seedDemoHistory } from '../.contract-tests/demo/seed.js';
import { scenarioDay } from '../.contract-tests/demo/scenario.js';
import { addCalendarDays } from '../.contract-tests/domain/primitives.js';
const base=process.env.QUESTION_CHECK_URL||'http://localhost:3000',url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url&&key&&secret);
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}),users=[],accounts=[];
function ok(result){assert.equal(result.error,null,result.error?.code||'Database error');return result.data;}
async function call(account,action){const response=await fetch(`${base}/api/questions`,{method:'POST',headers:{'Content-Type':'application/json',...(account?{Authorization:`Bearer ${account.token}`}:{})},body:JSON.stringify(action),signal:AbortSignal.timeout(120000)});return {status:response.status,body:await response.json()};}
async function read(account){const response=await fetch(`${base}/api/questions`,{headers:{Authorization:`Bearer ${account.token}`}});assert.equal(response.status,200);return response.json();}
async function pass(account,action){const result=await call(account,action);assert.equal(result.status,200,result.body.error);return result.body;}
try{
 assert.equal((await call(null,{action:'skip',revision:0})).status,401);
 for(let i=0;i<2;i++){
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),auth=ok(await client.auth.signInAnonymously());
  users.push(auth.user.id);accounts.push({client,token:auth.session.access_token,owner:auth.user.id});
  ok(await client.from('profiles').insert({user_id:auth.user.id,display_name:'Disposable Stage 9 check',time_zone:'Europe/Warsaw'}));
 }
 const a=accounts[0],b=accounts[1],end='2026-10-03';
 await seedDemoHistory(createHealthRepository(a.client),{endDate:end,timeZone:'Europe/Warsaw'});
 // Pick an intentionally omitted alcohol date, not a fixture latent value.
 let selected=end;while(!scenarioDay(addCalendarDays(selected,-1),2026).omitAlcohol)selected=addCalendarDays(selected,-1);
 const input={mode:'investigate',outcome:'hrv',date:selected,scope:'demo',language:'en'};
 let state=await pass(a,{action:'start',revision:0,input});
 assert.equal(state.loop.question.feature,'alcohol');assert.equal(state.loop.question.date,addCalendarDays(selected,-1));assert.equal(state.fresh,true);
 const restored=await read(a);assert.deepEqual(restored,state);assert.equal((await read(b)).loop,null);
 assert.deepEqual(ok(await b.client.from('evidence_question_loops').select('*').eq('user_id',a.owner)),[]);
 const denied=await a.client.rpc('commit_question_loop',{p_owner:a.owner,p_revision:state.revision,p_generation:state.loop.current.inputGeneration,p_zone:'Europe/Warsaw',p_state:state.loop});assert.ok(denied.error);
 assert.ok((await a.client.from('evidence_question_loops').update({payload:{forged:true}}).eq('user_id',a.owner)).error);
 assert.equal((await call(a,{action:'answer',revision:state.revision,answerId:randomUUID(),text:'no',feature:'mood'})).status,400);
 console.log('PASS deterministic demo question/date, durable restore, strict targets, owner isolation and browser-writer denial.');
 const before=state.loop.current,beforeCount=ok(await a.client.from('subjective_events').select('id',{count:'exact'})).length;
 const answer={action:'answer',revision:state.revision,answerId:randomUUID(),text:'No.'};
 state=await pass(a,answer);assert.ok(state.loop.processed?.some(p=>p.id===answer.answerId),"Completed answer ID must be durable");
 assert.equal(state.fresh,true);assert.notEqual(state.loop.current.inputGeneration,before.inputGeneration);
 const factor=state.loop.current.bundle.contextDays.find(d=>d.date===addCalendarDays(selected,-1)).features.alcohol;
 assert.equal(factor.status,'known');assert.equal(factor.value,false);assert.ok(factor.provenance.subjectiveEventIds.every(id=>id.startsWith('demo:question:')));
 const comparable=relationships=>relationships.map(({computedAt,...rest})=>rest);
 assert.deepEqual(comparable(before.bundle.relationships),comparable(state.loop.current.bundle.relationships));
 const replayed=await call(a,answer);assert.equal(replayed.status,200,replayed.body.error);assert.equal(replayed.body.revision,state.revision);
 const afterCount=ok(await a.client.from('subjective_events').select('id')).length;assert.equal(afterCount,beforeCount+1);
 // Simulate a process interruption after committed capture but before the refreshed receipt.
 const interrupted={...state.loop,needsRefresh:true,feedback:'Answer recorded. Evidence refresh is pending.'};
 ok(await admin.from('evidence_question_loops').update({payload:interrupted}).eq('user_id',a.owner));
 assert.equal((await read(a)).fresh,false);
 assert.equal((await call(a,{action:'answer',revision:state.revision,answerId:randomUUID(),text:'no'})).status,409);
 state=await pass(a,{action:'refresh',revision:state.revision});assert.equal(state.fresh,true);
 assert.equal(ok(await a.client.from('subjective_events').select('id')).length,afterCount);
 console.log('PASS interrupted post-capture refresh recovery without recapture or duplicated events.');
 const event=ok(await a.client.from('subjective_events').select('*').like('id','demo:question:%'))[0];
 const turn=ok(await a.client.from('conversation_turns').select('*').eq('id',event.conversation_turn_id))[0];assert.equal(turn.role,'user');assert.equal(turn.transcript,'No.');
 const personalResponse=await fetch(`${base}/api/investigate`,{method:'POST',headers:{Authorization:`Bearer ${a.token}`,'Content-Type':'application/json'},body:JSON.stringify({...input,scope:'personal'})});assert.equal(personalResponse.status,200);
 const personal=await personalResponse.json();assert.equal(personal.bundle.contextDays[0].features.alcohol.status,'unknown');
 console.log('PASS canonical dated false with raw turn provenance, fresh recomputation, unchanged historical effects, no replay duplicates and personal/demo isolation.');
 const sparseInput={...input,date:end,scope:'personal'};
 state=await pass(b,{action:'start',revision:0,input:sparseInput});
 // Recover a failed provider request from the durable pending answer, using its original ID/text.
 const failureId=randomUUID(),failureAt=new Date().toISOString();
 const pending={id:failureId,text:"I don't know.",turnId:`question-answer:${state.loop.id}:${failureId}`,at:failureAt,leaseUntil:'1970-01-01T00:00:00.000Z'};
 ok(await admin.from('evidence_question_loops').update({payload:{...state.loop,pending,feedback:'Extraction failed. No new observation was confirmed.'}}).eq('user_id',b.owner));
 assert.equal((await call(b,{action:'answer',revision:state.revision,answerId:randomUUID(),text:'yes'})).status,409);
 state=await pass(b,{action:'answer',revision:state.revision,answerId:failureId,text:pending.text});
 assert.equal(state.loop.pending,null);assert.equal(ok(await b.client.from('subjective_events').select('id')).length,0);
 console.log('PASS restored failed-answer retry keeps its ID/text and uncertainty remains unknown.');
 const revisionBefore=state.revision,firstKey=state.loop.question.key;
 const unknownCount=ok(await b.client.from('subjective_events').select('id')).length;
 state=await pass(b,{action:'answer',revision:state.revision,answerId:randomUUID(),text:"I don't know."});
 assert.equal(state.loop.question.key,firstKey);assert.equal(ok(await b.client.from('subjective_events').select('id')).length,unknownCount);
 assert.ok(state.revision>revisionBefore);
 state=await pass(b,{action:'skip',revision:state.revision});assert.ok(state.loop.skipped.includes(firstKey));assert.notEqual(state.loop.question?.key,firstKey);
 assert.equal((await read(b)).loop.question?.key,state.loop.question?.key);
 while(state.loop.question)state=await pass(b,{action:'skip',revision:state.revision});
 assert.equal(state.loop.question,null);assert.equal(ok(await b.client.from('subjective_events').select('id')).length,0);
 state=await pass(b,{action:'start',revision:state.revision,input:sparseInput});assert.equal(state.loop.question,null);
 const energyInput={...sparseInput,outcome:'energy'};state=await pass(b,{action:'start',revision:state.revision,input:energyInput});
 const simultaneous=await Promise.all([call(b,{action:'stop',revision:state.revision}),call(b,{action:'stop',revision:state.revision})]);assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);state=await read(b);assert.equal(state.loop.stopped,true);assert.equal(state.loop.question,null);
 console.log('PASS uncertainty remains unknown, skips survive reconnect/restart, exhaustion terminates and stop is persisted.');
 // Voice investigation creates a question; an answer retains the original spoken-turn provenance.
 const now=new Date().toISOString(),conversation='stage9-live-voice';
 ok(await b.client.from('conversations').insert({user_id:b.owner,id:conversation,mode:'capture',started_at:now,ended_at:null}));
 async function voice(id,transcript,context={mode:"report"}){
  ok(await b.client.from('conversation_turns').insert({user_id:b.owner,id,conversation_id:conversation,role:'user',transcript,occurred_at:new Date().toISOString()}));
  const response=await fetch(`${base}/api/voice/turn`,{method:'POST',headers:{Authorization:`Bearer ${b.token}`,'Content-Type':'application/json'},body:JSON.stringify({turnId:id,targetRootId:null,context}),signal:AbortSignal.timeout(120000)});const body=await response.json();assert.equal(response.status,200,body.error);return body.outcome;
 }
 const request=await voice('stage9-voice-request','Investigate my HRV today.');assert.equal(request.questions.loop.question.feature,'alcohol');
 const answerVoice=await voice('stage9-voice-answer','No.',{mode:'investigate',loopId:request.questions.loop.id,key:request.questions.loop.question.key});assert.equal(answerVoice.questions.fresh,true);
 const voiceEvent=ok(await b.client.from('subjective_events').select('*').eq('conversation_turn_id','stage9-voice-answer'))[0];assert.equal(voiceEvent.payload.value.consumed,false);
 assert.ok(answerVoice.reply.includes('Next question')||answerVoice.reply.includes('No further'));
 // Simulate loss of the voice receipt after the canonical answer transaction, then change the active investigation.
 const eventCount=ok(await b.client.from('subjective_events').select('id')).length,voiceLoop=await read(b);
 const switched=await pass(b,{action:'start',revision:voiceLoop.revision,input:{...sparseInput,outcome:'energy',date:'2026-10-02'}});
 ok(await admin.from('voice_turn_runs').update({result:null,lease_token:null,lease_until:null}).eq('user_id',b.owner).eq('turn_id','stage9-voice-answer'));
 const recoveryResponse=await fetch(`${base}/api/voice/turn`,{method:'POST',headers:{Authorization:`Bearer ${b.token}`,'Content-Type':'application/json'},body:JSON.stringify({turnId:'stage9-voice-answer',targetRootId:null})});
 const recovered=await recoveryResponse.json();assert.equal(recoveryResponse.status,200,recovered.error);
 assert.equal(ok(await b.client.from('subjective_events').select('id')).length,eventCount);
 assert.equal((await read(b)).loop.question?.key,switched.loop.question?.key);
 console.log('PASS lost voice-receipt recovery cannot reapply an old answer to a different investigation.');
 const aLoop=await read(a);ok(await a.client.from('profiles').update({time_zone:'UTC'}).eq('user_id',a.owner));assert.equal((await read(a)).fresh,false);
 assert.equal((await call(a,{action:'answer',revision:aLoop.revision,answerId:randomUUID(),text:'no'})).status,409);
 const stoppedStale=await pass(a,{action:'stop',revision:aLoop.revision});assert.equal(stoppedStale.loop.stopped,true);assert.equal(stoppedStale.loop.pending,null);assert.equal(stoppedStale.fresh,false);
 console.log('PASS live intent/question/answer voice dispatch with original turn provenance, zone invalidation and state-only stop of stale questions.');
 // Explicit dates override selected question context; ambiguous ratings never become guessed numbers.
 let dated=await pass(a,{action:'start',revision:(await read(a)).revision,input:{...sparseInput,outcome:'energy'}});
 assert.equal(dated.loop.question.feature,'workout_rpe');assert.equal(dated.loop.question.date,'2026-10-02');
 dated=await pass(a,{action:'answer',revision:dated.revision,answerId:randomUUID(),text:'My workout effort was six out of ten on 2026-10-01.'});
 assert.equal(dated.loop.question.feature,'workout_rpe');assert.equal(dated.loop.question.date,'2026-10-02');
 const voluntary=ok(await a.client.from('subjective_events').select('*').like('id','capture:v1:%').eq('event_type','workout_rpe'));assert.equal(voluntary.length,1);assert.equal(voluntary[0].payload.value,6);assert.ok(voluntary[0].observed_at.startsWith('2026-10-01'));
 const rawBefore=ok(await a.client.from('subjective_events').select('id')).length;
 dated=await pass(a,{action:'answer',revision:dated.revision,answerId:randomUUID(),text:'My workout effort was really hard on 2026-10-02.'});
 assert.equal(ok(await a.client.from('subjective_events').select('id')).length,rawBefore);assert.equal(dated.loop.question.feature,'workout_rpe');
 const numeric={action:'answer',revision:dated.revision,answerId:randomUUID(),text:'Six out of ten.'};
 const duplicate=await Promise.all([call(a,numeric),call(a,numeric)]);assert.ok(duplicate.some(r=>r.status===200));assert.ok(duplicate.every(r=>[200,409].includes(r.status)));
 const datedCurrent=await read(a);assert.equal(datedCurrent.loop.current.bundle.contextDays[0].features.workout_rpe.value,6);assert.equal(ok(await a.client.from('subjective_events').select('id')).length,rawBefore+1);
 console.log('PASS explicit-date precedence, ambiguous-rating all-or-clarify, anchored short rating and concurrent answer/stop revision protection.');

 // Private reset on a disposable account must cascade question state.
 ok(await admin.rpc('reset_owned_history',{p_owner:b.owner}));assert.equal((await read(b)).loop,null);
 console.log('PASS clean-slate reset removes durable question state.');
}finally{
 const failures=[];for(const owner of users){const result=await admin.auth.admin.deleteUser(owner);if(result.error)failures.push(result.error.code||'cleanup');}
 if(failures.length)throw new Error(`Disposable cleanup failed: ${failures.join(',')}`);
 console.log(`Cleaned ${users.length} disposable accounts; existing user records were preserved.`);
}
