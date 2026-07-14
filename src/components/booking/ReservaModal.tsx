import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Mail, Phone, IdCard, MessageSquare, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { asignarConductorDisponible } from '../../lib/asignarConductor';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const HORARIOS_BASE = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

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
  zona: any;
  fecha: string;
  onClose: () => void;
  onSuccess: (id: string) => void;
}

export function ReservaModal({ vehiculo, zona, fecha, onClose, onSuccess }: ReservaModalProps) {
  const [horaSel, setHoraSel] = useState<string | null>(null);
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
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [intentoEnviar, setIntentoEnviar] = useState(false);

  const sedeQuery = useQuery({
    queryKey: ['sede-info', vehiculo.sede_id],
    queryFn: async () => {
      const res = await supabase.from('sedes').select('nombre, ciudad').eq('id', vehiculo.sede_id).single();
      return res.data;
    },
  });

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
    queryKey: ['ocupados-dia', vehiculo.id, fecha],
    queryFn: async () => {
      const res = await supabase
        .from('reservas')
        .select('hora_inicio')
        .eq('vehiculo_id', vehiculo.id)
        .eq('fecha', fecha)
        .in('estado', ['pendiente', 'confirmada', 'en_camino', 'en_prueba']);
      return (res.data || []).map((r: any) => r.hora_inicio);
    },
  });

  const ocupados = ocupadosQuery.data || [];
  const disponibles = HORARIOS_BASE.filter((h) => !ocupados.includes(h + ':00'));

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

      const insertResult = await supabase
        .from('reservas')
        .insert({
          vehiculo_id: vehiculo.id,
          sede_id: vehiculo.sede_id,
          conductor_id: conductor ? conductor.id : null,
          zona_id: (zona.id === 'domicilio' || zona.id === 'sede') ? null : zona.id,
          cliente_nombre: nombres,
          cliente_apellido: apellidos,
          tipo_documento: tipoDocumento,
          numero_documento: numeroDocumento,
          cliente_correo: correo,
          cliente_celular: celular,
          ciudad: ciudad,
          comentario: comentario || null,
          licencia_url: licenciaUrl,
          tipo_entrega: zona.id === 'sede' ? 'concesionario' : 'domicilio',
          direccion_domicilio: zona.id !== 'sede' ? zona.nombre : null,
          fecha: fecha,
          hora_inicio: horaSel,
          hora_fin: calcularHoraFin(horaSel),
          estado: 'pendiente',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-sm max-w-5xl w-full max-h-[90vh] overflow-y-auto">

        <div className="p-5 border-b border-[#e5e5e5] flex items-center justify-between">
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

        <div className="p-6 grid md:grid-cols-2 gap-8">

          {/* Columna izquierda: horario + conductor */}
          <div>
            <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">
              Horario disponible
            </p>
            {ocupadosQuery.isLoading ? (
              <div className="flex gap-2 mb-6 flex-wrap">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-16 h-9 bg-[#e5e5e5] rounded-sm animate-pulse" />
                ))}
              </div>
            ) : disponibles.length === 0 ? (
              <p className="text-sm text-[#666] bg-[#f8f8f8] rounded-sm p-3 mb-6">
                No hay horarios disponibles este dia.
              </p>
            ) : (
              <div className="flex gap-2 flex-wrap mb-6">
                {disponibles.map((h) => {
                  const activo = horaSel === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHoraSel(h)}
                      className={
                        'px-4 py-2 text-sm font-medium rounded-sm border cursor-pointer transition-all ' +
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

            <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">
              Conductor asignado
            </p>
            {!horaSel ? (
              <p className="text-sm text-[#666] mb-6">
                Selecciona un horario para ver que conductor te acompañara.
              </p>
            ) : conductorQuery.isLoading ? (
              <div className="h-16 bg-[#f8f8f8] rounded-sm animate-pulse mb-6" />
            ) : conductor ? (
              <div className="flex items-center gap-3 bg-[#f8f8f8] rounded-sm p-4 mb-6">
                <img
                  src={conductor.foto_url || fotoConductor(conductor.nombre)}
                  alt={conductor.nombre}
                  className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                />
                <div>
                  <p className="font-semibold text-sm text-[#051620]">{conductor.nombre}</p>
                  <p className="text-xs text-[#666]">{conductor.cargo}</p>
                  <p className="text-xs text-[#666]">{sede ? sede.nombre : ''}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#666] mb-6">
                Todos nuestros expertos de esta sede estan ocupados en ese horario. Te asignaremos uno en cuanto sea posible.
              </p>
            )}

            <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">
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
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3">
                {errorMsg}
              </p>
            )}
          </div>

          {/* Columna derecha: formulario */}
          <div>
            <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">
              Tus datos
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
                    <p className="text-sm text-[#666]">Sube tu licencia de conducir</p>
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
                  Autorizo a Distrikia el manejo de mis datos personales de acuerdo con las politicas de tratamiento de informacion.
                </span>
              </label>
            </div>

            <Button
              onClick={confirmar}
              variant="primary"
              size="lg"
              loading={enviando}
              disabled={enviando}
              className="w-full"
            >
              Confirmar reserva
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}