import {isGuestProfile,requestSignIn} from '../auth/guest';
import {catalogJson} from '../player/catalogCache';
import { apiFetch } from '../player/netshowApi';
/**
 * Catalog Context & Playback Controller
 * 
 * Manages IPTV catalog loading, tabs, search, filtering, and video stream playback requests.
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { CatalogItem, StreamTokenResponse } from '../types';
import { useProfile } from './ProfileContext';

interface ActivePlaybackSession {
  tokenResponse: StreamTokenResponse;
  catalogItem: CatalogItem;
  resumeTime?: number;
}

interface CatalogContextType {
  items: CatalogItem[];
  categories: string[];
  liveChannels: CatalogItem[];
  movies: CatalogItem[];
  series: CatalogItem[];
  activeTab: 'live' | 'home' | 'clips' | 'search' | 'downloads' | 'anime' | 'movies' | 'series' | 'favorites';
  selectedCategory: string | null;
  searchQuery: string;
  isLoading: boolean;
  catalogError: string | null;
  sourcePending: boolean;
  activePlayback: ActivePlaybackSession | null;
  playbackLoading: boolean;
  playbackError: string | null;
  pendingPlayback: CatalogItem | null;
  setPendingPlayback: (item: CatalogItem | null) => void;
  selectedSeries: CatalogItem | null;
  isSettingsOpen: boolean;
  isProfileEditOpen: boolean;
  editingProfileId: string | null;
  setActiveTab: (tab: 'live' | 'home' | 'clips' | 'search' | 'downloads' | 'anime' | 'movies' | 'series' | 'favorites') => void;
  setSelectedCategory: (cat: string | null) => void;
  setSearchQuery: (q: string) => void;
  setSelectedSeries: (series: CatalogItem | null) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsProfileEditOpen: (open: boolean) => void;
  setEditingProfileId: (id: string | null) => void;
  startPlayback: (item: CatalogItem, resumeTime?: number, variantId?: string) => Promise<void>;
  stopPlayback: () => void;
  refreshCatalog: () => Promise<void>;
  rememberSourceItems: (incoming: CatalogItem[]) => void;
  importPlaylist: (urlOrContent: { playlistUrl?: string; playlistContent?: string }) => Promise<{ success: boolean; error?: string }>;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { activeProfile } = useProfile();

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [liveChannels, setLiveChannels] = useState<CatalogItem[]>([]);
  const [movies, setMovies] = useState<CatalogItem[]>([]);
  const [series, setSeries] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [sourcePending, setSourcePending] = useState(true);

  const [activeTab, setActiveTab] = useState<'live' | 'home' | 'clips' | 'search' | 'downloads' | 'anime' | 'movies' | 'series' | 'favorites'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [activePlayback, setActivePlayback] = useState<ActivePlaybackSession | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const [pendingPlayback, setPendingPlayback] = useState<CatalogItem | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<CatalogItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const extraItems=useRef<CatalogItem[]>([]);
  const rememberSourceItems=(incoming:CatalogItem[])=>{
    incoming=incoming.filter(i=>(!activeProfile?.isKid||i.kidsVerified));
    extraItems.current=[...new Map([...extraItems.current,...incoming].map(i=>[i.id,i])).values()].slice(-2000);
    setItems(old=>[...new Map([...old,...incoming].map(i=>[i.id,i])).values()]);
    try{localStorage.setItem(`moroshow-source-items:${activeProfile?.id}`,JSON.stringify(extraItems.current));}catch{}
  };
  const currentProfile=useRef(activeProfile?.id);currentProfile.current=activeProfile?.id;
  const lastRevision=useRef<string>('');
  const playbackRequest=useRef<AbortController|null>(null);
  const refreshCatalog = async () => {
    if (!items.length) setIsLoading(true);
    try {
      if (!activeProfile) { setSourcePending(false); return; }
      const profileId=activeProfile.id,kid=activeProfile.isKid;
      // Publish each completed section immediately instead of waiting for the slowest request.
      const sections=new Map<string,CatalogItem[]>();
      const calls=await Promise.allSettled(['movie','tv'].map(async type=>{
        const data=await catalogJson(`/api/web-sources/catalog?type=${type}&profileId=${encodeURIComponent(profileId)}&kids=${kid?1:0}`,!kid);
        if(currentProfile.current!==profileId)return;
        sections.set(type,data.items);
        const vod=[...sections.values()].flat();
        const merged=[...new Map([...extraItems.current,...vod].map(i=>[i.id,i])).values()];
        setItems(merged);setCategories([...new Set(merged.map(x=>x.category))]);
        setMovies(vod.filter(x=>x.kind==='movie'));setSeries(vod.filter(x=>x.kind==='series'));
        setIsLoading(false);setSourcePending(false);
      }));
      if(currentProfile.current!==profileId)return;
      setCatalogError([...new Set(calls.flatMap(r=>r.status==='rejected'?[r.reason?.message||'Catalog could not be reached']:[]))].join(' ')||null);
      setSourcePending(false);setLiveChannels([]);

    } catch (e) {
      console.error('Failed to load catalog', e);
      setCatalogError('Cannot reach the MoroShow backend. Check your internet and server.');
    } finally {
      if(activeProfile?.id===currentProfile.current)setIsLoading(false);
    }
  };

  useEffect(() => {
    stopPlayback(); setPendingPlayback(null); setActiveTab('home'); setSearchQuery(''); setSelectedSeries(null); setItems([]); setMovies([]); setSeries([]);
    try { extraItems.current=activeProfile?.isKid?[]:JSON.parse(localStorage.getItem(`moroshow-source-items:${activeProfile?.id}`)||'[]').filter((x:CatalogItem)=>(!activeProfile?.isKid||x.isKidFriendly)); }catch{extraItems.current=[];}
    refreshCatalog();
  }, [activeProfile?.id, activeProfile?.isKid]);

  // Provider catalogs can take time to download; a first empty response must
  // not leave the app permanently blank until the user manually refreshes.
  useEffect(() => {
    if (!activeProfile || (!sourcePending && items.length)) return;
    const timer = window.setInterval(() => { if (!document.hidden) void refreshCatalog(); }, 20000);
    return () => window.clearInterval(timer);
  }, [activeProfile?.id, items.length, sourcePending]);

  const startPlayback = async (item: CatalogItem, resumeTime?: number, variantId?: string) => {
    if (!activeProfile) return;
    if(item.id.startsWith('iptv:')&&(!variantId||variantId==='vidlink'))variantId='auto';
    if(!variantId&&item.id.startsWith('drama:'))variantId='shorts';
    if(!variantId){setPlaybackError(null);setPendingPlayback(item);return;}

    playbackRequest.current?.abort();
    const controller=new AbortController();playbackRequest.current=controller;
    const timeout=window.setTimeout(()=>controller.abort(),55000);
    setPlaybackLoading(true);
    setPlaybackError(null);
    if(item.id.startsWith('drama:')){
      // Keep the requested episode visible throughout loading and on failure.
      setSelectedSeries(null);setPendingPlayback(null);
      setActivePlayback({catalogItem:item,resumeTime,tokenResponse:{success:true,token:'pending:'+controller.signal.aborted+':'+Date.now(),streamUrl:'',streamType:'hls',variantId:'shorts',content:item}});
    }

    try {
      // Request HMAC-SHA256 signed playback token from server
      const res = await apiFetch('/api/stream/token', {
        signal:controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: item.id,
          profileId: activeProfile.id,
          variantId,compatibility:variantId==='shorts-compatible'
        })
      });

      const data: StreamTokenResponse = await res.json();
      if(playbackRequest.current!==controller)return;
      if (!data.success) {
        setPlaybackError(data.error || 'Failed to authorize stream');
        return;
      }

      setPendingPlayback(null);
      setActivePlayback({
        tokenResponse: data,
        catalogItem: item,
        resumeTime
      });
    } catch (e: any) {
      if(playbackRequest.current===controller)setPlaybackError(e.name==='AbortError'?'Source took too long to respond. Choose another title or source.':e.message || 'Error connecting to streaming server');
    } finally {
      window.clearTimeout(timeout);
      if(playbackRequest.current===controller)setPlaybackLoading(false);
    }
  };

  const stopPlayback = () => {
    playbackRequest.current?.abort();playbackRequest.current=null;setPlaybackLoading(false);
    setActivePlayback(null);
    setPlaybackError(null);
  };

  const importPlaylist = async (payload: { playlistUrl?: string; playlistContent?: string }) => {
    try {
      const res = await apiFetch('/api/catalog/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        await refreshCatalog();
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  return (
    <CatalogContext.Provider
      value={{
        items: activeProfile?.isKid?items.filter(i=>i.kidsVerified):items,
        categories,
        liveChannels,
        movies: activeProfile?.isKid?movies.filter(i=>i.kidsVerified):movies,
        series: activeProfile?.isKid?series.filter(i=>i.kidsVerified):series,
        activeTab,
        selectedCategory,
        searchQuery,
        isLoading,
        catalogError,
        sourcePending,
        activePlayback,
        playbackLoading,
        playbackError,
        pendingPlayback,
        setPendingPlayback,
        selectedSeries,
        isSettingsOpen,
        isProfileEditOpen,
        editingProfileId,
        setActiveTab:(tab)=>{if(tab==='favorites'&&isGuestProfile(activeProfile?.id)){requestSignIn();return;}setActiveTab(tab);},
        setSelectedCategory,
        setSearchQuery,
        setSelectedSeries,
        setIsSettingsOpen,
        setIsProfileEditOpen,
        setEditingProfileId,
        startPlayback,
        stopPlayback,
        refreshCatalog,
        rememberSourceItems,
        importPlaylist
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = () => {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
};
