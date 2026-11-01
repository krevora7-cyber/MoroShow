import {createClient} from '@supabase/supabase-js';
// Public browser configuration for this deployment. Environment overrides must supply a pair.
// A publishable key is not a server secret; account data remains protected by RLS.
const configuredUrl=String(import.meta.env.VITE_SUPABASE_URL||'').trim();
const configuredKey=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim();
const url=configuredUrl||'https://jjbexklnupmthgqcqqso.supabase.co';
const key=configuredUrl?configuredKey:'sb_publishable_p0heKQVYuTBvNos7s7Y8hA_efgxMoXt';
export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'moro-account-session'}}):null;
