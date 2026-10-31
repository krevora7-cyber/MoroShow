import { apiFetch } from '../player/netshowApi';
/**
 * Profile Context & State Management
 * 
 * Manages Profiles, PIN authorization flow, Watch History, and Favorites.
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Profile, WatchHistoryItem } from '../types';

interface ProfileContextType {
  profiles: Profile[];
  activeProfile: Profile | null;
  pendingProfile: Profile | null;
  isWhoIsWatchingOpen: boolean;
  isPinModalOpen: boolean;
  pinError: string | null;
  history: WatchHistoryItem[];
  favorites: string[];
  isLoading: boolean;
  connectionError: string | null;
  setIsWhoIsWatchingOpen: (open: boolean) => void;
  setIsPinModalOpen: (open: boolean) => void;
  selectProfile: (profile: Profile) => void;
  verifyPinAndSwitch: (pin: string) => Promise<{ success: boolean; error?: string }>;
  cancelPinEntry: () => void;
  refreshProfiles: () => Promise<void>;
  createProfile: (data: { name: string; avatar: string; isKid: boolean; pin?: string }) => Promise<boolean>;
  updateProfile: (id: string, data: { name?: string; avatar?: string; isKid?: boolean; pin?: string | null }) => Promise<boolean>;
  deleteProfile: (id: string) => Promise<boolean>;
  toggleFavorite: (contentId: string) => Promise<void>;
  isFavorite: (contentId: string) => boolean;
  recordHistory: (item: Partial<WatchHistoryItem> & { contentId: string; currentTime: number; duration: number }) => Promise<void>;
  refreshHistory: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
  const [isWhoIsWatchingOpen, setIsWhoIsWatchingOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError,setConnectionError]=useState<string|null>(null);

  // Fetch profiles on initial load
  const refreshProfiles = async () => {
    setConnectionError(null);
    try {
      const res = await apiFetch('/api/profiles',{signal:AbortSignal.timeout(15000)});
      if(!res.ok)throw new Error('Profile service unavailable');
      const data = await res.json();
      if (data.success && Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
        if(!data.profiles.length)throw new Error('No profiles returned');

        // Always select a family profile after launch, like Netflix.
        setIsWhoIsWatchingOpen(true);
      }
    } catch (e) {
      setConnectionError('Could not connect to the MoroShow server. Keep the Mac and tunnel running, then retry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfiles();
  }, []);

  const currentProfileId=useRef(activeProfile?.id);currentProfileId.current=activeProfile?.id;
  // Fetch history and favorites when activeProfile changes
  const refreshHistory = async () => {
    if (!activeProfile) return;
    try {
      const [histRes, favRes] = await Promise.all([
        apiFetch(`/api/profiles/${activeProfile.id}/history`),
        apiFetch(`/api/profiles/${activeProfile.id}/favorites`)
      ]);
      const histData = await histRes.json();
      const favData = await favRes.json();

      if(activeProfile.id!==currentProfileId.current)return;
      if (histData.success) setHistory(histData.history || []);
      if (favData.success) setFavorites(favData.favorites || []);
    } catch (e) {
      console.error('Failed to sync profile history/favorites', e);
    }
  };

  useEffect(() => {
    setHistory([]);setFavorites([]);
    if (activeProfile) {
      localStorage.setItem('netshow_active_profile_id', activeProfile.id);
      refreshHistory();
    }
  }, [activeProfile?.id]);

  const selectProfile = (profile: Profile) => {
    if (profile.hasPin) {
      setPendingProfile(profile);
      setPinError(null);
      setIsPinModalOpen(true);
    } else {
      setActiveProfile(profile);
      setIsWhoIsWatchingOpen(false);
    }
  };

  const verifyPinAndSwitch = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (!pendingProfile) return { success: false, error: 'No profile targeted' };

    try {
      const res = await apiFetch(`/api/profiles/${pendingProfile.id}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();

      if (data.success) {
        setActiveProfile(pendingProfile);
        setPendingProfile(null);
        setIsPinModalOpen(false);
        setIsWhoIsWatchingOpen(false);
        setPinError(null);
        return { success: true };
      } else {
        const errorMsg = data.error || 'Incorrect PIN code';
        setPinError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (e: any) {
      const err = e.message || 'Verification network error';
      setPinError(err);
      return { success: false, error: err };
    }
  };

  const cancelPinEntry = () => {
    setPendingProfile(null);
    setIsPinModalOpen(false);
    setPinError(null);
  };

  const createProfile = async (data: { name: string; avatar: string; isKid: boolean; pin?: string }) => {
    try {
      const res = await apiFetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        await refreshProfiles();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const updateProfile = async (id: string, data: { name?: string; avatar?: string; isKid?: boolean; pin?: string | null }) => {
    try {
      const res = await apiFetch(`/api/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        await refreshProfiles();
        if (activeProfile?.id === id) {
          setActiveProfile(json.profile);
        }
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      const res = await apiFetch(`/api/profiles/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        await refreshProfiles();
        if (activeProfile?.id === id) {
          setActiveProfile(null);
          setIsWhoIsWatchingOpen(true);
        }
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const toggleFavorite = async (contentId: string) => {
    if (!activeProfile) return;
    const exists = favorites.includes(contentId);
    if (exists) {
      setFavorites(prev => prev.filter(id => id !== contentId));
      await apiFetch(`/api/profiles/${activeProfile.id}/favorites/${contentId}`, { method: 'DELETE' });
    } else {
      setFavorites(prev => [...prev, contentId]);
      await apiFetch(`/api/profiles/${activeProfile.id}/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId })
      });
    }
  };

  const isFavorite = (contentId: string) => favorites.includes(contentId);

  const recordHistory = async (item: Partial<WatchHistoryItem> & { contentId: string; currentTime: number; duration: number }) => {
    if (!activeProfile) return;
    try {
      await apiFetch(`/api/profiles/${activeProfile.id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
        keepalive:true
      });
      // Update local state without waiting
      setHistory(prev => {
        const filtered = prev.filter(h => h.contentId !== item.contentId);
        const progressPercent = item.duration > 0 ? Math.min(100, Math.round((item.currentTime / item.duration) * 100)) : 0;
        return [
          {
            contentId: item.contentId,
            name: item.name || 'Media',
            streamUrl: item.streamUrl || '',
            streamType: item.streamType || 'hls',
            kind: item.kind || 'movie',
            category: item.category || 'General',
            posterUrl: item.posterUrl,
            currentTime: item.currentTime,
            duration: item.duration,
            progressPercent,
            updatedAt: Date.now()
          },
          ...filtered
        ];
      });
    } catch (e) {
      console.warn('Failed to record watch history', e);
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        pendingProfile,
        isWhoIsWatchingOpen,
        isPinModalOpen,
        pinError,
        history,
        favorites,
        isLoading,
        connectionError,
        setIsWhoIsWatchingOpen,
        setIsPinModalOpen,
        selectProfile,
        verifyPinAndSwitch,
        cancelPinEntry,
        refreshProfiles,
        createProfile,
        updateProfile,
        deleteProfile,
        toggleFavorite,
        isFavorite,
        recordHistory,
        refreshHistory
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
