import React, { useState, useEffect } from 'react';
import { supabase, clearCredentialsFromLocal, supabaseSource } from '../supabaseClient';
import { Save, Plus, Trash2, Database, Download, FileJson, LogOut, CheckCircle, RefreshCw } from 'lucide-react';

export default function Configuracion({ config, onConfigUpdated, showToast }) {
  const [nombreFarmacia, setNombreFarmacia] = useState('');
  const [margenMinimo, setMargenMinimo] = useState(20);
  const [categorias, setCategorias] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  // Inputs para agregar elementos
  const [nuevaCat, setNuevaCat] = useState('');
  const [nuevoEmp, setNuevoEmp] = useState('');

  // Sincronizar estado local con la config cargada en App
  useEffect(() => {
    if (config) {
      setNombreFarmacia(config.nombre_farmacia || '');
      setMargenMinimo(config.margen_minimo || 20);
      setCategorias(config.categorias || []);
      setEmpleados(config.empleados || []);
    }
  }, [config]);

  // Guardar configuración general (Nombre y Margen)
  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    if (!nombreFarmacia.trim()) {
      showToast('El nombre de la farmacia es obligatorio', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('configuracion')
        .update({
          nombre_farmacia: nombreFarmacia.trim(),
          margen_minimo: parseFloat(margenMinimo) || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) throw error;
      showToast('Configuración general actualizada', 'success');
      onConfigUpdated(); // Recargar config global en App.jsx
    } catch (err) {
      showToast('Error al guardar configuración: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Guardar cambios en las listas (Categorías o Empleados)
  const updateListsInDatabase = async (updatedCategorias, updatedEmpleados) => {
    try {
      const { error } = await supabase
        .from('configuracion')
        .update({
          categorias: updatedCategorias,
          empleados: updatedEmpleados,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) throw error;
      onConfigUpdated(); // Notificar cambio a App.jsx
    } catch (err) {
      showToast('Error al actualizar listas en la base de datos: ' + err.message, 'error');
    }
  };

  // Agregar Categoría
  const handleAddCategoria = (e) => {
    e.preventDefault();
    const cleanCat = nuevaCat.trim();
    if (!cleanCat) return;

    if (categorias.includes(cleanCat)) {
      showToast('Esa categoría ya existe', 'error');
      return;
    }

    const updated = [...categorias, cleanCat];
    setCategorias(updated);
    setNuevaCat('');
    updateListsInDatabase(updated, empleados);
    showToast('Categoría agregada con éxito', 'success');
  };

  // Eliminar Categoría
  const handleRemoveCategoria = (catToDelete) => {
    if (categorias.length <= 1) {
      showToast('Debe existir al menos una categoría en el sistema.', 'error');
      return;
    }
    const updated = categorias.filter(c => c !== catToDelete);
    setCategorias(updated);
    updateListsInDatabase(updated, empleados);
    showToast('Categoría eliminada', 'success');
  };

  // Agregar Empleado
  const handleAddEmpleado = (e) => {
    e.preventDefault();
    const cleanEmp = nuevoEmp.trim();
    if (!cleanEmp) return;

    if (empleados.includes(cleanEmp)) {
      showToast('Ese empleado ya está registrado', 'error');
      return;
    }

    const updated = [...empleados, cleanEmp];
    setEmpleados(updated);
    setNuevoEmp('');
    updateListsInDatabase(categorias, updated);
    showToast('Empleado agregado con éxito', 'success');
  };

  // Eliminar Empleado
  const handleRemoveEmpleado = (empToDelete) => {
    if (empleados.length <= 1) {
      showToast('Debe existir al menos un empleado para capturar precios.', 'error');
      return;
    }
    const updated = empleados.filter(e => e !== empToDelete);
    setEmpleados(updated);
    updateListsInDatabase(categorias, updated);
    showToast('Empleado removido', 'success');
  };

  // Exportar respaldo de base de datos completa en JSON
  const handleExportFullBackup = async () => {
    setBackingUp(true);
    try {
      // 1. Consultar todas las tablas
      const { data: configRow } = await supabase.from('configuracion').select('*');
      const { data: productos } = await supabase.from('productos').select('*');
      const { data: competidores } = await supabase.from('competidores').select('*');
      const { data: preciosCompetencia } = await supabase.from('precios_competencia').select('*');

      const backupObj = {
        exportedAt: new Date().toISOString(),
        farmacia: nombreFarmacia,
        version: '1.0.0',
        data: {
          configuracion: configRow || [],
          productos: productos || [],
          competidores: competidores || [],
          precios_competencia: preciosCompetencia || []
        }
      };

      // Descargar archivo
      const jsonString = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `FarmaPrecios_Respaldo_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Respaldo de base de datos generado con éxito', 'success');
    } catch (err) {
      showToast('Error al generar respaldo: ' + err.message, 'error');
    } finally {
      setBackingUp(false);
    }
  };

  // Desconectar credenciales locales (sólo si se configuraron por interfaz gráfica)
  const handleDisconnect = () => {
    if (window.confirm('¿Seguro que deseas eliminar la conexión local? Deberás configurar la URL y la Anon Key nuevamente para usar la app.')) {
      clearCredentialsFromLocal();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Configuración del Sistema</h1>
          <p className="text-slate-500 text-sm">Administra el perfil de la farmacia, tus listas globales y genera respaldos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CONFIGURACIÓN GENERAL */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit space-y-4">
          <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">Perfil de Farmacia</h2>

          <form onSubmit={handleSaveGeneral} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Nombre Comercial de Farmacia</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                value={nombreFarmacia}
                onChange={(e) => setNombreFarmacia(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Margen Mínimo Aceptable (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono text-right pr-8"
                  value={margenMinimo}
                  onChange={(e) => setMargenMinimo(e.target.value)}
                  required
                />
                <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-xs">%</span>
              </div>
              <p className="text-[10px] text-slate-400 italic mt-1">
                Utilizado para colorear márgenes deficientes en catálogo y para calcular el precio mínimo sugerido en base al costo del medicamento.
              </p>
            </div>



            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg text-sm shadow-sm flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Guardando...' : 'Guardar Perfil'}</span>
            </button>
          </form>
        </div>

        {/* LISTAS EDITABLES (CATEGORÍAS Y EMPLEADOS) */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* GESTIÓN DE CATEGORÍAS */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Categorías de Productos</h3>
              
              <form onSubmit={handleAddCategoria} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Nueva categoría..."
                  className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={nuevaCat}
                  onChange={(e) => setNuevaCat(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>

              {/* Lista */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {categorias.map((cat) => (
                  <div key={cat} className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-150 text-xs font-semibold text-slate-700">
                    <span>{cat}</span>
                    <button
                      onClick={() => handleRemoveCategoria(cat)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="Eliminar categoría"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* GESTIÓN DE EMPLEADOS */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Empleados Capturistas</h3>

              <form onSubmit={handleAddEmpleado} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Nombre de empleado..."
                  className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={nuevoEmp}
                  onChange={(e) => setNuevoEmp(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>

              {/* Lista */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {empleados.map((emp) => (
                  <div key={emp} className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-150 text-xs font-semibold text-slate-700">
                    <span>{emp}</span>
                    <button
                      onClick={() => handleRemoveEmpleado(emp)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="Remover empleado"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RESPALDO DE DATOS & CONEXIÓN */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Caja Respaldo */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-850 flex items-center">
                <Download className="h-4.5 w-4.5 text-emerald-600 mr-2" />
                Respaldos de Base de Datos
              </h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Descarga un archivo JSON completo que contiene todos los productos, competidores, histórico de precios y configuraciones. Puedes usar esto como resguardo manual.
              </p>
              
              <button
                type="button"
                disabled={backingUp}
                onClick={handleExportFullBackup}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-4 rounded-lg shadow-sm flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <FileJson className="h-4 w-4" />
                <span>{backingUp ? 'Exportando...' : 'Exportar Base de Datos (JSON)'}</span>
              </button>
            </div>

            {/* Caja Conexión Supabase */}
            <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
              <h3 className="text-sm font-bold text-slate-850 flex items-center">
                <Database className="h-4.5 w-4.5 text-emerald-600 mr-2" />
                Estado de Conexión
              </h3>
              
              <div className="text-xs space-y-1.5 font-medium">
                <p className="text-slate-500">
                  Proveedor de base de datos:{' '}
                  <span className="text-slate-700 font-bold">Supabase Cloud</span>
                </p>
                <p className="text-slate-500">
                  Origen de credenciales:{' '}
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {supabaseSource === 'code' ? 'Código Estático' : 'Configuración de Navegador'}
                  </span>
                </p>
              </div>

              {supabaseSource === 'local' && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold py-2 px-3 rounded-lg flex items-center space-x-1.5 transition-colors mt-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Eliminar Conexión Local</span>
                </button>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
