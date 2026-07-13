import { create } from 'zustand';

interface ConductorPerfil {
    id: string;
    nombre: string;
    correo: string;
    cargo: string;
    foto_url: string | null;
}

interface ConductorStore {
    perfil: ConductorPerfil | null;
    cargando: boolean;
    setPerfil: (perfil: ConductorPerfil | null) => void;
}

export const useConductorStore = create<ConductorStore>((set) => ({
    perfil: null,
    cargando: true,
    setPerfil: (perfil) => set({ perfil, cargando: false }),
}));