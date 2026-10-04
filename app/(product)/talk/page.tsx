import { VoiceConversation } from "@/app/components/voice-conversation";
import { MorningCheckin } from "@/app/components/morning-checkin";
export default function Talk(){return <><header className="header"><h1>Talk</h1><p className="lede">A quick check-in. A question. Whatever’s on your mind.</p></header><VoiceConversation/><MorningCheckin/></>;}
