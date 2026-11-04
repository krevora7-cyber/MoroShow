// Share overlapping reads only; no session or account state survives completion.
export function singleFlight<T>() {
 const pending=new Map<string,Promise<T>>();
 return (key:string,work:()=>Promise<T>):Promise<T>=>{
  const hit=pending.get(key);if(hit)return hit;
  const request=Promise.resolve().then(work).finally(()=>pending.delete(key));
  pending.set(key,request);return request;
 };
}
