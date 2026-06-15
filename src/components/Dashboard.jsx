import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShieldCheck, AlertTriangle, XOctagon, Sparkles, Filter, RefreshCw, Calendar, ArrowRight, TrendingDown, Check } from 'lucide-react';

export default function Dashboard({ config, showToast }) {
  const [competidores, setCompetidores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [preciosCompetencia, setPreciosCompetencia] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de filtros
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterCompetidor, setFilterCompetidor] = useState('');
  const [filterFechaInicio, setFilterFechaInicio] = useState('');
  const [filterFechaFin, setFilterFechaFin] = useState('');
  const [filterSoloAlertas, setFilterSoloAlertas] = useState(false);

  // Estado para la sugerencia interactiva (modificar precio propio rápido)
  const [updatingProductId, setUpdatingProductId] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, [filterCategoria, filterCompetidor, filterFechaInicio, filterFechaFin]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Cargar competidores activos
      const { data: comps, error: compsError } = await supabase
        .from('competidores')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (compsError) throw compsError;
      setCompetidores(comps || []);

      // 2. Cargar todos los productos
      let prodQuery = supabase
        .from('productos')
        .select('*')
        .order('descripcion', { ascending: true });

      if (filterCategoria) {
        prodQuery = prodQuery.eq('categoria', filterCategoria);
      }

      const { data: prods, error: prodsError } = await prodQuery;
      if (prodsError) throw prodsError;

      // 3. Cargar precios de competencia
      let preciosQuery = supabase
        .from('precios_competencia')
        .select('*');

      if (filterFechaInicio) {
        preciosQuery = preciosQuery.gte('fecha_captura', filterFechaInicio);
      }
      if (filterFechaFin) {
        preciosQuery = preciosQuery.lte('fecha_captura', filterFechaFin);
      }
      if (filterCompetidor) {
        preciosQuery = preciosQuery.eq('competidor_id', filterCompetidor);
      }

      const { data: precs, error: precsError } = await preciosQuery;
      if (precsError) throw precsError;

      setProductos(prods || []);
      setPreciosCompetencia(precs || []);
    } catch (err) {
      showToast('Error al cargar datos del dashboard: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Construir la matriz de datos en memoria
  const processedData = productos.map(prod => {
    // Filtrar registros de competencia para este producto
    const registrosProd = preciosCompetencia.filter(p => p.producto_id === prod.id);

    // Mapear el precio de cada competidor (tomando el más reciente del rango si hay varios)
    const preciosPorCompetidor = {};
    competidores.forEach(comp => {
      const registrosComp = registrosProd.filter(r => r.competidor_id === comp.id);
      if (registrosComp.length > 0) {
        // Ordenar por fecha desc y tomar el primero
        const masReciente = registrosComp.sort((a, b) => new Date(b.fecha_captura) - new Date(a.fecha_captura))[0];
        preciosPorCompetidor[comp.id] = masReciente.precio;
      } else {
        preciosPorCompetidor[comp.id] = null;
      }
    });

    // Calcular precio mínimo de la competencia
    const preciosValidos = Object.values(preciosPorCompetidor).filter(p => p !== null);
    const minCompetencia = preciosValidos.length > 0 ? Math.min(...preciosValidos) : null;

    // Calcular diferencia en % vs mínimo
    let diferenciaPorcentaje = null;
    let colorAlerta = 'neutral'; // verde, amarillo, rojo, neutral

    if (minCompetencia !== null && prod.precio_venta > 0) {
      const diff = prod.precio_venta - minCompetencia;
      diferenciaPorcentaje = (diff / minCompetencia) * 100;

      if (prod.precio_venta <= minCompetencia) {
        colorAlerta = 'verde';
      } else if (prod.precio_venta <= minCompetencia * 1.10) {
        colorAlerta = 'amarillo';
      } else {
        colorAlerta = 'rojo';
      }
    }

    // Calcular precio sugerido competitivo
    // Fórmula: max(minCompetencia, costo / (1 - margen_minimo/100))
    // Respetando que si minCompetencia es menor a lo que da el margen mínimo, sugerir el que da el margen mínimo.
    let precioSugerido = null;
    if (minCompetencia !== null) {
      const minMargenFactor = 1 - (config.margen_minimo / 100);
      const precioMinimoPorMargen = minMargenFactor > 0 ? (prod.costo / minMargenFactor) : prod.costo;
      
      // Sugerimos el mínimo de la competencia, pero si baja nuestro margen mínimo, sugerimos la tarifa de margen mínimo
      precioSugerido = Math.max(minCompetencia, precioMinimoPorMargen);
    }

    return {
      ...prod,
      preciosPorCompetidor,
      minCompetencia,
      diferenciaPorcentaje,
      colorAlerta,
      precioSugerido
    };
  });

  // Aplicar filtros adicionales en cliente (ej. Filtro por Competidor en listado, o Solo Alertas)
  const filteredData = processedData.filter(item => {
    // Si se filtra por competidor, solo mostrar productos que tengan precio registrado para ese competidor
    if (filterCompetidor && item.preciosPorCompetidor[filterCompetidor] === null) {
      return false;
    }
    // Si se activa solo alertas, ocultar verdes y neutrales
    if (filterSoloAlertas && (item.colorAlerta === 'verde' || item.colorAlerta === 'neutral')) {
      return false;
    }
    return true;
  });

  // Aplicar sugerencia y actualizar en Supabase
  const handleApplySuggestion = async (productId, precioRecomendado) => {
    setUpdatingProductId(productId);
    try {
      const { error } = await supabase
        .from('productos')
        .update({
          precio_venta: parseFloat(precioRecomendado.toFixed(2)),
          fecha_actualizacion_precio: new Date().toISOString()
        })
        .eq('id', productId);

      if (error) throw error;
      showToast('Precio actualizado con la sugerencia competitiva', 'success');
      
      // Recargar datos
      await fetchDashboardData();
    } catch (err) {
      showToast('Error al actualizar precio: ' + err.message, 'error');
    } finally {
      setUpdatingProductId(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Comparativa y Monitor de Precios</h1>
          <p className="text-slate-500 text-sm">Compara tus precios contra la competencia e implementa sugerencias inteligentes.</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex space-x-2">
          <button
            onClick={fetchDashboardData}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Contenedor de Filtros */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-1 text-slate-700 font-semibold text-sm border-b border-slate-100 pb-2">
          <Filter className="h-4.5 w-4.5 text-emerald-600" />
          <span>Filtros del Panel</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Filtrar Categoría */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Categoría</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
            >
              <option value="">Todas</option>
              {config.categorias?.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Filtrar por Competidor */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Filtrar por Competidor</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={filterCompetidor}
              onChange={(e) => setFilterCompetidor(e.target.value)}
            >
              <option value="">Todos los competidores</option>
              {competidores.map((comp) => (
                <option key={comp.id} value={comp.id}>{comp.nombre}</option>
              ))}
            </select>
          </div>

          {/* Fechas de Captura */}
          <div className="md:col-span-2 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Desde (Captura)</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none"
                  value={filterFechaInicio}
                  onChange={(e) => setFilterFechaInicio(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Hasta (Captura)</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none"
                  value={filterFechaFin}
                  onChange={(e) => setFilterFechaFin(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Checkbox Alertas */}
        <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
          <input
            type="checkbox"
            id="soloAlertas"
            className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            checked={filterSoloAlertas}
            onChange={(e) => setFilterSoloAlertas(e.target.checked)}
          />
          <label htmlFor="soloAlertas" className="text-xs text-slate-700 font-bold flex items-center cursor-pointer select-none">
            <AlertTriangle className="h-4 w-4 text-amber-500 mr-1" />
            Solo productos con alerta competitiva (Amarillo/Rojo)
          </label>
        </div>
      </div>

      {/* Resumen de Alertas en Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-800">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Productos Competitivos</p>
            <p className="text-xl font-bold font-mono">
              {processedData.filter(p => p.colorAlerta === 'verde').length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-amber-50 rounded-full text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Alerta Moderada (Hasta 10%)</p>
            <p className="text-xl font-bold font-mono">
              {processedData.filter(p => p.colorAlerta === 'amarillo').length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-red-50 rounded-full text-red-600">
            <XOctagon className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Crítico (&gt;10% sobre mínimo)</p>
            <p className="text-xl font-bold font-mono">
              {processedData.filter(p => p.colorAlerta === 'rojo').length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabla Comparativa Principal */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Analizando y cruzando precios del catálogo...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            No se encontraron productos coincidentes con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500 tracking-wider">
                <tr>
                  <th className="px-6 py-4 min-w-[200px]">Producto</th>
                  <th className="px-4 py-4 text-right">Ntro Precio</th>
                  <th className="px-4 py-4 text-right">Costo</th>
                  <th className="px-4 py-4 text-center">Margen %</th>
                  
                  {/* Columnas dinámicas de competidores */}
                  {competidores.map(comp => (
                    <th key={comp.id} className="px-4 py-4 text-center border-l border-slate-100 min-w-[120px]">
                      <div className="flex items-center justify-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: comp.color }} />
                        <span className="truncate max-w-[100px]" title={comp.nombre}>{comp.nombre}</span>
                      </div>
                    </th>
                  ))}

                  <th className="px-4 py-4 text-right border-l-2 border-slate-200">Mín. Competencia</th>
                  <th className="px-4 py-4 text-right">Diferencia</th>
                  <th className="px-6 py-4 text-center min-w-[150px]">Sugerencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.map((prod) => {
                  const c = prod.costo || 0;
                  const v = prod.precio_venta || 0;
                  const marg = v > 0 ? (((v - c) / v) * 100).toFixed(1) : '0.0';

                  // Estilos de alerta en la fila según el estado
                  let badgeStyle = 'bg-slate-100 text-slate-500';
                  let rowStyle = '';
                  if (prod.colorAlerta === 'verde') {
                    badgeStyle = 'bg-emerald-100 text-emerald-800';
                    rowStyle = 'hover:bg-emerald-50/20';
                  } else if (prod.colorAlerta === 'amarillo') {
                    badgeStyle = 'bg-amber-100 text-amber-800';
                    rowStyle = 'bg-amber-50/10 hover:bg-amber-50/30';
                  } else if (prod.colorAlerta === 'rojo') {
                    badgeStyle = 'bg-red-100 text-red-800';
                    rowStyle = 'bg-red-50/10 hover:bg-red-50/30';
                  }

                  return (
                    <tr key={prod.id} className={`transition-colors duration-150 ${rowStyle}`}>
                      {/* Producto */}
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-slate-800 text-sm">{prod.descripcion}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{prod.sku} • {prod.marca}</div>
                      </td>

                      {/* Nuestro Precio */}
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900 font-mono text-sm">
                        ${v.toFixed(2)}
                      </td>

                      {/* Costo */}
                      <td className="px-4 py-3.5 text-right text-slate-500 font-mono">
                        ${c.toFixed(2)}
                      </td>

                      {/* Margen */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${parseFloat(marg) >= config.margen_minimo ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'}`}>
                          {marg}%
                        </span>
                      </td>

                      {/* Precios de Competencia (dinámico) */}
                      {competidores.map(comp => {
                        const precioComp = prod.preciosPorCompetidor[comp.id];
                        return (
                          <td key={comp.id} className="px-4 py-3.5 text-center font-mono border-l border-slate-100">
                            {precioComp !== null ? (
                              <span className="font-semibold text-slate-800">${precioComp.toFixed(2)}</span>
                            ) : (
                              <span className="text-[10px] text-slate-300 font-normal">--</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Mínimo Competencia */}
                      <td className="px-4 py-3.5 text-right font-bold font-mono text-slate-800 border-l-2 border-slate-200">
                        {prod.minCompetencia !== null ? `$${prod.minCompetencia.toFixed(2)}` : '--'}
                      </td>

                      {/* Diferencia contra el mínimo */}
                      <td className="px-4 py-3.5 text-right font-bold font-mono">
                        {prod.diferenciaPorcentaje !== null ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${badgeStyle}`}>
                            {prod.diferenciaPorcentaje > 0 ? '+' : ''}
                            {prod.diferenciaPorcentaje.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Sin datos</span>
                        )}
                      </td>

                      {/* Sugerencia y botón rápido */}
                      <td className="px-6 py-3.5 text-center">
                        {prod.precioSugerido !== null ? (
                          <div className="flex items-center justify-center space-x-1.5">
                            <span className="font-mono font-bold text-emerald-700 text-xs bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                              ${prod.precioSugerido.toFixed(2)}
                            </span>
                            {prod.precio_venta !== prod.precioSugerido && (
                              <button
                                disabled={updatingProductId === prod.id}
                                onClick={() => handleApplySuggestion(prod.id, prod.precioSugerido)}
                                className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow hover:shadow-md transition-all disabled:opacity-50"
                                title="Aplicar precio sugerido automáticamente"
                              >
                                {updatingProductId === prod.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Requiere captura</span>
                        )}
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
  );
}
