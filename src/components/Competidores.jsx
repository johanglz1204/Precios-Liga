import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, AlertCircle, Save, X } from 'lucide-react';

export default function Competidores({ showToast }) {
  const [competidores, setCompetidores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado del formulario
  const [editingId, setEditingId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [activo, setActivo] = useState(true);

  // Paleta de colores sugerida para competidores (diseño premium)
  const coloresSugeridos = [
    '#3B82F6', // Azul
    '#EF4444', // Rojo
    '#F59E0B', // Amarillo/Naranja
    '#EC4899', // Rosa
    '#8B5CF6', // Morado
    '#06B6D4', // Cyan
    '#F97316', // Naranja oscuro
    '#64748B', // Pizarra
  ];

  useEffect(() => {
    fetchCompetidores();
  }, []);

  const fetchCompetidores = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('competidores')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCompetidores(data || []);
    } catch (err) {
      showToast('Error al cargar competidores: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setNombre('');
    setDireccion('');
    setTelefono('');
    setNotas('');
    setColor('#3B82F6');
    setActivo(true);
  };

  const handleEdit = (comp) => {
    setEditingId(comp.id);
    setNombre(comp.nombre);
    setDireccion(comp.direccion || '');
    setTelefono(comp.telefono || '');
    setNotas(comp.notas || '');
    setColor(comp.color);
    setActivo(comp.activo);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      showToast('El nombre del competidor es requerido.', 'error');
      return;
    }

    // Contar competidores activos (excluyendo el que se está editando si es el caso)
    const activosActuales = competidores.filter(c => c.activo && c.id !== editingId).length;

    if (activo && activosActuales >= 8) {
      showToast('Límite alcanzado: Máximo 8 competidores activos permitidos simultáneamente.', 'error');
      return;
    }

    const payload = {
      nombre: nombre.trim(),
      direccion: direccion.trim() || null,
      telefono: telefono.trim() || null,
      notas: notas.trim() || null,
      color,
      activo
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('competidores')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        showToast('Competidor actualizado con éxito', 'success');
      } else {
        const { error } = await supabase
          .from('competidores')
          .insert([payload]);

        if (error) throw error;
        showToast('Competidor registrado con éxito', 'success');
      }
      resetForm();
      fetchCompetidores();
    } catch (err) {
      showToast('Error al guardar competidor: ' + err.message, 'error');
    }
  };

  const handleToggleActivo = async (comp) => {
    // Si se va a activar, comprobar el límite
    if (!comp.activo) {
      const activosActuales = competidores.filter(c => c.activo).length;
      if (activosActuales >= 8) {
        showToast('Límite alcanzado: Máximo 8 competidores activos permitidos simultáneamente.', 'error');
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('competidores')
        .update({ activo: !comp.activo })
        .eq('id', comp.id);

      if (error) throw error;
      showToast(`Competidor ${!comp.activo ? 'activado' : 'desactivado'} con éxito`, 'success');
      fetchCompetidores();
    } catch (err) {
      showToast('Error al cambiar estado: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este competidor? Se eliminarán todos sus precios registrados históricamente.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('competidores')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Competidor eliminado con éxito', 'success');
      fetchCompetidores();
      if (editingId === id) resetForm();
    } catch (err) {
      showToast('Error al eliminar competidor: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestión de Competidores</h1>
          <p className="text-slate-500 text-sm">Monitorea hasta 8 farmacias de la zona para fijar precios competitivos.</p>
        </div>
        <div className="mt-2 md:mt-0 bg-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1 border border-slate-200">
          <AlertCircle className="h-4 w-4 text-emerald-600" />
          <span>Activos: {competidores.filter(c => c.activo).length} / 8 permitidos</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Formulario de registro/edición */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            {editingId ? <Edit2 className="h-5 w-5 mr-2 text-emerald-600" /> : <Plus className="h-5 w-5 mr-2 text-emerald-600" />}
            {editingId ? 'Editar Competidor' : 'Nuevo Competidor'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Nombre Comercial</label>
              <input
                type="text"
                placeholder="Ej. Farmacia Similares Centro"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Dirección / Sucursal</label>
              <input
                type="text"
                placeholder="Ej. Av. Hidalgo #120"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Teléfono</label>
              <input
                type="text"
                placeholder="Ej. 555-0199"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Color Identificador (Dashboard)</label>
              <div className="flex flex-wrap gap-2 mt-1 mb-2">
                {coloresSugeridos.map((col) => (
                  <button
                    key={col}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${color === col ? 'border-slate-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: col }}
                    onClick={() => setColor(col)}
                    title={col}
                  />
                ))}
                <input
                  type="color"
                  className="w-8 h-8 rounded-full border border-slate-300 p-0 cursor-pointer overflow-hidden"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  title="Color personalizado"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 font-mono text-center py-1 rounded" style={{ backgroundColor: color + '22', color }}>
                Vista previa del color
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Notas / Observaciones</label>
              <textarea
                placeholder="Ej. Horario 24 horas, promociones los miércoles..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm h-20 resize-none"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="activo"
                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
              <label htmlFor="activo" className="text-sm text-slate-700 font-medium cursor-pointer">
                Competidor Activo (se muestra en dashboard)
              </label>
            </div>

            <div className="flex space-x-2 pt-2 border-t border-slate-100">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm text-sm flex items-center justify-center space-x-1"
              >
                <Save className="h-4 w-4" />
                <span>Guardar</span>
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2 px-3 rounded-lg text-sm"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Listado de competidores */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Listado de Competidores</h2>

            {loading ? (
              <div className="py-8 text-center text-slate-500">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Cargando competidores...
              </div>
            ) : competidores.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                No hay competidores registrados. Comienza agregando uno a la izquierda.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {competidores.map((comp) => (
                  <div 
                    key={comp.id}
                    className={`relative rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow duration-200`}
                  >
                    {/* Barra de color de identificación */}
                    <div className="h-2 w-full" style={{ backgroundColor: comp.color }} />

                    <div className="p-4 flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-slate-800 text-base leading-tight">{comp.nombre}</h3>
                        <button
                          onClick={() => handleToggleActivo(comp)}
                          className={`flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${comp.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}
                          title="Click para cambiar estado"
                        >
                          {comp.activo ? (
                            <>
                              <CheckCircle className="h-3 w-3 text-emerald-600" />
                              <span>Activo</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 text-slate-400" />
                              <span>Inactivo</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-slate-500 font-medium">
                        {comp.direccion && <p><span className="font-semibold text-slate-600">Dirección:</span> {comp.direccion}</p>}
                        {comp.telefono && <p><span className="font-semibold text-slate-600">Tel:</span> {comp.telefono}</p>}
                        {comp.notas && (
                          <div className="mt-2 bg-slate-50 p-2 rounded text-slate-600 italic font-normal text-xs border-l-2 border-slate-300">
                            "{comp.notas}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(comp)}
                        className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(comp.id)}
                        className="p-1.5 bg-white hover:bg-red-50 text-red-600 rounded-lg border border-slate-200 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
