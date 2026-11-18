import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';

type NativeProgress = {session:string; currentTime:number; duration:number};
interface NativeProtectedPlayer {
  open(options:{title:string;session:string;sources:{label:string;url:string}[];choices:string[];selected:number;blockedHosts:string[];protectionEnabled:boolean}):Promise<{closed:boolean;switchTo?:number}>;
  addListener(event:'progress',callback:(data:NativeProgress)=>void):Promise<PluginListenerHandle>;
  close():Promise<void>;
}
export const ProtectedPlayer=registerPlugin<NativeProtectedPlayer>('MoroProtectedPlayer');
export const hasProtectedPlayer=()=>Capacitor.isPluginAvailable('MoroProtectedPlayer');
