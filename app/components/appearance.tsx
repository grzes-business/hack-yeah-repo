"use client";
import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useState } from "react";
export function Appearance(){
 const [override,setOverride]=useState<'light'|'dark'|null>(null);
 return <button className="btn btn-ghost btn-circle" aria-label="Toggle light or dark appearance" onClick={()=>{const dark=override?override==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;const next=dark?'light':'dark';document.documentElement.dataset.theme=next;setOverride(next);}}>{override==='dark'?<SunIcon size={21}/>:<MoonIcon size={21}/>}</button>;
}
