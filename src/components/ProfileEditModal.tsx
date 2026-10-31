import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useCatalog } from '../context/CatalogContext';
import { AVATAR_OPTIONS, Profile } from '../types';
import { X, Trash2, Check, Sparkles, Lock, ShieldCheck } from 'lucide-react';

export const ProfileEditModal: React.FC = () => {
  const { profiles, createProfile, updateProfile, deleteProfile } = useProfile();
  const { isProfileEditOpen, setIsProfileEditOpen, editingProfileId, setEditingProfileId } = useCatalog();

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0].id);
  const [isKid, setIsKid] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(editingProfileId);
  const targetProfile: Profile | undefined = profiles.find(p => p.id === editingProfileId);

  useEffect(() => {
    if (targetProfile) {
      setName(targetProfile.name);
      setAvatar(targetProfile.avatar);
      setIsKid(targetProfile.isKid);
      setPin('');
    } else {
      setName('');
      setAvatar(AVATAR_OPTIONS[0].id);
      setIsKid(false);
      setPin('');
    }
    setError(null);
  }, [editingProfileId, targetProfile, isProfileEditOpen]);

  if (!isProfileEditOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a profile name');
      return;
    }

    if (pin && pin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (isEditing && editingProfileId) {
      const ok = await updateProfile(editingProfileId, {
        name: name.trim(),
        avatar,
        isKid,
        pin: pin || (targetProfile?.hasPin ? undefined : null)
      });
      if (ok) {
        setIsProfileEditOpen(false);
      } else {
        setError('Failed to update profile');
      }
    } else {
      const ok = await createProfile({
        name: name.trim(),
        avatar,
        isKid,
        pin: pin || undefined
      });
      if (ok) {
        setIsProfileEditOpen(false);
      } else {
        setError('Failed to create profile');
      }
    }
  };

  const handleDelete = async () => {
    if (!editingProfileId) return;
    if (profiles.length <= 1) {
      setError('Cannot delete the only profile');
      return;
    }
    const ok = await deleteProfile(editingProfileId);
    if (ok) {
      setIsProfileEditOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        <button
          type="button"
          aria-label="Close edit profile"
          onClick={() => setIsProfileEditOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-white mb-1">
          {isEditing ? 'Edit Profile' : 'Add New Profile'}
        </h3>
        <p className="text-xs text-neutral-400 mb-6">
          Customize avatar, kid restrictions, and access PIN.
        </p>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-950/70 border border-red-800 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar Grid Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
              Select Avatar
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {AVATAR_OPTIONS.map((opt) => {
                const isSelected = avatar === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAvatar(opt.id)}
                    aria-label={opt.label}
                    aria-pressed={isSelected}
                    className={`h-16 rounded-2xl overflow-hidden ${opt.bgColor} flex items-center justify-center text-2xl transition-all relative ${
                      isSelected ? 'ring-4 ring-white scale-105 shadow-xl' : 'opacity-80 hover:opacity-100 hover:scale-102'
                    }`}
                  >
                    <img src={opt.image} alt={opt.label} loading="lazy" className="m-profile-image"/>
                    {isSelected && (
                      <div className="absolute top-1 right-1 p-0.5 rounded-full bg-white text-neutral-950">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profile Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
              Profile Name
            </label>
            <input
              type="text"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Kids Mode Toggle */}
          <div className="p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Kids Profile</p>
                <p className="text-[11px] text-neutral-400">Restricts to children & family friendly feeds</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isKid}
                onChange={(e) => setIsKid(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* PIN Lock (Optional) */}
          <div className="p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                {targetProfile?.hasPin ? 'Update 4-Digit PIN' : 'Add 4-Digit Lock PIN (Optional)'}
              </span>
            </div>
            <input
              type="password"
              maxLength={4}
              placeholder={targetProfile?.hasPin ? '•••• (Leave blank to keep)' : '4 digits (e.g. 1234)'}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-500 tracking-widest text-center"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            {isEditing && profiles.length > 1 && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2.5 rounded-xl bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-400 transition-colors"
                title="Delete Profile"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsProfileEditOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg"
              >
                {isEditing ? 'Save Changes' : 'Create Profile'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
