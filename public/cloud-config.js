// Cloud save settings — the same two values go in both games.
// Supabase → Project Settings → API (or "Data API"): copy the Project URL and the anon / publishable key.
// Leave them empty to turn cloud save off. The anon key is safe to publish: each player can only read their own saves.
window.CLOUD_CONFIG = {
  url: "",
  anonKey: "",
  // Mobile-number sign-in (one-time code by SMS). Turn on only after adding an SMS provider in
  // Supabase → Authentication → Sign In / Providers → Phone. Numbers without +code get this country code.
  phone: false,
  country: "91"
};
