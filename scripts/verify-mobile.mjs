// Opt-in real API/provider checks. Never reads or writes an existing user's history.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getLocalDate, addCalendarDays } from '../.contract-tests/domain/primitives.js';
const base=process.env.MOBILE_CHECK_URL||'http://localhost:3000';
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
let owner,token;
const ok=r=>{assert.equal(r.error,null,r.error?.code);return r.data;};
async function call(path,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','x-checkin-dev-window':'00:00-23:59'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});return {status:response.status,body:await response.json()};}
async function pass(path,body){const r=await call(path,body);assert.equal(r.status,200,r.body.error);return r.body;}
async function voice(text,context={mode:'report'},id=randomUUID()){
 ok(await client.from('conversation_turns').insert({user_id:owner,id,conversation_id:'mobile-check',role:'user',transcript:text,occurred_at:new Date().toISOString()}));
 return {id,outcome:(await pass('/api/voice/turn',{turnId:id,context})).outcome};
}
try{
 const auth=ok(await client.auth.signInAnonymously());owner=auth.user.id;token=auth.session.access_token;
 ok(await client.from('profiles').insert({user_id:owner,display_name:'Disposable mobile check',time_zone:'Europe/Warsaw'}));
 ok(await client.from('conversations').insert({user_id:owner,id:'mobile-check',mode:'capture',started_at:new Date().toISOString(),ended_at:null}));
 const today=getLocalDate(new Date().toISOString(),'Europe/Warsaw');
 const started=await voice('Start morning check-in.');assert.match(started.outcome.reply,/energy/);assert.equal(started.outcome.checkin.step.dimension,'energy');
 const context={mode:'morning_checkin',date:today,dimension:'energy'};
 const rating=await voice('Six out of ten.',context);assert.equal(rating.outcome.capture.result.status,'captured');assert.equal(rating.outcome.capture.acceptedResult.events[0].type,'energy');assert.equal(rating.outcome.capture.acceptedResult.events[0].value,6);assert.equal(rating.outcome.checkin.step.dimension,'soreness');
 const replay=(await pass('/api/voice/turn',{turnId:rating.id,context})).outcome;assert.deepEqual(replay.capture,rating.outcome.capture);
 const count=ok(await client.from('subjective_events').select('id')).length;
 const staleId=randomUUID();ok(await client.from('conversation_turns').insert({user_id:owner,id:staleId,conversation_id:'mobile-check',role:'user',transcript:'Seven.',occurred_at:new Date().toISOString()}));assert.equal((await call('/api/voice/turn',{turnId:staleId,context})).status,409);
 const unknown=await voice("I don't know.",{mode:'morning_checkin',date:today,dimension:'soreness'});assert.equal(unknown.outcome.checkin.step.dimension,'mood');assert.equal(ok(await client.from('subjective_events').select('id')).length,count);
 const skipped=await voice('Skip.',{mode:'morning_checkin',date:today,dimension:'mood'});assert.equal(skipped.outcome.checkin.step.dimension,'illness');
 const negative=await voice('No.',{mode:'morning_checkin',date:today,dimension:'illness'});assert.equal(negative.outcome.capture.acceptedResult.events[0].value,false);assert.equal(negative.outcome.checkin.step.kind,'complete');
 console.log('PASS spoken check-in command, bare rating, uncertainty/skip, explicit negative, replay and stale-question rejection.');
 const metricsBefore=ok(await client.from('metric_samples').select('id'));
 let state=await pass('/api/questions',{action:'start',revision:0,input:{mode:'investigate',outcome:'hrv',date:today,scope:'demo',language:'en'}});
 const initialKey=state.loop.question.key;
 const ordinary=await voice('My stress today is four out of ten.');assert.equal(ordinary.outcome.capture.acceptedResult.events[0].type,'stress');assert.ok(!ordinary.outcome.capture.acceptedResult.events[0].id.startsWith('demo:'));assert.equal((await pass('/api/questions')).loop.question.key,initialKey);
 assert.equal(ok(await client.from('subjective_events').select('id').like('id','demo:%')).length,0);
 state=await pass('/api/questions',{action:'refresh',revision:state.revision});
 const q=state.loop.question;const answer=await voice('No.',{mode:'investigate',loopId:state.loop.id,key:q.key});assert.equal(answer.outcome.questions.fresh,true);assert.ok(ok(await client.from('subjective_events').select('id').eq('conversation_turn_id',answer.id))[0].id.startsWith('demo:'));
 assert.deepEqual(ok(await client.from('metric_samples').select('id')),metricsBefore);
 console.log('PASS ordinary personal reports cannot be hijacked by a demo question; explicitly selected demo answers stay synthetic; voice does not write metrics.');
 const investigation=await voice('Investigate my HRV today.');assert.ok(investigation.outcome.reply.length<1000);assert.match(investigation.outcome.reply,/do not establish a cause/);assert.ok(investigation.outcome.reply.endsWith(investigation.outcome.questions.loop.question.text));
 const analytics=await pass('/api/analytics',{date:today,scope:'personal'});assert.equal(analytics.report.currentDay.features.energy.value,6);assert.equal(analytics.report.currentDay.features.illness.value,false);assert.equal(analytics.report.currentDay.features.soreness.status,'unknown');assert.equal(analytics.report.currentDay.features.mood.status,'unknown');
 const features=await pass(`/api/features?from=${addCalendarDays(today,-6)}&to=${today}&scope=personal`);assert.equal(features.rows.length,7);
 console.log('PASS concise grounded investigation and real Today/Insights daily values; unknown answers remain gaps.');
}finally{
 if(owner){const removed=await admin.auth.admin.deleteUser(owner);assert.equal(removed.error,null,removed.error?.code);}
 console.log('Cleaned disposable account; existing user history preserved.');
}
