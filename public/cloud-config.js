// Cloud save settings — the same two values go in both games.
// Supabase → Project Settings → API (or "Data API"): copy the Project URL and the anon / publishable key.
// Leave them empty to turn cloud save off. The anon key is safe to publish: each player can only read their own saves.
window.CLOUD_CONFIG = {
  url: "",
  anonKey: ""
};
