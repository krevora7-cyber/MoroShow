import {previewEnabled} from './player/frontendPreview';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {lazy,Suspense} from 'react';
const PlayerLab=lazy(()=>import('./components/PlayerLab.tsx'));
import './index.css';

if(previewEnabled()){const note=document.createElement('div');note.textContent='Interface preview · playback and account services need the backend';note.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9999;padding:5px;background:#292219;color:#ffe9bb;font:11px Arial;text-align:center';document.body.appendChild(note);}
createRoot(document.getElementById('root')!).render(window.location.pathname === '/player-lab' ? <Suspense fallback={<p>Loading player…</p>}><PlayerLab /></Suspense> : <App />);
