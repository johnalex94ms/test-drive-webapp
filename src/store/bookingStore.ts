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
    modelo: string | null;
    vehiculo: Vehiculo | null;
    vehiculosPool: Vehiculo[];
    sedeSeleccionada: any | null;
    zona: Zona | null;
    slot: SlotDisponible | null;
    cliente: ClienteData;
    panelReservaAbierto: boolean;

    setPaso: (paso: 1 | 2 | 3 | 4) => void;
    setPanelReservaAbierto: (abierto: boolean) => void;
    setModelo: (m: string | null) => void;
    setVehiculo: (v: Vehiculo | null) => void;
    setVehiculosPool: (v: Vehiculo[]) => void;
    setSedeSeleccionada: (s: any | null) => void;
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
    modelo: null,
    vehiculo: null,
    vehiculosPool: [],
    sedeSeleccionada: null,
    zona: null,
    slot: null,
    cliente: clienteInicial,
    panelReservaAbierto: false,

    setPaso: (paso) => set({ paso }),
    setPanelReservaAbierto: (panelReservaAbierto) => set({ panelReservaAbierto }),
    setModelo: (modelo) => set({ modelo, vehiculo: null, vehiculosPool: [], sedeSeleccionada: null, zona: null, slot: null }),
    setVehiculo: (vehiculo) => set({ vehiculo, zona: null, slot: null }),
    setVehiculosPool: (vehiculosPool) => set({ vehiculosPool }),
    setSedeSeleccionada: (sedeSeleccionada) => set({ sedeSeleccionada, zona: null, slot: null }),
    setZona: (zona) => set({ zona, slot: null }),
    setSlot: (slot) => set({ slot }),
    setCliente: (c) => set((s) => ({ cliente: { ...s.cliente, ...c } })),
    resetBooking: () => set({ paso: 1, modelo: null, vehiculo: null, vehiculosPool: [], sedeSeleccionada: null, zona: null, slot: null, cliente: clienteInicial }),
}));