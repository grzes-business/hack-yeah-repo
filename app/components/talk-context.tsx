"use client";
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import type { VoiceContext } from "@/lib/conversation/controller-contracts";
import { useHealthSession } from "./session";
type Scope="personal"|"demo";
const SCOPE_KEY="data-source",SCOPE_EVENT="data-source-change";
const readScope=():Scope=>{try{return localStorage.getItem(SCOPE_KEY)==="demo"?"demo":"personal";}catch{return "personal";}};
const subscribeScope=(notify:()=>void)=>{window.addEventListener(SCOPE_EVENT,notify);window.addEventListener("storage",notify);return()=>{window.removeEventListener(SCOPE_EVENT,notify);window.removeEventListener("storage",notify);};};
type State={context:VoiceContext;prompt:string|null;request:number;select:(context:VoiceContext,prompt?:string,announce?:boolean)=>void;scope:Scope;setScope:(scope:Scope)=>void};
const Context=createContext<State|null>(null);
export function TalkProvider({children}:{children:ReactNode}){
 const {session}=useHealthSession();
 return <OwnedTalkProvider key={session?.user.id??"signed-out"}>{children}</OwnedTalkProvider>;
}
function OwnedTalkProvider({children}:{children:ReactNode}){
 // Data source shared by Today, Insights and Talk; voice investigations use it too.
 const [context,setContext]=useState<VoiceContext>({mode:"report"}),[prompt,setPrompt]=useState<string|null>(null),[request,setRequest]=useState(0);
 // Stored per device; the server render and hydration use "personal", then the stored choice applies.
 const scope=useSyncExternalStore(subscribeScope,readScope,()=>"personal" as Scope);
 const setScope=(next:Scope)=>{try{localStorage.setItem(SCOPE_KEY,next);}catch{/* convenience only */}window.dispatchEvent(new Event(SCOPE_EVENT));};
 return <Context.Provider value={{context,prompt,request,scope,setScope,select:(next,text,announce=true)=>{setContext(next);setPrompt(text??null);if(announce)setRequest(v=>v+1);}}}>{children}</Context.Provider>;
}
export function useTalkContext(){const value=useContext(Context);if(!value)throw new Error("Missing Talk provider");return value;}
