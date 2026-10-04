// Schema snapshot for migrations 202610030001 through 202610040010. Regenerate from hosted Supabase
// after applying migrations; review changes rather than overwriting blindly.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row; Insert: Insert; Update: Update; Relationships: [];
};
type Owned = { user_id: string; id: string };
type Payload = Owned & { payload: Json; observed_at: string };
type MetricPayload = Payload & { started_at: string };
type Conversation = Owned & { mode: string; started_at: string; ended_at: string | null };
type Turn = Owned & { conversation_id: string; role: string; transcript: string; occurred_at: string };
type Profile = { user_id: string; display_name: string; time_zone: string; created_at: string };
type Daily = { user_id: string; date: string; time_zone: string; builder_version: string; payload: Json; input_generation: number | null };
type Result = { time_zone: string | null; builder_version: string | null; user_id: string; relationship_id: string; period_from: string; period_to: string; analysis_version: string; payload: Json; input_generation: number | null };
type TurnExtraction = { user_id: string; root_turn_id: string; extractor_version: string; source_turn_id: string; root_transcript: string; anchor_at: string; time_zone: string; captured_at: string; revision: number; result: Json | null; accepted_result: Json | null; history: Json; lease_token: string | null; lease_until: string | null };
export type Database = {
 public: {
  Tables: {
   evidence_question_loops: Table<{user_id:string;conversation_id:string;revision:number;payload:Json},{user_id:string;conversation_id:string;revision:number;payload:Json}>,
   reset_conversation_ids: Table<{user_id:string;id:string},{user_id:string;id:string}>;
   feature_input_generations: Table<{user_id:string;generation:number;changed_at:string},{user_id:string;generation?:number;changed_at?:string}>;
   voice_turn_runs: Table<{user_id:string;turn_id:string;transcript:string;target_root_id:string|null;target_revision:number|null;plan:Json|null;result:Json|null;lease_token:string|null;lease_until:string|null}, {user_id:string;turn_id:string;transcript:string;target_root_id?:string|null;target_revision?:number|null;plan?:Json|null;result?:Json|null;lease_token?:string|null;lease_until?:string|null}>;
   turn_extractions: Table<TurnExtraction, TurnExtraction>;
   profiles: Table<Profile, Omit<Profile, "created_at" | "display_name" | "time_zone"> & Partial<Profile>>;
   conversations: Table<Conversation, Conversation>;
   conversation_turns: Table<Turn, Turn>;
   metric_samples: Table<MetricPayload & { metric: string; source_type: string; external_id: string }, MetricPayload>;
   subjective_events: Table<Payload & { conversation_turn_id: string; event_type: string }, Payload & { conversation_turn_id: string }>;
   daily_features: Table<Daily, Omit<Daily, "input_generation"> & {input_generation?:number|null}>;
   morning_checkins: Table<{ user_id: string; local_date: string; skipped: string[]; ended_at: string | null; updated_at: string }, { user_id: string; local_date: string; skipped?: string[]; ended_at?: string | null; updated_at?: string }>;
   relationship_results: Table<Result, Omit<Result, "input_generation"> & {input_generation?:number|null}>;
  };
  Views: { [_ in never]: never }; Functions: {
   commit_question_loop: {Args:{p_owner:string;p_revision:number;p_generation:string;p_zone:string;p_state:Json;p_capture?:Json|null};Returns:number};
   commit_relationship_results: {Args:{p_owner:string;p_generation:string;p_zone:string;p_builder:string;p_rows:Json};Returns:number};
   reset_owned_history: {Args:{p_owner:string};Returns:undefined};
   read_feature_generation: {Args:{p_owner:string};Returns:Json};
   commit_daily_features: {Args:{p_owner:string;p_generation:string;p_rows:Json};Returns:number};
   claim_voice_turn: {Args:{p_turn:string;p_token:string;p_target?:string|null};Returns:Json};
   plan_voice_turn: {Args:{p_turn:string;p_token:string;p_plan:Json};Returns:Json};
   finish_voice_turn: {Args:{p_turn:string;p_token:string;p_result:Json};Returns:Json};
   release_voice_turn: {Args:{p_turn:string;p_token:string};Returns:undefined};
   claim_turn_extraction: { Args: { p_root: string; p_token: string; p_revision?: number | null; p_followup_id?: string | null; p_followup?: string | null }; Returns: Json };
   finish_turn_extraction: { Args: { p_root: string; p_token: string; p_result: Json }; Returns: Json };
   release_turn_extraction: { Args: { p_root: string; p_token: string }; Returns: undefined };
  };
  Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never };
 };
};
export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
