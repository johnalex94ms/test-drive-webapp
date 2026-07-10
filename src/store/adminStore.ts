import { create } from 'zustand';

interface AdminPerfil {
    id: string;
    nombre: string;
    correo: string;
    rol: 'super_admin' | 'admin';
    sede_id: string | null;
}

interface AdminStore {
    perfil: AdminPerfil | null;
    cargando: boolean;
    setPerfil: (perfil: AdminPerfil | null) => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
    perfil: null,
    cargando: true,
    setPerfil: (perfil) => set({ perfil, cargando: false }),
}));