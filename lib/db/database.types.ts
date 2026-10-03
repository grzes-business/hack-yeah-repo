// Schema snapshot for migrations 202610030001 and 202610030002. Regenerate from hosted Supabase
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
type Daily = { user_id: string; date: string; time_zone: string; builder_version: string; payload: Json };
type Result = { user_id: string; relationship_id: string; period_from: string; period_to: string; analysis_version: string; payload: Json };
export type Database = {
 public: {
  Tables: {
   profiles: Table<Profile, Omit<Profile, "created_at" | "display_name" | "time_zone"> & Partial<Profile>>;
   conversations: Table<Conversation, Conversation>;
   conversation_turns: Table<Turn, Turn>;
   metric_samples: Table<MetricPayload & { metric: string; source_type: string; external_id: string }, MetricPayload>;
   subjective_events: Table<Payload & { conversation_turn_id: string; event_type: string }, Payload & { conversation_turn_id: string }>;
   daily_features: Table<Daily, Daily>;
   relationship_results: Table<Result, Result>;
  };
  Views: { [_ in never]: never }; Functions: { [_ in never]: never };
  Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never };
 };
};
export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
