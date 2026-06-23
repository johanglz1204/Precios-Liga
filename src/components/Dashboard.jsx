import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShieldCheck, AlertTriangle, XOctagon, Sparkles, Filter, RefreshCw, Calendar, Clock, User, FileText, X, Search, Tag } from 'lucide-react';

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

  // Estado para modal de historial de cambios
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    productName: '',
    competitorName: '',
    productId: null,
    competitorId: null,
    loading: false,
    records: []
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;


  const handleShowHistory = async (product, competitor) => {
    setHistoryModal({
      isOpen: true,
      productName: product.descripcion,
      competitorName: competitor.nombre,
      productId: product.id,
      competitorId: competitor.id,
      loading: true,
      records: []
    });

    try {
      // Obtener el mes actual en formato YYYY-MM
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const currentMonthStr = `${year}-${month}`;

      const { data, error } = await supabase
        .from('historial_precios_competencia')
        .select('*')
        .eq('producto_id', product.id)
        .eq('competidor_id', competitor.id)
        .eq('mes_calendario', currentMonthStr)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Fallo al leer historial de precios:', error.message);
        // Fallback a precios_competencia por si no tienen la tabla de historial creada
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('precios_competencia')
          .select('*')
          .eq('producto_id', product.id)
          .eq('competidor_id', competitor.id)
          .eq('mes_calendario', currentMonthStr);

        if (fallbackError) throw fallbackError;
        setHistoryModal(prev => ({ ...prev, loading: false, records: fallbackData || [] }));
      } else {
        setHistoryModal(prev => ({ ...prev, loading: false, records: data || [] }));
      }
    } catch (err) {
      showToast('Error al cargar historial: ' + err.message, 'error');
      setHistoryModal(prev => ({ ...prev, loading: false }));
    }
  };

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

      // Helper para traer TODOS los registros paginando de 1000 en 1000
      const fetchAll = async (table, filters = []) => {
        let allRows = [];
        let page = 0;
        const PAGE_SIZE = 1000;
        while (true) {
          let query = supabase
            .from(table)
            .select('*')
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
          filters.forEach(({ method, args }) => {
            query = query[method](...args);
          });
          const { data, error } = await query;
          if (error) throw error;
          allRows = allRows.concat(data || []);
          if (!data || data.length < PAGE_SIZE) break;
          page++;
        }
        return allRows;
      };

      // 2. Cargar todos los productos (paginado)
      const prodFilters = [['order', ['descripcion', { ascending: true }]]].map(([m, a]) => ({ method: m, args: a }));
      if (filterCategoria) prodFilters.push({ method: 'eq', args: ['categoria', filterCategoria] });
      const prods = await fetchAll('productos', prodFilters);

      // 3. Cargar todos los precios de competencia (paginado)
      const precFilters = [];
      if (filterFechaInicio) precFilters.push({ method: 'gte', args: ['fecha_captura', filterFechaInicio] });
      if (filterFechaFin) precFilters.push({ method: 'lte', args: ['fecha_captura', filterFechaFin] });
      if (filterCompetidor) precFilters.push({ method: 'eq', args: ['competidor_id', filterCompetidor] });
      const precs = await fetchAll('precios_competencia', precFilters);

      setProductos(prods || []);
      setPreciosCompetencia(precs || []);
    } catch (err) {
      showToast('Error al cargar datos del dashboard: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardData();
  }, [filterCategoria, filterCompetidor, filterFechaInicio, filterFechaFin]);

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
    // Filtro por buscador
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const matchSku = item.sku?.toLowerCase().includes(query);
      const matchDesc = item.descripcion?.toLowerCase().includes(query);
      const matchMarca = item.marca?.toLowerCase().includes(query);
      if (!matchSku && !matchDesc && !matchMarca) {
        return false;
      }
    }
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

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const displayedData = filteredData.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-1 text-slate-700 font-semibold text-sm">
            <Filter className="h-4.5 w-4.5 text-emerald-600" />
            <span>Filtros del Panel</span>
          </div>
        </div>

        {/* Buscador de Producto */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por SKU, descripción o marca..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-medium"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Filtrar Categoría */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Categoría</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={filterCategoria}
              onChange={(e) => { setFilterCategoria(e.target.value); setCurrentPage(1); }}
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
              onChange={(e) => { setFilterCompetidor(e.target.value); setCurrentPage(1); }}
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
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="font-bold text-slate-800 text-sm">Monitoreo de Precios</h3>
          <span className="text-xs text-slate-500 font-medium">
            {filteredData.length > 0
              ? `Página ${safePage} de ${totalPages} — ${filteredData.length} productos encontrados`
              : 'Sin productos'}
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Analizando y cruzando precios del catálogo...
          </div>
        ) : displayedData.length === 0 ? (
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
                {displayedData.map((prod) => {
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
                          <td 
                            key={comp.id} 
                            className={`px-4 py-3.5 text-center font-mono border-l border-slate-100 select-none ${precioComp !== null ? 'cursor-pointer hover:bg-slate-50 group transition-all' : ''}`}
                            onClick={() => precioComp !== null && handleShowHistory(prod, comp)}
                            title={precioComp !== null ? `Ver historial de cambios para ${comp.nombre}` : undefined}
                          >
                            {precioComp !== null ? (
                              <div className="flex flex-col items-center justify-center">
                                <span className="font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">${precioComp.toFixed(2)}</span>
                                <span className="text-[8px] text-slate-400 group-hover:text-emerald-500 font-normal underline decoration-dotted mt-0.5">Historial</span>
                              </div>
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

        {/* Controles de Paginación */}
        {!loading && filteredData.length > PAGE_SIZE && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              Mostrando <span className="font-bold text-slate-700">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredData.length)}</span> de <span className="font-bold text-slate-700">{filteredData.length}</span> productos
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safePage === 1}
                className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
              >
                ‹ Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-2.5 py-1 text-xs rounded border font-semibold transition-colors ${
                        p === safePage
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )
              }
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
              >
                Siguiente ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage === totalPages}
                className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE HISTORIAL DE PRECIOS */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh] text-slate-800">
            
            {/* Cabecera del Modal */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Clock className="h-5.5 w-5.5 text-emerald-100" />
                <div>
                  <h3 className="font-bold text-base">Historial de Precios en el Mes</h3>
                  <p className="text-emerald-100 text-xs mt-0.5">{historyModal.competitorName}</p>
                </div>
              </div>
              <button 
                onClick={() => setHistoryModal(prev => ({ ...prev, isOpen: false }))}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-all"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Medicamento</p>
                  <p className="text-sm font-bold text-slate-800">{historyModal.productName}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Periodo</p>
                  <p className="text-xs font-semibold text-slate-700">
                    {new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {historyModal.loading ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Buscando historial de precios...
                </div>
              ) : historyModal.records.length === 0 ? (
                <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  No se encontraron registros de cambios para este producto este mes.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">Fecha Captura</th>
                        <th className="px-4 py-3 text-right">Precio ($)</th>
                        <th className="px-4 py-3">Quién Registró</th>
                        <th className="px-4 py-3">Tipo Oferta</th>
                        <th className="px-4 py-3">Notas</th>
                        <th className="px-4 py-3 text-right">Creado el</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                      {historyModal.records.map((reg) => (
                        <tr key={reg.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {reg.fecha_captura}
                          </td>
                          <td className="px-4 py-3 text-right font-bold font-mono text-emerald-600 text-xs">
                            ${reg.precio.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 flex items-center space-x-1 mt-0.5">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>{reg.empleado}</span>
                          </td>
                          <td className="px-4 py-3">
                            {reg.tipo_oferta ? (
                              <span className="inline-flex items-center space-x-1 bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-violet-200">
                                <Tag className="h-2.5 w-2.5" />
                                <span>{reg.tipo_oferta}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-300">--</span>
                            )}
                          </td>
                          <td className="px-4 py-3 italic text-slate-500 font-normal">
                            {reg.notas ? (
                              <div className="flex items-center space-x-1 max-w-[150px] truncate" title={reg.notas}>
                                <FileText className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{reg.notas}</span>
                              </div>
                            ) : '--'}
                          </td>
                          <td className="px-4 py-3 text-right text-[10px] text-slate-400 font-mono">
                            {new Date(reg.created_at).toLocaleDateString('es-ES')} {new Date(reg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pie del Modal */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex justify-end">
              <button
                onClick={() => setHistoryModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
