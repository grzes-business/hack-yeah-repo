import { LocalDateSchema } from "../domain";
// This parser only accepts explicit complete dates; it never guesses a missing year.
const months=["january","february","march","april","may","june","july","august","september","october","november","december"];
const ordinals=["first","second","third","fourth","fifth","sixth","seventh","eighth","ninth","tenth","eleventh","twelfth","thirteenth","fourteenth","fifteenth","sixteenth","seventeenth","eighteenth","nineteenth","twentieth","twenty first","twenty second","twenty third","twenty fourth","twenty fifth","twenty sixth","twenty seventh","twenty eighth","twenty ninth","thirtieth","thirty first"];
export function explicitVoiceDate(text:string):string|undefined|null{
 const iso=text.match(/\b\d{4}-\d{2}-\d{2}\b/g);
 if(iso){if(iso.length!==1)return null;const date=LocalDateSchema.safeParse(iso[0]);return date.success?date.data:null;}
 const lower=text.toLowerCase().replace(/-/g," ");
 const pattern=new RegExp(`\\b(${months.join("|")})\\s+(\\d{1,2}(?:st|nd|rd|th)?|${[...ordinals].sort((a,b)=>b.length-a.length).join("|")})\\s*,?\\s*(\\d{4})\\b`,"g");
 const matches=[...lower.matchAll(pattern)];
 if(matches.length!==1)return matches.length>1?null:undefined;
 const match=matches[0],month=months.indexOf(match[1])+1,day=/^\d/.test(match[2])?parseInt(match[2],10):ordinals.indexOf(match[2])+1;
 const date=LocalDateSchema.safeParse(`${match[3]}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`);
 return date.success?date.data:null;
}
