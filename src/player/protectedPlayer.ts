import {Capacitor,registerPlugin} from '@capacitor/core';
export type ProtectedSource={label:string;url:string};
interface NativeProtectedPlayer{open(options:{title:string;sources:ProtectedSource[];selected:number;blockedHosts:string[];protectionEnabled:boolean}):Promise<{closed:boolean;currentTime?:number;duration?:number}>;close():Promise<void>;}
export const ProtectedPlayer=registerPlugin<NativeProtectedPlayer>('MoroProtectedPlayer');
export const hasProtectedPlayer=()=>Capacitor.isPluginAvailable('MoroProtectedPlayer');
