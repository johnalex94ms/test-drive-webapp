import { create } from 'zustand';
import type { Vehiculo, Zona, SlotDisponible, TipoEntrega } from '../lib/types';

interface ClienteData {
    nombre: string;
    correo: string;
    celular: string;
    licencia_url: string | null;
    tipo_entrega: TipoEntrega;
    direccion_domicilio: string;
}

interface BookingStore {
    paso: 1 | 2 | 3 | 4;
    vehiculo: Vehiculo | null;
    zona: Zona | null;
    slot: SlotDisponible | null;
    cliente: ClienteData;

    setPaso: (paso: 1 | 2 | 3 | 4) => void;
    setVehiculo: (v: Vehiculo | null) => void;
    setZona: (z: Zona | null) => void;
    setSlot: (s: SlotDisponible | null) => void;
    setCliente: (c: Partial<ClienteData>) => void;
    resetBooking: () => void;
}

const clienteInicial: ClienteData = {
    nombre: '',
    correo: '',
    celular: '',
    licencia_url: null,
    tipo_entrega: 'concesionario',
    direccion_domicilio: '',
};

export const useBookingStore = create<BookingStore>((set) => ({
    paso: 1,
    vehiculo: null,
    zona: null,
    slot: null,
    cliente: clienteInicial,

    setPaso: (paso) => set({ paso }),
    setVehiculo: (vehiculo) => set({ vehiculo, zona: null, slot: null }),
    setZona: (zona) => set({ zona, slot: null }),
    setSlot: (slot) => set({ slot }),
    setCliente: (c) => set((s) => ({ cliente: { ...s.cliente, ...c } })),
    resetBooking: () => set({ paso: 1, vehiculo: null, zona: null, slot: null, cliente: clienteInicial }),
}));