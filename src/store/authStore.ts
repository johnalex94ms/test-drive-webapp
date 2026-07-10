import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

interface AuthStore {
    user: User | null;
    cargando: boolean;
    setUser: (user: User | null) => void;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    cargando: true,
    setUser: (user) => set({ user, cargando: false }),
    logout: async () => {
        await supabase.auth.signOut();
        set({ user: null });
    },
}));