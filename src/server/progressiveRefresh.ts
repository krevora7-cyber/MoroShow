// Publish the first usable directory without waiting for a slow peer.
export class ProgressiveRefresh {
 private pending?:Promise<void>;
 private first?:Promise<void>;
 private ready?:()=>void;
 get refreshing(){return !!this.pending;}
 publish(){this.ready?.();}
 start(work:()=>Promise<void>){
  if(this.pending)return this.pending;
  this.first=new Promise<void>(resolve=>{this.ready=resolve;});
  this.pending=Promise.resolve().then(work).finally(()=>{this.ready?.();this.pending=undefined;this.ready=undefined;});
  return this.pending;
 }
 async waitForFirst(){await Promise.race([this.first,this.pending]);}
}
