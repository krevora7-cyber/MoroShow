import React from 'react';
import { useProfile } from '../context/ProfileContext';
import { useCatalog } from '../context/CatalogContext';
import { AVATAR_OPTIONS, Profile } from '../types';
import { Lock, Plus, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';

export const WhoIsWatching: React.FC = () => {
  const { profiles, selectProfile, activeProfile, setIsWhoIsWatchingOpen } = useProfile();
  const { setIsProfileEditOpen, setEditingProfileId } = useCatalog();

  const getAvatarInfo = (avatarId: string) => {
    return AVATAR_OPTIONS.find(a => a.id === avatarId) || AVATAR_OPTIONS[0];
  };

  const handleCreateNew = () => {
    setEditingProfileId(null);
    setIsProfileEditOpen(true);
  };

  const handleEditProfile = (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    setEditingProfileId(profileId);
    setIsProfileEditOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 backdrop-blur-xl p-4 overflow-y-auto">
      <div className="w-full max-w-4xl text-center py-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-8"><span className="moroshow-wordmark">MOROSHOW</span></div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/50 border border-red-500/30 text-red-400 text-xs font-semibold uppercase tracking-wider mb-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          Secure Family Profiles
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
          Who's Watching?
        </h1>
        <p className="text-neutral-400 text-sm md:text-base max-w-md mx-auto mb-10">
          Select your profile to access your movies, series, and saved titles.
        </p>

        {/* Profile Grid */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 mb-12">
          {profiles.map((profile) => {
            const avatar = getAvatarInfo(profile.avatar);
            const isCurrent = activeProfile?.id === profile.id;

            return (
              <div
                key={profile.id}
                role="button"
                tabIndex={0}
                onClick={() => selectProfile(profile)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectProfile(profile); }}
                className="group relative flex flex-col items-center cursor-pointer focus:outline-none motion-reduce:transition-none"
              >
                {/* Avatar Box */}
                <div
                  className={`w-28 h-28 md:w-36 md:h-36 rounded-2xl ${avatar.bgColor} flex items-center justify-center shadow-2xl transition-all duration-500 ease-out transform group-hover:-translate-y-2 group-hover:scale-105 group-hover:ring-4 group-hover:ring-red-500/70 group-focus:ring-4 group-focus:ring-red-500 relative overflow-hidden motion-reduce:transition-none`}
                >
                  <span className="w-full h-full select-none transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none">
                    <img src={avatar.image} alt="" className="m-profile-image"/>
                  </span>

                  {/* Kids Badge */}
                  {profile.isKid && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-500 text-neutral-950 text-[10px] font-black uppercase tracking-wider shadow">
                      Kids
                    </div>
                  )}

                  {/* PIN Lock Badge */}
                  {profile.hasPin && (
                    <div className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-amber-400 border border-amber-400/30 shadow">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {/* Active Indicator */}
                  {isCurrent && (
                    <div className="absolute top-2 left-2 p-1 rounded-full bg-red-600 text-white shadow">
                      <UserCheck className="w-3 h-3" />
                    </div>
                  )}
                </div>

                {/* Profile Name */}
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="text-neutral-300 font-medium text-base md:text-lg group-hover:text-white transition-colors">
                    {profile.name}
                  </span>
                  {profile.hasPin && <Lock className="w-3.5 h-3.5 text-neutral-500" />}
                </div>

                {/* Edit small button */}
                <button
                  type="button"
                  aria-label={`Edit ${profile.name}`}
                  onClick={(e) => handleEditProfile(e, profile.id)}
                  className="mt-1 text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2 opacity-100 transition-opacity"
                >
                  Edit
                </button>
              </div>
            );
          })}

          {/* Add Profile Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleCreateNew}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCreateNew(); }}
            className="group flex flex-col items-center cursor-pointer focus:outline-none"
          >
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl border-2 border-dashed border-neutral-700 hover:border-neutral-400 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:bg-neutral-900/40">
              <Plus className="w-10 h-10 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
            </div>
            <span className="mt-3 text-neutral-400 font-medium text-base md:text-lg group-hover:text-white transition-colors">
              Add Profile
            </span>
            <span className="text-xs text-transparent select-none mt-1">.</span>
          </div>
        </div>

        {/* Dismiss / Close if active profile already exists */}
        {activeProfile && (
          <button
            type="button"
            onClick={() => setIsWhoIsWatchingOpen(false)}
            className="px-6 py-2.5 rounded-lg border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white font-medium text-sm transition-all"
          >
            Cancel & Return to {activeProfile.name}
          </button>
        )}
      </div>
    </div>
  );
};
