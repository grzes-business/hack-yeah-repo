// Opt-in: hosted Supabase + running app + paid extraction calls. Synthetic data only.
// Own records are removed in finally; disposable anonymous Auth accounts remain.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const origin=process.env.VOICE_VERIFY_ORIGIN||'http://localhost:3000';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url&&key,'Configure Supabase first');
const clients=[0,1].map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));
const identities=[],conversation='voice-acceptance-'+randomUUID();
const now=new Date().toISOString();
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
const ok=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
async function call(index,input){
 const r=await fetch(origin+'/api/voice/turn',{method:'POST',headers:{Authorization:'Bearer '+identities[index].token,'Content-Type':'application/json'},body:JSON.stringify(input)});
 const b=await r.json();assert.equal(r.status,200,b.error||'Unexpected status');return b.outcome;
}
async function turn(text,targetRootId=null){
 const id='voice-acceptance-turn-'+randomUUID();
 ok(await clients[0].from('conversation_turns').insert({user_id:identities[0].id,id,conversation_id:conversation,role:'user',transcript:text,occurred_at:now}));
 return {turnId:id,targetRootId};
}
try{
 for(const c of clients){const signed=ok(await c.auth.signInAnonymously());identities.push({id:signed.user.id,token:signed.session.access_token});ok(await c.from('profiles').insert({user_id:signed.user.id,display_name:'Voice acceptance',time_zone:'Europe/Warsaw'}));}
 ok(await clients[0].from('conversations').insert({user_id:identities[0].id,id:conversation,mode:'capture',started_at:now,ended_at:null}));
 const mixed=await turn("I drank a coffee today and I felt sore after yesterday's leg workout.");
 let result=await call(0,mixed);
 assert.equal(result.capture.result.status,'needs_clarification');
 assert.equal(ok(await clients[0].from('subjective_events').select('id')).length,0);
 const clarify=await turn('My soreness was six out of ten yesterday. The coffee was today; I do not know its caffeine amount.',mixed.turnId);
 result=await call(0,clarify);assert.equal(result.disposition,'followup');assert.equal(result.capture.result.status,'captured',JSON.stringify(result.capture.result));
 assert.equal(result.capture.acceptedResult.events.length,2);
 const events=ok(await clients[0].from('subjective_events').select('payload'));
 assert.equal(events.length,2);assert.equal(events.find(e=>e.payload.type==='soreness').payload.value,6);
 assert.equal(events.find(e=>e.payload.type==='caffeine').payload.value.amountMg,null);
 const repeated=await call(0,clarify);assert.deepEqual(repeated,result);
 assert.equal(ok(await clients[0].from('subjective_events').select('id')).length,2);
 let query=await call(0,await turn('What caffeine did I record today?'));
 assert.equal(query.disposition,'retrieval');assert.equal(query.retrieval.from,today);assert.equal(query.retrieval.events.length,1);assert.equal(query.retrieval.events[0].value.consumed,true);assert.equal(query.retrieval.events[0].value.amountMg,null);assert.equal(query.retrieval.complete,true);
 query=await call(0,await turn('What soreness did I record yesterday?'));
 assert.equal(query.retrieval.from,yesterday);assert.equal(query.retrieval.events[0].value,6);
 const correction=await turn('Actually I did not drink any coffee today. Keep the soreness at six out of ten yesterday.',mixed.turnId);
 result=await call(0,correction);assert.equal(result.disposition,'followup');assert.equal(result.capture.result.status,'captured',JSON.stringify(result.capture.result));assert.equal(result.capture.acceptedResult.events.length,2,JSON.stringify(result.capture.result));
 const corrected=await call(0,await turn('What caffeine did I record today?'));
 assert.equal(corrected.retrieval.events[0].value.consumed,false);
 assert.equal((await call(0,await turn('[breathing]'))).disposition,'ignore');
 const capabilities=await call(0,await turn('What can you actually track?'));
 for(const word of ['energy','stress','mood','soreness','workout','alcohol','caffeine','late meals','illness','pain'])assert.ok(capabilities.reply.includes(word));
 const hrv=await call(0,await turn('What was my HRV in the past seven days?'));
 assert.equal(hrv.retrieval,null,'Untracked HRV must not run a retrieval of other types');assert.match(hrv.reply,/hrv/i);
 const ambiguous=await turn('I drank alcohol today and I was sore yesterday.');
 const asked=await call(0,ambiguous);assert.equal(asked.capture.result.status,'needs_clarification');
 assert.deepEqual([...asked.capture.result.eventTypes].sort(),['alcohol','soreness'],'One question must open both the drink count and the rating');
 const pair=await turn('I drank alcohol today and I was sore yesterday.');
 await call(0,pair);
 const paired=await call(0,await turn('two drinks, and six out of ten',pair.turnId));
 assert.equal(paired.capture.result.status,'captured',JSON.stringify(paired.capture.result));
 assert.equal(paired.capture.acceptedResult.events.find(e=>e.type==='alcohol').value.quantity,2);
 assert.equal(paired.capture.acceptedResult.events.find(e=>e.type==='soreness').value,6);
 const one=await call(0,await turn('one',ambiguous.turnId));
 assert.ok(!(one.capture?.acceptedResult?.events??[]).some(e=>e.type==='alcohol'&&e.value?.quantity===1),'A bare number must not become a drink count');
 console.log('Review "one" outcome (not asserted beyond the rule above):',JSON.stringify({status:one.capture?.result?.status??null,reply:one.reply,events:(one.capture?.acceptedResult?.events??[]).map(e=>({type:e.type,value:e.value}))}));
 const countBefore=ok(await clients[0].from('subjective_events').select('id')).length;
 assert.equal((await call(0,await turn('Cancel this clarification.',mixed.turnId))).disposition,'cancel');
 const cancelledCompleted=await call(0,await turn('Cancel',mixed.turnId));
 assert.equal(cancelledCompleted.disposition,'cancel');assert.equal(cancelledCompleted.capture,null);
 const empty=await call(0,await turn('What pain did I record today?'));
 assert.deepEqual(empty.retrieval.events,[]);assert.ok(empty.reply.includes('does not mean'));
 assert.equal(ok(await clients[0].from('subjective_events').select('id')).length,countBefore);
 const noauth=await fetch(origin+'/api/voice/turn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mixed)});assert.equal(noauth.status,401);
 const cross=await fetch(origin+'/api/voice/turn',{method:'POST',headers:{Authorization:'Bearer '+identities[1].token,'Content-Type':'application/json'},body:JSON.stringify(mixed)});assert.equal(cross.status,404);
 const foreign=ok(await clients[1].from('voice_turn_runs').select('*'));assert.deepEqual(foreign,[]);
 const denied=await clients[0].from('voice_turn_runs').insert({user_id:identities[0].id,turn_id:mixed.turnId,transcript:'forged'});assert.ok(denied.error);
 const history=await fetch(origin+'/api/voice/turn?conversationId='+conversation,{headers:{Authorization:'Bearer '+identities[0].token}});assert.equal(history.status,200);assert.ok((await history.json()).runs.length>=10);
 console.log('PASS Stage 4.5 hosted/provider: mixed-report clarification, unknown caffeine dose, dated retrieval, atomic spoken correction, receipt replay, breathing classification, capabilities, cancellation, empty retrieval, owner isolation and direct-write denial.');
}finally{
 for(let i=0;i<identities.length;i++){for(const table of ['conversations','profiles']){const r=await clients[i].from(table).delete().eq('user_id',identities[i].id);if(r.error)console.log('Cleanup failed for '+table);}await clients[i].auth.signOut();}
 console.log(`Synthetic records removed; ${identities.length} disposable anonymous Auth accounts remain.`);
}
