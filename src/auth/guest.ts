export const GUEST_PROFILE_ID='moro-guest';
export function requestSignIn(){window.dispatchEvent(new Event('moro-sign-in'));}
export const isGuestProfile=(id?:string)=>id===GUEST_PROFILE_ID;
