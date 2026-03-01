import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qgpnhocdffzumkqlmiqe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jzvXN_jpeLoiENlTP0xJWA_tCoulv64';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);