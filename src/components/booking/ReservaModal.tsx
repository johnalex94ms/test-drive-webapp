import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Mail, Phone, IdCard, MessageSquare, Upload, X, UserRound } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { asignarConductorDisponible } from '../../lib/asignarConductor';
import { asignarVehiculoDisponible, vehiculosDisponiblesEseDia } from '../../lib/asignarVehiculo';
import type { DiaPicoPlaca } from '../../lib/picoPlaca';
import type { VehiculoBloqueo } from '../../lib/vehiculosBloqueos';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { obtenerHorariosDelDia } from '../../lib/horarios';

const TIPOS_DOCUMENTO = [
  { value: 'CC', label: 'Cedula de ciudadania' },
  { value: 'CE', label: 'Cedula de extranjeria' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'PA', label: 'Pasaporte' },
];

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;

function fotoConductor(nombre: string) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  }
  const indice = Math.abs(hash % 70) + 1;
  return 'https://i.pravatar.cc/200?img=' + indice;
}

interface ReservaModalProps {
  vehiculo: any;
  vehiculosPool?: any[];
  vehiculosSede?: any[];
  zona: any;
  fecha: string;
  onClose: () => void;
  onSuccess: (id: string) => void;
  variant?: 'modal' | 'panel';
}

export function ReservaModal({ vehiculo, vehiculosPool, vehiculosSede, zona, fecha, onClose, onSuccess, variant = 'modal' }: ReservaModalProps) {
  const [horaSel, setHoraSel] = useState<string | null>(null);
  const [conducidoPorAsesor, setConducidoPorAsesor] = useState(false);
  const [asesorId, setAsesorId] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('CC');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [correo, setCorreo] = useState('');
  const [celular, setCelular] = useState('');
  const [comentario, setComentario] = useState('');
  const [licenciaFile, setLicenciaFile] = useState<File | null>(null);
  const [licenciaPreview, setLicenciaPreview] = useState<string | null>(null);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [facturaMismaPersona, setFacturaMismaPersona] = useState(false);
  const [facturaNombre, setFacturaNombre] = useState('');
  const [facturaDocumento, setFacturaDocumento] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [intentoEnviar, setIntentoEnviar] = useState(false);

  useEffect(() => {
    if (!facturaMismaPersona) return;
    setFacturaNombre((nombres + ' ' + apellidos).trim());
    setFacturaDocumento(numeroDocumento);
  }, [facturaMismaPersona, nombres, apellidos, numeroDocumento]);

  const datosClienteCompletos = !!(nombres.trim() && apellidos.trim() && numeroDocumento.trim());

  const sedeQuery = useQuery({
    queryKey: ['sede-info', vehiculo.sede_id],
    queryFn: async () => {
      const res = await supabase.from('sedes').select('nombre, ciudad').eq('id', vehiculo.sede_id).single();
      return res.data;
    },
  });

  const asesoresQuery = useQuery({
    queryKey: ['asesores-sede', vehiculo.sede_id],
    queryFn: async () => {
      const res = await supabase
        .from('asesores')
        .select('*')
        .eq('sede_id', vehiculo.sede_id)
        .eq('activo', true)
        .order('nombre');
      return res.data || [];
    },
  });

  const asesores = asesoresQuery.data || [];

  const pool = vehiculosPool && vehiculosPool.length > 0 ? vehiculosPool : [vehiculo];
  const poolSede = vehiculosSede && vehiculosSede.length > 0 ? vehiculosSede : pool;

  const picoPlacaConfigQuery = useQuery({
    queryKey: ['pico-placa-config'],
    queryFn: async () => {
      const res = await supabase.from('pico_placa_config').select('*').order('dia_semana');
      return (res.data || []) as DiaPicoPlaca[];
    },
  });

  const poolSedeIds = poolSede.map((v: any) => v.id);
  const vehiculosBloqueadosQuery = useQuery({
    queryKey: ['vehiculos-bloqueos-reserva', poolSedeIds.slice().sort().join(','), fecha],
    enabled: poolSedeIds.length > 0,
    queryFn: async () => {
      const res = await supabase
        .from('vehiculos_bloqueos')
        .select('*')
        .in('vehiculo_id', poolSedeIds)
        .lte('fecha_inicio', fecha)
        .gte('fecha_fin', fecha);
      return (res.data || []) as VehiculoBloqueo[];
    },
  });
  const vehiculosBloqueados = vehiculosBloqueadosQuery.data || [];

  // Disponibilidad de horas: es la misma para toda la sede, sin importar el modelo elegido
  const poolSedeDelDia = vehiculosDisponiblesEseDia(poolSede, fecha, picoPlacaConfigQuery.data || [], vehiculosBloqueados);
  const poolSedeDelDiaIds = poolSedeDelDia.map((v: any) => v.id);

  // Asignacion final del vehiculo especifico: debe ser del MISMO modelo elegido
  const poolModeloDelDia = vehiculosDisponiblesEseDia(pool, fecha, picoPlacaConfigQuery.data || [], vehiculosBloqueados);
  const sinUnidadesDelModelo = !picoPlacaConfigQuery.isLoading && !vehiculosBloqueadosQuery.isLoading && poolModeloDelDia.length === 0;

  const conductorQuery = useQuery({
    queryKey: ['conductor-disponible', vehiculo.sede_id, fecha, horaSel],
    enabled: !!horaSel,
    queryFn: async () => {
      const conductorId = await asignarConductorDisponible(vehiculo.sede_id, fecha, horaSel!);
      if (!conductorId) return null;
      const res = await supabase.from('conductores').select('*').eq('id', conductorId).single();
      return res.data;
    },
  });

  const ocupadosQuery = useQuery({
    queryKey: ['ocupados-dia', poolSedeDelDiaIds.slice().sort().join(','), fecha],
    enabled: poolSedeDelDiaIds.length > 0,
    queryFn: async () => {
      const res = await supabase
        .from('reservas')
        .select('hora_inicio, vehiculo_id')
        .in('vehiculo_id', poolSedeDelDiaIds)
        .eq('fecha', fecha)
        .in('estado', ['confirmada', 'en_camino', 'en_prueba']);
      return res.data || [];
    },
  });

  const queryClient = useQueryClient();
  const poolSedeDelDiaKey = poolSedeDelDiaIds.slice().sort().join(',');

  useEffect(() => {
    if (poolSedeDelDiaIds.length === 0) return;

    const canal = supabase
      .channel('reserva-modal-' + poolSedeDelDiaKey + '-' + fecha)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        (payload: any) => {
          const idAfectado = (payload.new && payload.new.vehiculo_id) || (payload.old && payload.old.vehiculo_id);
          if (idAfectado && !poolSedeDelDiaIds.includes(idAfectado)) return;
          queryClient.invalidateQueries({ queryKey: ['ocupados-dia'] });
          queryClient.invalidateQueries({ queryKey: ['conductor-disponible'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [poolSedeDelDiaKey, fecha, queryClient]);

  const ocupados = ocupadosQuery.data || [];
  const conteoPorHora: Record<string, number> = {};
  ocupados.forEach((r: any) => {
    const h = r.hora_inicio.slice(0, 5);
    conteoPorHora[h] = (conteoPorHora[h] || 0) + 1;
  });
  const horariosDelDia = obtenerHorariosDelDia(fecha);
  const disponibles = poolSedeDelDiaIds.length === 0
    ? []
    : horariosDelDia.filter((h) => (conteoPorHora[h] || 0) < poolSedeDelDiaIds.length);

  const sede = sedeQuery.data;
  const ciudad = (zona && zona.municipio) || (sede && sede.ciudad) || '';

  function handleLicencia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setLicenciaFile(file);
    const reader = new FileReader();
    reader.onload = () => setLicenciaPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function calcularHoraFin(hora: string) {
    const partes = hora.split(':');
    const h = parseInt(partes[0], 10) + 1;
    return (h < 10 ? '0' + h : '' + h) + ':00';
  }

  function handleNumeroDocumento(valor: string) {
    const soloNumeros = valor.replace(/\D/g, '').slice(0, 12);
    setNumeroDocumento(soloNumeros);
  }

  function handleCelular(valor: string) {
    const soloNumeros = valor.replace(/\D/g, '').slice(0, 10);
    setCelular(soloNumeros);
  }

  const errorDocumento = intentoEnviar
    ? (!numeroDocumento
      ? 'Requerido'
      : numeroDocumento.length < 6
        ? 'Minimo 6 numeros'
        : undefined)
    : undefined;

  const errorCorreo = intentoEnviar
    ? (!correo
      ? 'Requerido'
      : !REGEX_CORREO.test(correo)
        ? 'Correo invalido'
        : undefined)
    : undefined;

  const errorCelular = intentoEnviar
    ? (!celular
      ? 'Requerido'
      : celular.length !== 10
        ? 'Debe tener 10 numeros'
        : undefined)
    : undefined;

  async function confirmar() {
    setIntentoEnviar(true);

    if (!horaSel) {
      setErrorMsg('Selecciona un horario disponible.');
      return;
    }
    if (!asesorId) {
      setErrorMsg('Selecciona el asesor encargado de la prueba.');
      return;
    }
    if (!conductorQuery.data && !conducidoPorAsesor) {
      setErrorMsg('No hay conductor disponible a esa hora. Marca la casilla para hacer tu la prueba de ruta.');
      return;
    }
    if (!nombres || !apellidos || !numeroDocumento || !correo || !celular) {
      setErrorMsg('Faltan campos por completar, revisa los marcados en rojo.');
      return;
    }
    if (numeroDocumento.length < 6 || numeroDocumento.length > 12) {
      setErrorMsg('El numero de documento debe tener entre 6 y 12 numeros.');
      return;
    }
    if (!REGEX_CORREO.test(correo)) {
      setErrorMsg('Ingresa un correo electronico valido.');
      return;
    }
    if (celular.length !== 10) {
      setErrorMsg('El celular debe tener 10 numeros.');
      return;
    }
    if (!aceptaTerminos) {
      setErrorMsg('Debes aceptar las politicas de tratamiento de datos.');
      return;
    }

    setEnviando(true);
    setErrorMsg(null);

    try {
      let licenciaUrl: string | null = null;
      if (licenciaFile) {
        const ext = licenciaFile.name.split('.').pop();
        const path = 'licencias/' + Date.now() + '.' + ext;
        const uploadResult = await supabase.storage.from('licencias').upload(path, licenciaFile);
        if (!uploadResult.error) {
          const publicUrlData = supabase.storage.from('licencias').getPublicUrl(path);
          licenciaUrl = publicUrlData.data.publicUrl;
        }
      }

      const conductor = conductorQuery.data;

      if (poolModeloDelDia.length === 0) {
        setErrorMsg('Ese dia no hay ningun KIA ' + vehiculo.modelo + ' disponible (pico y placa u otra restriccion). Elige otro dia o cambia de vehiculo.');
        setEnviando(false);
        return;
      }

      const vehiculoAsignadoId = await asignarVehiculoDisponible(poolModeloDelDia, fecha, horaSel + ':00');
      if (!vehiculoAsignadoId) {
        setErrorMsg('Ese horario ya fue reservado para este modelo. Elige otro horario.');
        setEnviando(false);
        return;
      }

      const insertResult = await supabase
        .from('reservas')
        .insert({
          vehiculo_id: vehiculoAsignadoId,
          sede_id: vehiculo.sede_id,
          asesor_id: asesorId,
          conductor_id: conductor ? conductor.id : null,
          conducido_por_asesor: !conductor && conducidoPorAsesor,
          zona_id: (zona.id === 'domicilio' || zona.id === 'sede') ? null : zona.id,
          cliente_nombre: nombres,
          cliente_apellido: apellidos,
          tipo_documento: tipoDocumento,
          numero_documento: numeroDocumento,
          cliente_correo: correo,
          cliente_celular: celular,
          factura_nombre: facturaNombre || null,
          factura_documento: facturaDocumento || null,
          ciudad: ciudad,
          comentario: comentario || null,
          licencia_url: licenciaUrl,
          tipo_entrega: zona.id === 'sede' ? 'concesionario' : 'domicilio',
          direccion_domicilio: zona.id !== 'sede' ? zona.nombre : null,
          fecha: fecha,
          hora_inicio: horaSel,
          hora_fin: calcularHoraFin(horaSel),
          estado: 'confirmada',
        })
        .select()
        .single();

      if (insertResult.error) throw insertResult.error;

      onSuccess(insertResult.data.id);
    } catch (err: any) {
      if (err && err.code === '23505') {
        setErrorMsg('Ese horario ya fue reservado. Elige otro.');
      } else {
        setErrorMsg('Ocurrio un error al agendar. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  }

  const conductor = conductorQuery.data;

  const encabezado = (
    <div className="px-5 py-3 border-b border-[#e5e5e5] flex items-center justify-between flex-shrink-0">
      <div>
        <p className="text-xs text-[#666]">KIA {vehiculo.modelo}</p>
        <p className="font-display text-xl font-bold text-[#051620]">{fecha}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-[#666] hover:text-[#051620] cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );

  const pie = (
    <div className="px-6 py-4 border-t border-[#e5e5e5] flex-shrink-0">
      <Button
        onClick={confirmar}
        variant="primary"
        size="lg"
        loading={enviando}
        disabled={enviando || sinUnidadesDelModelo}
        className="w-full"
      >
        Confirmar reserva
      </Button>
    </div>
  );

  const cuerpo = (
    <div className={variant === 'panel' ? 'p-6 flex flex-col gap-0' : 'p-6 grid md:grid-cols-2 gap-8'}>

      {/* Columna izquierda: horario + conductor + ubicacion */}
      <div>
        <div className="flex flex-col gap-4 mb-2">
          <div className="flex flex-col">
            <p className="text-xs font-semibold text-[#051620]/70 uppercase tracking-widest mb-2">
              Horario
            </p>
            {ocupadosQuery.isLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-9 bg-[#e5e5e5] rounded-sm animate-pulse" />
                ))}
              </div>
            ) : disponibles.length === 0 ? (
              <p className="text-sm text-[#666] bg-[#f8f8f8] rounded-sm p-3">
                Sin horarios este dia.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {disponibles.map((h) => {
                  const activo = horaSel === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => { setHoraSel(h); setConducidoPorAsesor(false); }}
                      className={
                        'px-3 py-2 text-sm font-medium rounded-sm border cursor-pointer transition-all ' +
                        (activo
                          ? 'bg-[#051620] text-white border-[#051620]'
                          : 'bg-white border-[#e5e5e5] text-[#051620] hover:border-[#051620]')
                      }
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <p className="text-xs font-semibold text-[#051620]/70 uppercase tracking-widest mb-2">
              Conductor asignado
            </p>
            <div className="flex flex-col">
              {!horaSel ? (
                <p className="text-sm text-[#666]">
                  Selecciona un horario.
                </p>
              ) : conductorQuery.isLoading ? (
                <div className="h-16 bg-[#f8f8f8] rounded-sm animate-pulse" />
              ) : conductor ? (
                <div className="flex items-center gap-2.5 bg-[#f8f8f8] rounded-sm p-3 h-full">
                  <img
                    src={conductor.foto_url || fotoConductor(conductor.nombre)}
                    alt={conductor.nombre}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-[#051620] truncate">{conductor.nombre}</p>
                    <p className="text-xs text-[#666] truncate">{conductor.cargo}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-100 rounded-sm p-3">
                  <p className="text-xs text-amber-800 mb-2">
                    Todos los expertos estan ocupados en ese horario.
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conducidoPorAsesor}
                      onChange={(e) => setConducidoPorAsesor(e.target.checked)}
                      className="mt-0.5 cursor-pointer"
                    />
                    <span className="text-xs text-amber-900 font-medium">
                      Esta prueba de ruta sera realizada por ti como asesor comercial y quedara asignada a ti.
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs font-semibold text-[#051620]/70 uppercase tracking-widest mb-2">
          Ubicacion de la prueba
        </p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#f8f8f8] rounded-sm p-3">
            <p className="text-xs text-[#666]">Ciudad</p>
            <p className="text-sm font-medium text-[#051620]">{ciudad || '—'}</p>
          </div>
          <div className="bg-[#f8f8f8] rounded-sm p-3">
            <p className="text-xs text-[#666]">Concesionario</p>
            <p className="text-sm font-medium text-[#051620]">{sede ? sede.nombre : '—'}</p>
          </div>
        </div>

        {errorMsg && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3 mb-6">
            {errorMsg}
          </p>
        )}
      </div>

      {/* Columna derecha: asesor + formulario */}
      <div>
        <p className="text-xs font-semibold text-[#051620]/70 uppercase tracking-widest mb-2">
          Asesor encargado
        </p>
        <div className="relative mb-4">
          <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none" />
          <select
            value={asesorId}
            onChange={(e) => setAsesorId(e.target.value)}
            className="w-full pl-10 pr-10 py-3 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
              backgroundPosition: 'right 14px center',
            }}
          >
            <option value="">
              {asesoresQuery.isLoading ? 'Cargando asesores...' : 'Selecciona el asesor'}
            </option>
            {asesores.map((a: any) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
          {intentoEnviar && !asesorId && (
            <p className="text-xs text-red-600 mt-1">Requerido</p>
          )}
          {!asesoresQuery.isLoading && asesores.length === 0 && (
            <p className="text-xs text-amber-700 mt-1">
              No hay asesores activos en esta sede. Agrega uno en el panel admin.
            </p>
          )}
        </div>

        <p className="text-xs font-semibold text-[#051620]/70 uppercase tracking-widest mb-2">
          Datos de tu cliente
        </p>
        <div className="flex flex-col gap-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              icon={User}
              placeholder="Nombres"
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              error={intentoEnviar && !nombres ? 'Requerido' : undefined}
            />
            <Input
              icon={User}
              placeholder="Apellidos"
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              error={intentoEnviar && !apellidos ? 'Requerido' : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value)}
              className="w-full pl-4 pr-10 py-3 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
              style={{
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                backgroundPosition: 'right 14px center',
              }}
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <Input
              icon={IdCard}
              placeholder="Numero de documento"
              inputMode="numeric"
              value={numeroDocumento}
              onChange={(e) => handleNumeroDocumento(e.target.value)}
              error={errorDocumento}
            />
          </div>

          <Input
            icon={Mail}
            placeholder="Correo electronico"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            error={errorCorreo}
          />
          <Input
            icon={Phone}
            placeholder="Celular"
            inputMode="numeric"
            value={celular}
            onChange={(e) => handleCelular(e.target.value)}
            error={errorCelular}
          />

          <div className="relative">
            <MessageSquare className="absolute left-3.5 top-3.5 w-4 h-4 text-[#999]" />
            <textarea
              placeholder="Comentario (opcional)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              className="w-full pl-10 pr-4 py-3 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] placeholder:text-[#aaa] focus:border-[#051620] focus:ring-2 focus:ring-[#051620]/20 resize-none transition-colors"
            />
          </div>

          <label
            htmlFor="licencia-modal"
            className="border border-dashed border-[#e5e5e5] rounded-sm p-4 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[#051620] transition-colors bg-[#f8f8f8]"
          >
            {licenciaPreview ? (
              <img src={licenciaPreview} alt="Licencia" className="h-20 object-contain rounded" />
            ) : (
              <div className="text-center flex flex-col items-center gap-1.5">
                <Upload className="w-5 h-5 text-[#999]" />
                <p className="text-sm text-[#666]">Sube la licencia de conducir de tu cliente</p>
                <p className="text-xs text-[#aaa]">JPG, PNG, maximo 5MB</p>
              </div>
            )}
          </label>
          <input
            id="licencia-modal"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLicencia}
          />

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              className="mt-0.5 cursor-pointer"
            />
            <span className="text-xs text-[#666]">
              Tu cliente autoriza a Distrikia el manejo de sus datos personales de acuerdo con las politicas de tratamiento de informacion.
            </span>
          </label>
        </div>

        {datosClienteCompletos && (
          <div className="mt-10">
            <p className="text-xs font-semibold text-[#051620]/70 uppercase tracking-widest mb-1">
              Datos de facturacion
            </p>
            <p className="text-xs text-[#999] mb-3">
              Estos datos corresponden a quien se le va a realizar la factura del vehiculo.
            </p>

            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={facturaMismaPersona}
                onChange={(e) => {
                  setFacturaMismaPersona(e.target.checked);
                  if (!e.target.checked) {
                    setFacturaNombre('');
                    setFacturaDocumento('');
                  }
                }}
                className="cursor-pointer"
              />
              <span className="text-xs text-[#666]">
                Es la misma persona que realiza el test drive
              </span>
            </label>

            <div className="flex flex-col gap-3">
              <Input
                icon={User}
                placeholder="Nombre completo"
                value={facturaNombre}
                onChange={(e) => setFacturaNombre(e.target.value)}
                disabled={facturaMismaPersona}
              />
              <Input
                icon={IdCard}
                placeholder="Cedula"
                inputMode="numeric"
                value={facturaDocumento}
                onChange={(e) => setFacturaDocumento(e.target.value)}
                disabled={facturaMismaPersona}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );

  const overlaySinUnidades = sinUnidadesDelModelo && (
    <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-[1px] flex items-center justify-center p-6">
      <div className="text-center max-w-xs">
        <p className="font-display text-base font-bold text-[#051620] mb-1">
          No hay vehiculos disponibles
        </p>
        <p className="text-sm text-[#666]">
          La unica unidad de KIA {vehiculo.modelo} en esta sede esta en pico y placa (u otra restriccion) ese dia. Elige otro dia o cambia de vehiculo.
        </p>
      </div>
    </div>
  );

  if (variant === 'panel') {
    return (
      <div className="h-full flex flex-col">
        {encabezado}
        <div className="relative flex-1 min-h-0">
          <div className="h-full overflow-y-auto scroll-fino">
            <div className={sinUnidadesDelModelo ? 'pointer-events-none select-none' : ''}>
              {cuerpo}
            </div>
          </div>
          {overlaySinUnidades}
        </div>
        {pie}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-sm max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {encabezado}
        <div className="relative flex-1 min-h-0">
          <div className="h-full overflow-y-auto scroll-fino">
            <div className={sinUnidadesDelModelo ? 'pointer-events-none select-none' : ''}>
              {cuerpo}
            </div>
          </div>
          {overlaySinUnidades}
        </div>
        {pie}
      </div>
    </div>
  );
}