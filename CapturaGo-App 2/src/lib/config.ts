// Public configuration. The anon key is designed to be public — security comes from
// the database's Row Level Security rules. NEVER put a secret / service_role key here.
export const SUPABASE_URL = 'https://drpugnclcgfmrfhxujwu.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRycHVnbmNsY2dmbXJmaHh1and1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0ODY5MDQsImV4cCI6MjEwNTA2MjkwNH0.jRH2hrvxqlvBK6zx0AzQCZTEksVhfTpA9UUkwbmh_qc';
export const SITE_URL = 'https://capturago.com';
export const SUPPORT_EMAIL = 'hello@capturago.com';

// Must match CLIENT_FEE_PCT in the Supabase function secrets and clientFeePercent in site.js
export const CLIENT_FEE_PCT = 10;
// Lower client fee when a traveller books through the creator's own link (capturago.com/c/<name>).
// Must match CREATOR_LINK_CLIENT_FEE_PCT in the Supabase function secrets and creatorLinkFeePercent in site.js
export const LINK_FEE_PCT = 5;
// Must match CREATOR_FEE_PCT in the Supabase function secrets (website: site.js creatorFeePercent)
export const CREATOR_FEE_PCT = 0;
// Show demo profiles while there are fewer real creators than this (same as the website)
export const SHOW_EXAMPLES_BELOW = 6;
