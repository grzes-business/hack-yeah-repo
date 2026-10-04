"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { VoiceContext } from "@/lib/conversation/controller-contracts";
import { useHealthSession } from "./session";
type State={context:VoiceContext;prompt:string|null;request:number;select:(context:VoiceContext,prompt?:string,announce?:boolean)=>void};
const Context=createContext<State|null>(null);
export function TalkProvider({children}:{children:ReactNode}){
 const {session}=useHealthSession();
 return <OwnedTalkProvider key={session?.user.id??"signed-out"}>{children}</OwnedTalkProvider>;
}
function OwnedTalkProvider({children}:{children:ReactNode}){
 const [context,setContext]=useState<VoiceContext>({mode:"report"}),[prompt,setPrompt]=useState<string|null>(null),[request,setRequest]=useState(0);
 return <Context.Provider value={{context,prompt,request,select:(next,text,announce=true)=>{setContext(next);setPrompt(text??null);if(announce)setRequest(v=>v+1);}}}>{children}</Context.Provider>;
}
export function useTalkContext(){const value=useContext(Context);if(!value)throw new Error("Missing Talk provider");return value;}
