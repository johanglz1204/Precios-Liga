import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Save, AlertTriangle, AlertCircle, Calendar, User, FileText, Check, DollarSign, Tag } from 'lucide-react';

export default function PreciosCompetencia({ config, showToast }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [competidores, setCompetidores] = useState([]);
  const [preciosActuales, setPreciosActuales] = useState({}); // Precios de competencia cargados para este producto en el mes actual
  
  // Buscador de productos
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  // Estados de carga
  const [loadingCompetidores, setLoadingCompetidores] = useState(false);
  const [loadingPrecios, setLoadingPrecios] = useState(false);

  // Estados de edición del grid (mapeado por competidor_id)
  const [gridData, setGridData] = useState({});

  // Estado del Modal de Duplicados
  const [duplicateModal, setDuplicateModal] = useState({
    isOpen: false,
    competidorNombre: '',
    fechaExistente: '',
    competidorId: '',
    payload: null,
    existenteId: null
  });

  // Cargar competidores activos
  useEffect(() => {
    fetchActiveCompetitors();
  }, []);

  // Cargar precios de competencia cuando se selecciona un producto
  useEffect(() => {
    if (selectedProduct) {
      fetchPreciosProducto(selectedProduct.id);
    } else {
      setPreciosActuales({});
      setGridData({});
    }
  }, [selectedProduct]);

  // Manejar clics externos para el buscador
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Búsqueda de productos en tiempo real
  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('productos')
          .select('*')
          .or(`sku.ilike.%${searchQuery}%,descripcion.ilike.%${searchQuery}%`)
          .limit(6);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error('Error al buscar productos:', err.message);
      }
    };

    const delayDebounce = setTimeout(() => {
      searchProducts();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const fetchActiveCompetitors = async () => {
    setLoadingCompetidores(true);
    try {
      const { data, error } = await supabase
        .from('competidores')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) throw error;
      setCompetidores(data || []);
    } catch (err) {
      showToast('Error al cargar competidores activos: ' + err.message, 'error');
    } finally {
      setLoadingCompetidores(false);
    }
  };

  const fetchPreciosProducto = async (productoId) => {
    setLoadingPrecios(true);
    try {
      // Obtener el mes actual en formato YYYY-MM
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const currentMonthStr = `${year}-${month}`;

      const { data, error } = await supabase
        .from('precios_competencia')
        .select('*, competidores(nombre)')
        .eq('producto_id', productoId)
        .eq('mes_calendario', currentMonthStr);

      if (error) throw error;

      // Estructurar precios por competidor_id
      const preciosMap = {};
      const initialGrid = {};

      // Inicializar el grid con valores vacíos para cada competidor
      competidores.forEach(comp => {
        initialGrid[comp.id] = {
          precio: '',
          fecha_captura: new Date().toISOString().split('T')[0],
          empleado: config.empleados?.[0] || '',
          notas: '',
          tipo_oferta: ''
        };
      });

      // Rellenar con los precios cargados si existen
      data?.forEach(reg => {
        preciosMap[reg.competidor_id] = reg;
        initialGrid[reg.competidor_id] = {
          precio: reg.precio.toString(),
          fecha_captura: reg.fecha_captura,
          empleado: reg.empleado,
          notas: reg.notas || '',
          tipo_oferta: reg.tipo_oferta || ''
        };
      });

      setPreciosActuales(preciosMap);
      setGridData(initialGrid);
    } catch (err) {
      showToast('Error al cargar precios de competencia: ' + err.message, 'error');
    } finally {
      setLoadingPrecios(false);
    }
  };

  const handleSelectProduct = (prod) => {
    setSelectedProduct(prod);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleGridChange = (competidorId, field, value) => {
    setGridData(prev => ({
      ...prev,
      [competidorId]: {
        ...prev[competidorId],
        [field]: value
      }
    }));
  };

  const handleSaveCompetidorPrecio = async (comp) => {
    const data = gridData[comp.id];
    
    if (!data.precio || parseFloat(data.precio) <= 0) {
      showToast(`Por favor ingresa un precio válido para ${comp.nombre}`, 'error');
      return;
    }

    if (!data.empleado) {
      showToast(`Por favor selecciona el empleado que capturó el dato.`, 'error');
      return;
    }

    const priceNum = parseFloat(data.precio);
    const dateStr = data.fecha_captura;
    
    // Calcular mes calendario de la fecha de captura seleccionada
    const captureDate = new Date(dateStr + 'T00:00:00');
    const year = captureDate.getFullYear();
    const month = String(captureDate.getMonth() + 1).padStart(2, '0');
    const mesCalendario = `${year}-${month}`;

    const payload = {
      producto_id: selectedProduct.id,
      competidor_id: comp.id,
      precio: priceNum,
      fecha_captura: dateStr,
      empleado: data.empleado,
      notas: data.notas?.trim() || null,
      tipo_oferta: data.tipo_oferta?.trim() || null,
      mes_calendario: mesCalendario
    };

    try {
      // 1. Validar si ya existe registro para este producto + competidor en el mes seleccionado
      const { data: existencias, error: queryError } = await supabase
        .from('precios_competencia')
        .select('id, fecha_captura, precio')
        .eq('producto_id', selectedProduct.id)
        .eq('competidor_id', comp.id)
        .eq('mes_calendario', mesCalendario)
        .limit(1);

      if (queryError) throw queryError;

      if (existencias && existencias.length > 0) {
        // Encontró duplicado mensual, lanzar modal
        const existente = existencias[0];
        setDuplicateModal({
          isOpen: true,
          competidorNombre: comp.nombre,
          fechaExistente: existente.fecha_captura,
          competidorId: comp.id,
          payload,
          existenteId: existente.id
        });
      } else {
        // No hay duplicado, insertar directo
        const { error: insertError } = await supabase
          .from('precios_competencia')
          .insert([payload]);

        if (insertError) throw insertError;
        
        // Registrar en historial
        const historialPayload = {
          producto_id: selectedProduct.id,
          competidor_id: comp.id,
          precio: priceNum,
          fecha_captura: dateStr,
          empleado: data.empleado,
          notas: data.notas?.trim() || null,
          tipo_oferta: data.tipo_oferta?.trim() || null,
          mes_calendario: mesCalendario
        };
        const { error: histErr } = await supabase
          .from('historial_precios_competencia')
          .insert([historialPayload]);
        if (histErr) {
          console.error('Error al guardar en el historial:', histErr);
          showToast('Precio guardado, pero falló el historial: ' + histErr.message, 'error');
        }
        
        showToast(`Precio guardado para ${comp.nombre}`, 'success');
        fetchPreciosProducto(selectedProduct.id);
      }
    } catch (err) {
      showToast('Error al registrar precio: ' + err.message, 'error');
    }
  };

  const handleOverwrite = async () => {
    try {
      const { error: updateError } = await supabase
        .from('precios_competencia')
        .update(duplicateModal.payload)
        .eq('id', duplicateModal.existenteId);

      if (updateError) throw updateError;

      // Registrar en historial
      const historialPayload = {
        producto_id: duplicateModal.payload.producto_id,
        competidor_id: duplicateModal.payload.competidor_id,
        precio: duplicateModal.payload.precio,
        fecha_captura: duplicateModal.payload.fecha_captura,
        empleado: duplicateModal.payload.empleado,
        notas: duplicateModal.payload.notas || null,
        tipo_oferta: duplicateModal.payload.tipo_oferta || null,
        mes_calendario: duplicateModal.payload.mes_calendario
      };
      const { error: histErr } = await supabase
        .from('historial_precios_competencia')
        .insert([historialPayload]);
      if (histErr) {
        console.error('Error al guardar en el historial (overwrite):', histErr);
        showToast('Precio actualizado, pero falló el historial: ' + histErr.message, 'error');
      }

      showToast(`Precio actualizado para ${duplicateModal.competidorNombre}`, 'success');
      setDuplicateModal({ isOpen: false, competidorNombre: '', fechaExistente: '', competidorId: '', payload: null, existenteId: null });
      fetchPreciosProducto(selectedProduct.id);
    } catch (err) {
      showToast('Error al actualizar precio: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Captura de Precios de Competencia</h1>
          <p className="text-slate-500 text-sm">Registra y actualiza los precios vigentes de la competencia para compararlos en tiempo real.</p>
        </div>
      </div>

      {/* Buscador de Producto */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" ref={searchRef}>
        <label className="block text-sm font-bold text-slate-700 mb-2">
          Buscar medicamento para registrar precios:
        </label>
        
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Escribe el código de barras SKU o nombre comercial..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />
          
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((prod) => (
                <div
                  key={prod.id}
                  className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-sm border-b border-slate-100 last:border-0"
                  onClick={() => handleSelectProduct(prod)}
                >
                  <div>
                    <p className="font-semibold text-slate-800">{prod.descripcion}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{prod.sku}</span>
                    <p className="text-xs font-bold text-slate-700 mt-1">Ntro: ${prod.precio_venta.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid de Captura */}
      {selectedProduct ? (
        <div className="space-y-4">
          
          {/* Ficha técnica del producto seleccionado */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-xl text-white shadow-md flex flex-col md:flex-row justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{selectedProduct.descripcion}</h2>
              <p className="text-slate-400 text-xs mt-1">
                SKU: <span className="text-white font-mono">{selectedProduct.sku}</span>
              </p>
            </div>
            
            <div className="flex space-x-6 bg-white/5 border border-white/10 p-3 rounded-lg self-center md:self-auto text-sm">
              <div className="text-center">
                <p className="text-slate-400 text-xs">Costo Proveedor</p>
                <p className="text-base font-bold font-mono mt-0.5">${selectedProduct.costo.toFixed(2)}</p>
              </div>
              <div className="w-px bg-white/10 self-stretch" />
              <div className="text-center">
                <p className="text-slate-400 text-xs">Nuestro Precio</p>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">${selectedProduct.precio_venta.toFixed(2)}</p>
              </div>
              <div className="w-px bg-white/10 self-stretch" />
              <div className="text-center">
                <p className="text-slate-400 text-xs">Margen propio</p>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                  {selectedProduct.precio_venta > 0 
                    ? (((selectedProduct.precio_venta - selectedProduct.costo) / selectedProduct.precio_venta) * 100).toFixed(1) 
                    : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Grid editable */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-base">Tabla de Registro (Precios de Competidores)</h3>
              <span className="text-xs text-slate-500 font-medium">Nota: Guarda cada fila individualmente.</span>
            </div>

            {loadingCompetidores || loadingPrecios ? (
              <div className="py-12 text-center text-slate-400">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Cargando competidores y registros actuales...
              </div>
            ) : competidores.length === 0 ? (
              <div className="py-12 text-center text-slate-500 bg-slate-50 border border-dashed m-4 rounded-lg">
                No hay competidores activos registrados en el sistema. 
                Por favor, ve al módulo de <strong>Gestión de Competidores</strong> para activar al menos uno.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-3 min-w-[200px]">Competidor</th>
                      <th className="px-4 py-3 text-right min-w-[120px]">Último Guardado</th>
                      <th className="px-4 py-3 min-w-[140px]">Precio Captura ($) *</th>
                      <th className="px-4 py-3 min-w-[160px]">Fecha Captura</th>
                      <th className="px-4 py-3 min-w-[180px]">Quién Capturó *</th>
                      <th className="px-4 py-3 min-w-[180px]">Tipo de Oferta</th>
                      <th className="px-4 py-3 min-w-[200px]">Notas</th>
                      <th className="px-6 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {competidores.map((comp) => {
                      const guardadoEsteMes = preciosActuales[comp.id];
                      const data = gridData[comp.id] || { precio: '', fecha_captura: '', empleado: '', notas: '', tipo_oferta: '' };

                      return (
                        <tr key={comp.id} className="hover:bg-slate-50/80 transition-colors align-middle">
                          
                          {/* Info Competidor */}
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            <div className="flex items-center space-x-3">
                              <span className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm border border-black/5" style={{ backgroundColor: comp.color }} />
                              <div>
                                <p className="text-slate-900 font-bold leading-snug">{comp.nombre}</p>
                                <p className="text-[10px] text-slate-400 font-normal mt-0.5 max-w-[160px] truncate">{comp.direccion || 'Sin dirección'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Último Guardado este Mes */}
                          <td className="px-4 py-4 text-right">
                            {guardadoEsteMes ? (
                              <div className="text-xs">
                                <span className="font-bold text-emerald-600 font-mono text-sm">${guardadoEsteMes.precio.toFixed(2)}</span>
                                <p className="text-[10px] text-slate-400 mt-0.5">el {guardadoEsteMes.fecha_captura}</p>
                              </div>
                            ) : (
                              <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium border border-slate-200/50">
                                Sin captura
                              </span>
                            )}
                          </td>

                          {/* Entrada de Precio */}
                          <td className="px-4 py-4">
                            <div className="relative rounded-lg shadow-sm">
                              <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                                value={data.precio}
                                onChange={(e) => handleGridChange(comp.id, 'precio', e.target.value)}
                              />
                            </div>
                          </td>

                          {/* Entrada de Fecha */}
                          <td className="px-4 py-4">
                            <div className="relative rounded-lg shadow-sm">
                              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                              <input
                                type="date"
                                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                                value={data.fecha_captura}
                                onChange={(e) => handleGridChange(comp.id, 'fecha_captura', e.target.value)}
                              />
                            </div>
                          </td>

                          {/* Empleado Capturista */}
                          <td className="px-4 py-4">
                            <div className="relative rounded-lg shadow-sm">
                              <User className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                              <select
                                className="w-full pl-8 pr-2 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                                value={data.empleado}
                                onChange={(e) => handleGridChange(comp.id, 'empleado', e.target.value)}
                              >
                                <option value="">Seleccionar...</option>
                                {config.empleados?.map((emp) => (
                                  <option key={emp} value={emp}>{emp}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Tipo de Oferta */}
                          <td className="px-4 py-4">
                            <div className="relative rounded-lg shadow-sm">
                              <Tag className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                              <input
                                type="text"
                                placeholder="Ej: 3+1, Descto 10%..."
                                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all bg-white"
                                value={data.tipo_oferta}
                                onChange={(e) => handleGridChange(comp.id, 'tipo_oferta', e.target.value)}
                              />
                            </div>
                          </td>

                          {/* Notas */}
                          <td className="px-4 py-4">
                            <div className="relative rounded-lg shadow-sm">
                              <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                              <input
                                type="text"
                                placeholder="Observaciones..."
                                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                                value={data.notas}
                                onChange={(e) => handleGridChange(comp.id, 'notas', e.target.value)}
                              />
                            </div>
                          </td>

                          {/* Botón de Fila */}
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleSaveCompetidorPrecio(comp)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-[0.98] mx-auto min-w-[90px]"
                            >
                              <Save className="h-3.5 w-3.5" />
                              <span>Guardar</span>
                            </button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm">
          <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-600">No hay producto seleccionado</p>
          <p className="text-sm mt-1">Usa la barra de búsqueda superior para seleccionar un producto y comenzar la captura de precios.</p>
        </div>
      )}

      {/* MODAL DE ADVERTENCIA PARA DUPLICADO MENSUAL */}
      {duplicateModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Cabecera del Modal */}
            <div className="bg-amber-500 px-6 py-4 text-white flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-amber-100 animate-pulse" />
              <h3 className="font-bold text-lg">Confirmación de Sobreescritura</h3>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 space-y-3">
              <p className="text-slate-700 text-sm font-medium leading-relaxed">
                ⚠️ Este producto ya tiene precio registrado para <span className="font-bold text-slate-900">{duplicateModal.competidorNombre}</span> en <span className="font-bold text-slate-900">{duplicateModal.fechaExistente}</span> (dentro de este mes calendario).
              </p>
              <p className="text-slate-500 text-xs">
                ¿Deseas actualizar el precio de competencia para registrar el nuevo valor de <span className="font-bold font-mono text-emerald-600">${duplicateModal.payload?.precio.toFixed(2)}</span>? Esto sobreescribirá el registro existente.
              </p>
            </div>

            {/* Botones del Modal */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDuplicateModal({ isOpen: false, competidorNombre: '', fechaExistente: '', competidorId: '', payload: null, existenteId: null })}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleOverwrite}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors shadow-sm"
              >
                <Check className="h-4 w-4" />
                <span>Actualizar (Sobreescribir)</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
