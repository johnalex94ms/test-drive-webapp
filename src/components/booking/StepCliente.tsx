import { useState } from 'react';
import { useBookingStore } from '../../store/bookingStore';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function StepCliente() {
  const { vehiculo, zona, slot, cliente, setCliente, resetBooking } = useBookingStore();
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [confirmado, setConfirmado] = useState(false);
  const [reservaId, setReservaId] = useState(null);
  const [licenciaFile, setLicenciaFile] = useState(null);
  const [licenciaPreview, setLicenciaPreview] = useState(null);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  function handleLicencia(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setLicenciaFile(file);
    const reader = new FileReader();
    reader.onload = function () { setLicenciaPreview(reader.result); };
    reader.readAsDataURL(file);
  }

  function irATracker() {
    var destino = '/tracker/' + reservaId;
    window.location.assign(destino);
  }

  function irAInicio() {
    resetBooking();
    window.location.assign('/');
  }

  async function handleSubmit() {
    if (!cliente.nombre || !cliente.correo || !cliente.celular) {
      setErrorMsg('Por favor completa todos los campos obligatorios.');
      return;
    }
    if (!aceptaTerminos) {
      setErrorMsg('Debes aceptar las politicas de tratamiento de datos.');
      return;
    }
    if (!vehiculo || !zona || !slot) return;

    setEnviando(true);
    setErrorMsg(null);

    try {
      var licenciaUrl = null;

      if (licenciaFile) {
        var ext = licenciaFile.name.split('.').pop();
        var path = 'licencias/' + Date.now() + '.' + ext;
        var uploadResult = await supabase.storage.from('licencias').upload(path, licenciaFile);
        if (!uploadResult.error) {
          var publicUrlData = supabase.storage.from('licencias').getPublicUrl(path);
          licenciaUrl = publicUrlData.data.publicUrl;
        }
      }

      var insertResult = await supabase
        .from('reservas')
        .insert({
          vehiculo_id: vehiculo.id,
          sede_id: vehiculo.sede_id,
          zona_id: (zona.id === 'domicilio' || zona.id === 'sede') ? null : zona.id,
          cliente_nombre: cliente.nombre,
          cliente_correo: cliente.correo,
          cliente_celular: cliente.celular,
          licencia_url: licenciaUrl,
          tipo_entrega: zona.id === 'sede' ? 'concesionario' : 'domicilio',
          direccion_domicilio: zona.id !== 'sede' ? zona.nombre : null,
          fecha: slot.fecha,
          hora_inicio: slot.hora_inicio,
          hora_fin: slot.hora_fin,
          estado: 'confirmada',
        })
        .select()
        .single();

      if (insertResult.error) throw insertResult.error;

      setReservaId(insertResult.data.id);
      setConfirmado(true);
    } catch (err) {
      if (err && err.code === '23505') {
        setErrorMsg('Ese horario ya fue reservado. Por favor elige otro.');
      } else {
        setErrorMsg('Ocurrio un error al agendar. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  }

  if (confirmado) {
    return (
      <div className="max-w-lg mx-auto text-center py-8">
        <div className="w-16 h-16 bg-[#051620] rounded-full flex items-center justify-center mx-auto mb-5">
          <span className="text-white text-2xl">OK</span>
        </div>
        <h2 className="font-display text-3xl font-bold text-[#051620] mb-2">
          Prueba agendada
        </h2>
        <p className="text-[#666] mb-6">
          Te enviamos un correo de confirmacion con todos los detalles.
        </p>

        <div className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-sm p-5 text-left mb-6">
          <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-3">
            Resumen
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[#666] text-xs">Vehiculo</p>
              <p className="font-semibold text-[#051620]">KIA {vehiculo && vehiculo.modelo}</p>
            </div>
            <div>
              <p className="text-[#666] text-xs">Fecha</p>
              <p className="font-semibold text-[#051620]">{slot && slot.fecha}</p>
            </div>
            <div>
              <p className="text-[#666] text-xs">Hora</p>
              <p className="font-semibold text-[#051620]">{slot && slot.hora_inicio}</p>
            </div>
            <div>
              <p className="text-[#666] text-xs">Entrega</p>
              <p className="font-semibold text-[#051620]">
                {zona && zona.id === 'sede' ? 'En sede' : 'A domicilio'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[#666] text-xs">Direccion</p>
              <p className="font-semibold text-[#051620]">{zona && zona.nombre}</p>
            </div>
          </div>
        </div>

        {reservaId && (
          <button
            type="button"
            onClick={irATracker}
            className="inline-flex items-center gap-2 bg-[#051620] text-white text-sm font-medium px-6 py-3 rounded-sm hover:bg-[#0a2030] transition-colors mb-4 cursor-pointer"
          >
            Ver estado de mi prueba
          </button>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={irAInicio}
            className="text-sm text-[#666] hover:text-[#051620] transition-colors cursor-pointer"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold text-[#051620]">
          Tus datos
        </h2>
        <p className="text-[#666666] mt-2">
          Ultimo paso - completa tu informacion para confirmar la prueba.
        </p>
      </div>

      <div className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-sm p-4 mb-6">
        <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-3">
          Resumen de tu prueba
        </p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-[#666] text-xs">Vehiculo</p>
            <p className="font-semibold text-[#051620]">KIA {vehiculo && vehiculo.modelo}</p>
          </div>
          <div>
            <p className="text-[#666] text-xs">Fecha</p>
            <p className="font-semibold text-[#051620]">{slot && slot.fecha}</p>
          </div>
          <div>
            <p className="text-[#666] text-xs">Hora</p>
            <p className="font-semibold text-[#051620]">{slot && slot.hora_inicio}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          id="nombre"
          label="Nombre completo"
          required
          placeholder="Juan Garcia"
          value={cliente.nombre}
          onChange={function (e) { setCliente({ nombre: e.target.value }); }}
        />
        <Input
          id="correo"
          label="Correo electronico"
          type="email"
          required
          placeholder="juan@correo.com"
          value={cliente.correo}
          onChange={function (e) { setCliente({ correo: e.target.value }); }}
        />
        <Input
          id="celular"
          label="Celular"
          type="tel"
          required
          placeholder="+57 300 000 0000"
          value={cliente.celular}
          onChange={function (e) { setCliente({ celular: e.target.value }); }}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#051620]">
            Foto de licencia de conduccion (opcional)
          </label>
          <label
            htmlFor="licencia"
            className="border border-dashed border-[#e5e5e5] rounded-sm p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#051620] transition-colors bg-[#f8f8f8]"
          >
            {licenciaPreview ? (
              <img
                src={licenciaPreview}
                alt="Licencia"
                className="h-24 object-contain rounded"
              />
            ) : (
              <div>
                <p className="text-sm text-[#666]">Toca para subir una foto</p>
                <p className="text-xs text-[#aaa]">JPG, PNG, maximo 5MB</p>
              </div>
            )}
          </label>
          <input
            id="licencia"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLicencia}
          />
          {licenciaFile && (
            <p className="text-xs text-[#666]">Archivo: {licenciaFile.name}</p>
          )}
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={aceptaTerminos}
            onChange={function (e) { setAceptaTerminos(e.target.checked); }}
            className="mt-0.5 cursor-pointer"
          />
          <span className="text-sm text-[#666]">
            Autorizo a Distrikia el manejo de mis datos personales de acuerdo con las politicas de tratamiento de informacion.
          </span>
        </label>
      </div>

      {errorMsg && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3">
          {errorMsg}
        </p>
      )}

      <div className="flex items-center justify-between mt-8">
        <button
          type="button"
          onClick={function () { useBookingStore.getState().setPaso(3); }}
          className="text-sm text-[#666] hover:text-[#051620] transition-colors cursor-pointer"
        >
          Cambiar horario
        </button>
        <Button
          onClick={handleSubmit}
          variant="primary"
          size="lg"
          loading={enviando}
          disabled={enviando}
        >
          Confirmar prueba de ruta
        </Button>
      </div>
    </div>
  );
}
