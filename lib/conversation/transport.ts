export type VoiceState = "requesting" | "connecting" | "active";
export type VoiceCallbacks = { state: (state: VoiceState) => void; event: (event: unknown) => void; error: (message: string) => void; notice: (message: string) => void; created: (startedAt: string) => void };

export class VoiceTransport {
 private peer: RTCPeerConnection | null = null;
 private stream: MediaStream | null = null;
 private channel: RTCDataChannel | null = null;
 private abort = new AbortController();
 private closed = false;
 private timer: ReturnType<typeof setTimeout> | null = null;
 constructor(private audio: HTMLAudioElement, private callbacks: VoiceCallbacks) {}
 async start(token: string, conversationId: string) {
  if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") throw new Error("Voice needs a supported browser on HTTPS or localhost.");
  this.callbacks.state("requesting");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
  if (this.closed) { stream.getTracks().forEach(track => track.stop()); return; }
  this.stream = stream;
  this.callbacks.state("connecting");
  const peer = new RTCPeerConnection(); this.peer = peer;
  stream.getTracks().forEach(track => peer.addTrack(track, stream));
  peer.ontrack = event => { if (this.closed) return; this.audio.srcObject = event.streams[0] ?? new MediaStream([event.track]); void this.audio.play().catch(() => this.callbacks.notice("Audio playback is blocked. Use the audio playback control to hear the assistant.")); };
  peer.onconnectionstatechange = () => { if (this.closed) return; if (["failed", "disconnected", "closed"].includes(peer.connectionState)) { this.callbacks.error("Voice disconnected. Your finalized transcript can still be saved. Start a new conversation to reconnect."); this.close(); } };
  const channel = peer.createDataChannel("oai-events"); this.channel = channel;
  channel.onopen = () => {
   if (this.closed) return;
   if (this.timer) clearTimeout(this.timer);
   this.callbacks.state("active");
   // Short demo sessions bound normal usage. Closing tracks also closes the media connection.
   this.timer = setTimeout(() => { this.callbacks.error("The 10-minute demo conversation ended. You can start another."); this.close(); }, 10 * 60000);
  };
  channel.onclose = () => { if (!this.closed) { this.callbacks.error("Voice session ended or expired. Start a new conversation to reconnect."); this.close(); } };
  channel.onmessage = message => {
   if (this.closed || typeof message.data !== "string" || message.data.length > 200000) return;
   try {
    const event = JSON.parse(message.data);
    if (event.type === "error") { this.callbacks.error("The voice provider reported an error. Stop and start again; finalized transcript remains available."); this.close(); return; }
    if (event.type === "conversation.item.input_audio_transcription.failed") this.callbacks.notice("A spoken turn could not be transcribed. Please repeat it; no guessed transcript was saved.");
    this.callbacks.event(event);
   } catch { /* Non-JSON messages cannot trigger app actions. */ }
  };
  this.timer = setTimeout(() => { this.callbacks.error("Voice connection timed out. Please retry."); this.close(); }, 40000);
  await peer.setLocalDescription(await peer.createOffer());
  const response = await fetch("/api/voice/session", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, sdp: peer.localDescription?.sdp }), signal: this.abort.signal });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Voice could not connect.");
  this.callbacks.created(result.startedAt);
  if (this.closed) return;
  await peer.setRemoteDescription({ type: "answer", sdp: result.sdp });
 }
 mute(value: boolean) { this.stream?.getAudioTracks().forEach(track => { track.enabled = !value; }); }
 close() {
  if (this.closed) return;
  this.closed = true; this.abort.abort();
  if (this.timer) clearTimeout(this.timer);
  this.stream?.getTracks().forEach(track => track.stop());
  this.channel?.close(); this.peer?.close();
  this.audio.pause(); this.audio.srcObject = null;
 }
}
