/* Jetvault feature switches.

   TEAM-UP (partner referral links) IS LOCKED until Flight Sim can read the early-access data.
   The page shows the feature with an animated padlock and does not talk to the backend.

   To open it, do BOTH of these (the database lock is the one that really counts):
     1. set teamUp to true below
     2. run in Supabase:  update public.early_access_settings set teamup_open = true;
*/
window.JV_FEATURES = { teamUp: false };
if (window.JV_FEATURES.teamUp) document.documentElement.setAttribute('data-teamup', 'open');
