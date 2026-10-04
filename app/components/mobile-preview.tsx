"use client";
import { useState } from "react";
export function MobilePreview(){
 const [width,setWidth]=useState(390),[path,setPath]=useState('/talk');
 return <main style={{padding:24}}><h1>Mobile layout preview</h1><p>Development only. This uses the real application and your current browser session.</p><div className="view-controls"><label>Preview width<select className="select w-full" value={width} onChange={e=>setWidth(Number(e.target.value))}>{[320,375,390,430].map(w=><option value={w} key={w}>{w} px</option>)}</select></label><label>Preview screen<select className="select w-full" value={path} onChange={e=>setPath(e.target.value)}><option value="/talk">Talk</option><option value="/">Today</option><option value="/evidence">Insights</option><option value="/timeline">History</option></select></label></div><iframe title="Mobile app preview" src={path} style={{display:'block',width:width+2,maxWidth:'100%',height:844,border:'1px solid #9ba99c',marginTop:24,borderRadius:20}}/></main>;
}
