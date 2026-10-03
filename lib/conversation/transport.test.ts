import test from "node:test";
import assert from "node:assert/strict";
import { VoiceTransport, type VoiceInputOptions } from "./transport";
async function harness(mode:VoiceInputOptions["mode"],run:(t:VoiceTransport,m:{sent:Record<string,unknown>[];track:{enabled:boolean;stop:()=>void};event:(event:unknown)=>void;stopped:()=>boolean})=>void){
 const descriptors={navigator:Object.getOwnPropertyDescriptor(globalThis,"navigator"),RTCPeerConnection:Object.getOwnPropertyDescriptor(globalThis,"RTCPeerConnection"),fetch:Object.getOwnPropertyDescriptor(globalThis,"fetch")};
 const sent:Record<string,unknown>[]=[];let stopped=false;
 const track={enabled:true,stop:()=>{stopped=true;}};
 const channel={readyState:"open",onopen:null as (()=>void)|null,onclose:null as (()=>void)|null,onmessage:null as ((e:{data:string})=>void)|null,send:(s:string)=>sent.push(JSON.parse(s)),close:()=>{}};
 class Peer{
  localDescription:unknown=null;ontrack=null;onconnectionstatechange=null;connectionState="connected";
  addTrack(){} createDataChannel(){return channel;} async createOffer(){return {type:"offer",sdp:"v=0 fake audio offer"};}
  async setLocalDescription(value:unknown){this.localDescription=value;} async setRemoteDescription(){channel.onopen?.();} close(){}
 }
 Object.defineProperty(globalThis,"navigator",{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]})}}});
 Object.defineProperty(globalThis,"RTCPeerConnection",{configurable:true,value:Peer});
 Object.defineProperty(globalThis,"fetch",{configurable:true,value:async()=>Response.json({sdp:"v=0 fake answer",startedAt:"2026-10-03T08:00:00.000Z"})});
 const audio={srcObject:null,pause:()=>{},play:async()=>{}} as unknown as HTMLAudioElement;
 const errors:string[]=[];
 const t=new VoiceTransport(audio,{state:()=>{},event:()=>{},error:e=>errors.push(e),notice:()=>{},created:()=>{},activity:()=>{},interrupted:()=>{}});
 try{await t.start("test-token","test-conversation",{mode,microphone:"laptop",sensitivity:"less_sensitive"});run(t,{sent,track,event:e=>channel.onmessage?.({data:JSON.stringify(e)}),stopped:()=>stopped});assert.deepEqual(errors,[]);}
 finally{t.close();for(const [key,value]of Object.entries(descriptors)){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
}
test("press-to-speak disables idle input, commits once, discards cancellation, and closes tracks",async()=>{
 await harness("press_to_speak",(t,m)=>{
  assert.equal(m.track.enabled,false);assert.equal(t.beginSpeech(),true);assert.equal(m.track.enabled,true);
  const clock=Date.now;const start=clock();Date.now=()=>start+300;
  try{t.endSpeech();t.endSpeech();}finally{Date.now=clock;}
  assert.equal(m.track.enabled,false);assert.equal(m.sent.filter(e=>e.type==="input_audio_buffer.commit").length,1);
  t.beginSpeech();t.endSpeech(true);assert.equal(m.sent.filter(e=>e.type==="input_audio_buffer.commit").length,1);
  t.mute(true);assert.equal(t.beginSpeech(),false);t.close();assert.equal(m.stopped(),true);assert.equal(t.say("Saved","after-stop"),false);
 });
});
test("continuous input requires app-selected replies and interruption cancels playback",async()=>{
 await harness("continuous",(t,m)=>{
  assert.equal(m.track.enabled,true);m.event({type:"input_audio_buffer.speech_started"});assert.equal(t.say("Saved","turn"),false);
  m.event({type:"input_audio_buffer.speech_stopped"});assert.equal(m.sent.some(e=>e.type==="response.create"),false);
  assert.equal(t.say("Saved caffeine with unknown dose.","turn"),true);assert.equal(t.say("Duplicate","turn"),false);
  const response=m.sent.find(e=>e.type==="response.create")!.response as {conversation:string;input:unknown[]};assert.equal(response.conversation,"none");assert.deepEqual(response.input,[]);
  m.event({type:"response.created"});m.event({type:"output_audio_buffer.started"});m.event({type:"input_audio_buffer.speech_started"});
  assert.ok(m.sent.some(e=>e.type==="response.cancel"));assert.ok(m.sent.some(e=>e.type==="output_audio_buffer.clear"));
 });
});
test("late transcription from a previous utterance cannot become the current spoken reply",async()=>{
 await harness("press_to_speak",(t,m)=>{
  t.beginSpeech();const clock=Date.now;const start=clock();Date.now=()=>start+300;
  try{t.endSpeech();}finally{Date.now=clock;}
  m.event({type:"input_audio_buffer.committed",item_id:"first"});
  assert.equal(t.isCurrentInput({item_id:"first"}),true);
  t.beginSpeech();assert.equal(t.isCurrentInput({item_id:"first"}),false);
  t.endSpeech(true);assert.equal(t.isCurrentInput({item_id:"unknown"}),false);
 });
});
