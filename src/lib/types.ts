export type CategoriaVehiculo = 'automovil' | 'hibrido' | 'electrico' | 'camioneta';

export interface Vehiculo {
    id: string;
    modelo: string;
    precio_desde: number;
    categoria: CategoriaVehiculo;
    foto_url: string | null;
    placa: string;
    activo: boolean;
    sede_id: string;
}

export interface Sede {
    id: string;
    nombre: string;
    direccion: string;
    ciudad: string;
    activa: boolean;
    hora_apertura: string;
    hora_cierre: string;
    intervalo_minutos: number;
    dias_operacion: number[];
    permite_domicilio: boolean;
}

export interface Zona {
    id: string;
    nombre: string;
    municipio: string;
    tiene_cobertura: boolean;
    sede_id: string;
}

export interface Conductor {
    id: string;
    nombre: string;
    correo: string;
    foto_url: string | null;
    activo: boolean;
}

export type EstadoReserva =
    | 'confirmada'
    | 'experto_asignado'
    | 'en_camino'
    | 'en_prueba'
    | 'finalizada'
    | 'cancelada';

export type TipoEntrega = 'concesionario' | 'domicilio';

export interface Reserva {
    id: string;
    sede_id: string;
    vehiculo_id: string;
    asesor_id: string | null;
    conductor_id: string | null;
    zona_id: string | null;
    cliente_nombre: string;
    cliente_correo: string;
    cliente_celular: string;
    licencia_url: string | null;
    tipo_entrega: TipoEntrega;
    direccion_domicilio: string | null;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    estado: EstadoReserva;
    token_gestion: string;
    created_at: string;
    updated_at: string;
    vehiculo?: Vehiculo;
    conductor?: Conductor | null;
    sede?: Sede;
}

export interface SlotDisponible {
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    conductor_id: string | null;
}

export interface BookingStep {
    paso: 1 | 2 | 3 | 4;
    vehiculo: Vehiculo | null;
    zona: Zona | null;
    slot: SlotDisponible | null;
    cliente: {
        nombre: string;
        correo: string;
        celular: string;
        licencia_url: string | null;
        tipo_entrega: TipoEntrega;
        direccion_domicilio: string;
    };
}