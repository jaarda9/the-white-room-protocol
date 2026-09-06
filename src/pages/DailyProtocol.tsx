import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { SoloDailyQuestWindow } from '@/components/SoloDailyQuestWindow';
import { getUserProfile } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';

export default function DailyProtocol() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());

  useEffect(() => {
    const sync = () => setProfile(getUserProfile());
    window.addEventListener('wrp:profile-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('wrp:profile-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 flex flex-col items-center justify-center">
        <SoloDailyQuestWindow
          profile={profile}
          onProfileUpdated={(updated) => setProfile(updated)}
          onReturnToStatus={() => {
            systemSound.playClick();
            navigate('/');
          }}
        />
      </main>
    </div>
  );
}
