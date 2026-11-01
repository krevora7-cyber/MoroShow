import {createClient} from '@supabase/supabase-js';
const url=String(import.meta.env.VITE_SUPABASE_URL||'').trim();
const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim();
export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'moro-account-session'}}):null;
