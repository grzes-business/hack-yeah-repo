// Opt-in live acceptance checks. Creates two disposable anonymous Auth users.
// Removes their test records; Auth accounts remain without privileged cleanup.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createHealthRepository } from '../.contract-tests/db/repository.js';
import { seedDemoHistory } from '../.contract-tests/demo/seed.js';
import { DemoOptionsSchema, demoRange } from '../.contract-tests/demo/scenario.js';
import { MockHealthDataSource } from '../.contract-tests/health/mock-data-source.js';
import { Metrics } from '../.contract-tests/domain/index.js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const clients = [createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})];
const unauth = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[];
const ok = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const deny = result => assert.ok(result.error, 'Expected operation to be rejected');
const now = new Date().toISOString();
const sample = { id:'acceptance-sample', metric:'hrv', value:42, unit:'ms', startedAt:now, endedAt:now, source:{type:'mock',externalId:'acceptance-source'} };
try {
 for (const c of clients) {
  users.push(ok(await c.auth.signInAnonymously()).user.id);
 }
 assert.notEqual(users[0],users[1]);
 for (let i=0;i<2;i++) {
  const c=clients[i], uid=users[i];
  ok(await c.from('profiles').insert({user_id:uid,display_name:`Acceptance participant ${i}`,time_zone:'Europe/Warsaw'}));
  assert.equal(ok(await c.from('profiles').select('*').eq('user_id',uid).single()).time_zone,'Europe/Warsaw');
  ok(await c.from('conversations').insert({user_id:uid,id:'acceptance-conversation',mode:'capture',started_at:now,ended_at:null}));
  ok(await c.from('conversation_turns').insert({user_id:uid,id:'acceptance-turn',conversation_id:'acceptance-conversation',role:'user',transcript:'Acceptance check: energy six out of ten.',occurred_at:now}));
  ok(await c.from('metric_samples').upsert({user_id:uid,id:sample.id,started_at:now,observed_at:now,payload:sample},{onConflict:'user_id,id'}));
  const event={id:'acceptance-event',type:'energy',value:6,occurredAt:now,capturedAt:now,timeZone:'Europe/Warsaw',conversationTurnId:'acceptance-turn',extractionConfidence:null};
  ok(await c.from('subjective_events').insert({user_id:uid,id:event.id,conversation_turn_id:event.conversationTurnId,observed_at:now,payload:event}));
  assert.equal(ok(await c.from('metric_samples').select('*')).length,1);
  assert.equal(ok(await c.from('subjective_events').select('*')).length,1);
 }
 const a=clients[0], other=users[1];
 assert.deepEqual(ok(await a.from('profiles').select('*').eq('user_id',other)),[]);
 deny(await a.from('profiles').insert({user_id:other,display_name:'forbidden',time_zone:'UTC'}));
 const changed=ok(await a.from('profiles').update({display_name:'forbidden'}).eq('user_id',other).select()); assert.deepEqual(changed,[]);
 assert.equal(ok(await clients[1].from('profiles').select('*').eq('user_id',other).single()).display_name,'Acceptance participant 1');
 deny(await a.from('metric_samples').insert({user_id:other,id:'forbidden',started_at:now,observed_at:now,payload:{...sample,id:'forbidden'}}));
 ok(await clients[1].from('conversations').insert({user_id:other,id:'other-only-conversation',mode:'capture',started_at:now,ended_at:null}));
 deny(await a.from('conversation_turns').insert({user_id:users[0],id:'cross-user-turn',conversation_id:'other-only-conversation',role:'user',transcript:'forbidden',occurred_at:now}));
 ok(await clients[1].from('conversation_turns').insert({user_id:other,id:'other-only-turn',conversation_id:'other-only-conversation',role:'user',transcript:'private',occurred_at:now}));
 deny(await a.from('subjective_events').insert({user_id:users[0],id:'cross-user-event',conversation_turn_id:'other-only-turn',observed_at:now,payload:{id:'cross-user-event',type:'energy',value:6,occurredAt:now,capturedAt:now,timeZone:'UTC',conversationTurnId:'other-only-turn',extractionConfidence:null}}));
 deny(await a.from('daily_features').insert({user_id:users[0],date:'2026-10-03',time_zone:'UTC',builder_version:'acceptance',payload:{}}));
 deny(await a.from('relationship_results').insert({user_id:users[0],relationship_id:'alcohol__hrv',period_from:'2026-10-03',period_to:'2026-10-03',analysis_version:'acceptance',payload:{}}));
 for (const table of ['profiles','conversations','conversation_turns','metric_samples','subjective_events','daily_features','relationship_results']) deny(await unauth.from(table).select('*'));
 console.log('PASS Stage 1: two users, private raw/profile records, foreign-user isolation, provenance references, derived write restrictions, unauthenticated denial.');
 const options = DemoOptionsSchema.parse({endDate:'2026-10-02',timeZone:'Europe/Warsaw'});
 const instantRange = demoRange(options);
 const range = {...instantRange, metrics:Object.values(Metrics)};
 const repositories=clients.map(createHealthRepository);
 const fixture=await new MockHealthDataSource(options).getSamples(range);
 const first=await seedDemoHistory(repositories[0],options);
 assert.deepEqual(await seedDemoHistory(repositories[0],options),first);
 assert.deepEqual(await repositories[0].readMetricSamples(range),fixture);
 const subjective=await repositories[0].readSubjectiveEvents(instantRange);
 assert.equal(subjective.length,first.events);
 assert.ok(first.metrics > 250 && first.events > 500, 'Fixture must exercise multiple pages');
 const sleep=fixture.find(v=>v.metric==='sleep_duration');
 assert.deepEqual(await repositories[0].readMetricSamples({from:new Date(Date.parse(sleep.startedAt)+60000),to:new Date(sleep.endedAt),metrics:['sleep_duration']}),[sleep]);
 const instantSample=fixture.find(v=>v.metric==='hrv');
 assert.deepEqual(await repositories[0].readMetricSamples({from:new Date(Date.parse(instantSample.endedAt)-60000),to:new Date(instantSample.endedAt),metrics:['hrv']}),[]);
 await seedDemoHistory(repositories[1],options);
 await repositories[0].removeDemoHistory(options);
 assert.deepEqual(await repositories[0].readMetricSamples(range),[]);
 assert.deepEqual(await repositories[0].readSubjectiveEvents(instantRange),[]);
 assert.equal((await repositories[1].readMetricSamples(range)).length,first.metrics);
 // The acceptance observation lies outside the fixture namespace and survives.
 assert.equal(ok(await clients[0].from('metric_samples').select('*')).length,1);
 assert.equal(ok(await clients[0].from('subjective_events').select('*')).length,1);
 await seedDemoHistory(repositories[0],options);
 assert.deepEqual(await repositories[0].readMetricSamples(range),fixture);
 await repositories[0].removeDemoHistory(options);
 await repositories[1].removeDemoHistory(options);
 console.log(`PASS Stage 2: ${first.metrics} samples and ${first.events} events; stable replay, paginated range reads, interval boundaries, owner-only fixture removal, unrelated records retained, reload after removal.`);
} finally {
 for (let i=0;i<users.length;i++) {
  const c=clients[i],uid=users[i];
  for(const table of ['conversations','metric_samples','profiles']) { const result=await c.from(table).delete().eq('user_id',uid); if(result.error)console.log(`Cleanup failed for ${table}`); }
  await c.auth.signOut();
 }
 console.log(`Acceptance-check records removed. ${users.length} disposable anonymous Auth accounts remain; no privileged key used.`);
}
