import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Download, AlertTriangle, Search, ChevronRight, TrendingUp, Info } from 'lucide-react';

export default function Reportes({ config, showToast, onSelectProductForCapture }) {
  // Pestañas internas del módulo
  const [activeSubTab, setActiveSubTab] = useState('historial'); // 'historial', 'exportar', 'alertas'

  // --- ESTADO HISTORIAL ---
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyResults, setHistoryResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [historicalPrices, setHistoricalPrices] = useState([]);
  const [competidores, setCompetidores] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // --- ESTADO EXPORTAR ---
  const [exportMonth, setExportMonth] = useState('');
  const [exporting, setExporting] = useState(false);

  // --- ESTADO ALERTAS ---
  const [outdatedProducts, setOutdatedProducts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  useEffect(() => {
    // Inicializar mes actual para exportación (YYYY-MM)
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setExportMonth(currentMonth);

    // Cargar competidores activos
    fetchActiveCompetitors();
  }, []);

  // Cargar alertas e historial si cambia de subpestaña
  useEffect(() => {
    if (activeSubTab === 'alertas') {
      fetchOutdatedProducts();
    }
  }, [activeSubTab]);

  useEffect(() => {
    if (selectedProduct) {
      fetchProductHistory(selectedProduct.id);
    }
  }, [selectedProduct]);

  // Manejo de clics afuera del dropdown de búsqueda
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autocomplete para búsqueda de historial
  useEffect(() => {
    const searchProducts = async () => {
      if (historyQuery.trim().length < 2) {
        setHistoryResults([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('productos')
          .select('*')
          .or(`sku.ilike.%${historyQuery}%,descripcion.ilike.%${historyQuery}%`)
          .limit(5);

        if (error) throw error;
        setHistoryResults(data || []);
      } catch (err) {
        console.error('Error search:', err.message);
      }
    };

    const delayDebounce = setTimeout(() => {
      searchProducts();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [historyQuery]);

  const fetchActiveCompetitors = async () => {
    try {
      const { data, error } = await supabase
        .from('competidores')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) throw error;
      setCompetidores(data || []);
    } catch (err) {
      console.error('Error cargando competidores:', err.message);
    }
  };

  const fetchProductHistory = async (productId) => {
    setLoadingHistory(true);
    try {
      // Obtener todos los registros históricos de competencia para este producto
      const { data, error } = await supabase
        .from('precios_competencia')
        .select('*, competidores(nombre, color)')
        .eq('producto_id', productId)
        .order('fecha_captura', { ascending: true });

      if (error) throw error;

      // Agrupar y ordenar precios históricos
      setHistoricalPrices(data || []);
    } catch (err) {
      showToast('Error al cargar historial: ' + err.message, 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Carga de alertas pendientes (> 30 días sin actualización)
  const fetchOutdatedProducts = async () => {
    setLoadingAlerts(true);
    try {
      // 1. Obtener todos los productos
      const { data: prods, error: prodsError } = await supabase
        .from('productos')
        .select('id, sku, descripcion, marca, categoria, precio_venta');

      if (prodsError) throw prodsError;

      // 2. Obtener precios capturados en los últimos 30 días
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: recentCaptures, error: capError } = await supabase
        .from('precios_competencia')
        .select('producto_id, fecha_captura')
        .gte('fecha_captura', thirtyDaysAgoStr);

      if (capError) throw capError;

      // 3. Obtener la última captura de cada producto en general (para saber la fecha real)
      const { data: allCaptures, error: allCapError } = await supabase
        .from('precios_competencia')
        .select('producto_id, fecha_captura')
        .order('fecha_captura', { ascending: false });

      if (allCapError) throw allCapError;

      // Mapear última fecha
      const lastCaptureMap = {};
      allCaptures?.forEach(c => {
        if (!lastCaptureMap[c.producto_id]) {
          lastCaptureMap[c.producto_id] = c.fecha_captura;
        }
      });

      // Conjunto de IDs con capturas recientes
      const recentProductIds = new Set(recentCaptures?.map(c => c.producto_id) || []);

      // Filtrar productos obsoletos: no están en capturas recientes
      const outdated = prods
        .map(p => ({
          ...p,
          ultimaCaptura: lastCaptureMap[p.id] || null,
          diasTranscurridos: lastCaptureMap[p.id] 
            ? Math.floor((new Date() - new Date(lastCaptureMap[p.id])) / (1000 * 60 * 60 * 24))
            : null
        }))
        .filter(p => !recentProductIds.has(p.id))
        .sort((a, b) => {
          if (!a.ultimaCaptura) return -1;
          if (!b.ultimaCaptura) return 1;
          return b.diasTranscurridos - a.diasTranscurridos;
        });

      setOutdatedProducts(outdated);
    } catch (err) {
      showToast('Error al cargar alertas: ' + err.message, 'error');
    } finally {
      setLoadingAlerts(false);
    }
  };

  // Exportación a CSV
  const handleExportCSV = async () => {
    if (!exportMonth) {
      showToast('Por favor selecciona un mes', 'error');
      return;
    }

    setExporting(true);
    try {
      // 1. Obtener productos
      const { data: prods, error: prodsError } = await supabase
        .from('productos')
        .select('*')
        .order('descripcion', { ascending: true });

      if (prodsError) throw prodsError;

      // 2. Obtener competidores activos
      const { data: comps, error: compsError } = await supabase
        .from('competidores')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (compsError) throw compsError;

      // 3. Obtener precios de competencia de ese mes
      const { data: captures, error: capError } = await supabase
        .from('precios_competencia')
        .select('*')
        .eq('mes_calendario', exportMonth);

      if (capError) throw capError;

      // Filtrar sólo productos que tengan registrados precios de la competencia para el mes seleccionado
      const targetProducts = prods.filter(prod => 
        captures.some(c => c.producto_id === prod.id)
      );

      if (targetProducts.length === 0) {
        showToast('No hay productos con precios de competencia registrados en este mes.', 'warning');
        return;
      }

      // 4. Armar contenido CSV
      // Encabezados
      const headers = [
        'SKU/Barras',
        'Descripcion',
        'Laboratorio',
        'Categoria',
        'Presentacion',
        'Costo Compra',
        'Nuestro Precio Venta',
        'Margen Propio %',
        ...comps.map(c => `Precio ${c.nombre}`),
        'Precio Minimo Competencia',
        'Diferencia vs Minimo %'
      ];

      const csvRows = [headers.join(',')];

      targetProducts.forEach(prod => {
        // Encontrar precios de competidores para este producto
        const pComps = captures.filter(c => c.producto_id === prod.id);
        
        // Mapear c/u
        const preciosComps = comps.map(c => {
          const match = pComps.find(p => p.competidor_id === c.id);
          return match ? match.precio : '';
        });

        // Min y margen
        const preciosValidos = preciosComps.filter(p => p !== '');
        const minComp = preciosValidos.length > 0 ? Math.min(...preciosValidos) : '';
        
        let diffPct = '';
        if (minComp !== '' && prod.precio_venta > 0) {
          diffPct = (((prod.precio_venta - minComp) / minComp) * 100).toFixed(2);
        }

        const margenPropio = prod.precio_venta > 0 
          ? (((prod.precio_venta - prod.costo) / prod.precio_venta) * 100).toFixed(2)
          : '0.00';

        const row = [
          `"${prod.sku}"`,
          `"${prod.descripcion.replace(/"/g, '""')}"`,
          `"${prod.marca.replace(/"/g, '""')}"`,
          `"${prod.categoria}"`,
          `"${prod.presentacion}"`,
          prod.costo.toFixed(2),
          prod.precio_venta.toFixed(2),
          margenPropio,
          ...preciosComps.map(p => (p !== '' ? p.toFixed(2) : '')),
          minComp !== '' ? minComp.toFixed(2) : '',
          diffPct
        ];

        csvRows.push(row.join(','));
      });

      // Descargar archivo
      const csvContent = '\uFEFF' + csvRows.join('\n'); // UTF-8 BOM
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `FarmaPrecios_Reporte_${exportMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Reporte CSV descargado con éxito', 'success');
    } catch (err) {
      showToast('Error al exportar reporte: ' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  // --- PROCESAR DATOS SVG CHART ---
  // Estructurar registros históricos agrupados por mes para el gráfico de líneas.
  // Obtenemos una lista de meses y los precios de cada competidor en ese mes.
  const renderLineChart = () => {
    if (historicalPrices.length === 0) {
      return (
        <div className="py-20 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
          <Info className="h-10 w-10 mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-slate-600">Sin historial registrado para este producto</p>
          <p className="text-xs text-slate-400 mt-1">Registra precios en diferentes meses para ver la evolución.</p>
        </div>
      );
    }

    // 1. Agrupar datos por mes_calendario
    const groupedByMonth = {};
    historicalPrices.forEach(reg => {
      if (!groupedByMonth[reg.mes_calendario]) {
        groupedByMonth[reg.mes_calendario] = {};
      }
      // Si hay más de un precio en el mismo mes, tomamos el más reciente
      groupedByMonth[reg.mes_calendario][reg.competidor_id] = reg.precio;
    });

    // Ordenar los meses cronológicamente
    const meses = Object.keys(groupedByMonth).sort();
    
    // Obtener todos los precios para calcular escalas min/max
    const todosLosPrecios = historicalPrices.map(r => r.precio);
    if (selectedProduct) {
      todosLosPrecios.push(selectedProduct.precio_venta);
    }
    const maxVal = Math.max(...todosLosPrecios) * 1.15; // 15% margen superior
    const minVal = Math.max(0, Math.min(...todosLosPrecios) * 0.85); // 15% margen inferior

    // Dimensiones del SVG
    const width = 600;
    const height = 300;
    const paddingLeft = 50;
    const paddingRight = 30;
    const paddingTop = 30;
    const paddingBottom = 40;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Helper para escalar coordenadas
    const getX = (index) => {
      if (meses.length <= 1) return paddingLeft + chartWidth / 2;
      return paddingLeft + (index / (meses.length - 1)) * chartWidth;
    };

    const getY = (val) => {
      if (maxVal === minVal) return paddingTop + chartHeight / 2;
      return paddingTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
    };

    return (
      <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm">
        <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center">
          <TrendingUp className="h-4.5 w-4.5 text-emerald-600 mr-2" />
          Evolución del precio mes a mes
        </h3>

        <div className="relative overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[500px]">
            {/* Fondo / Cuadrícula horizontal */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = paddingTop + ratio * chartHeight;
              const val = maxVal - ratio * (maxVal - minVal);
              return (
                <g key={i}>
                  <line 
                    x1={paddingLeft} 
                    y1={y} 
                    x2={width - paddingRight} 
                    y2={y} 
                    stroke="#e2e8f0" 
                    strokeDasharray="4 4" 
                  />
                  <text 
                    x={paddingLeft - 8} 
                    y={y + 4} 
                    textAnchor="end" 
                    className="font-mono text-[9px] fill-slate-400 font-bold"
                  >
                    ${val.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Cuadrícula vertical y etiquetas de meses */}
            {meses.map((mes, index) => {
              const x = getX(index);
              return (
                <g key={index}>
                  <line 
                    x1={x} 
                    y1={paddingTop} 
                    x2={x} 
                    y2={paddingTop + chartHeight} 
                    stroke="#f1f5f9" 
                  />
                  <text 
                    x={x} 
                    y={height - paddingBottom + 16} 
                    textAnchor="middle" 
                    className="text-[10px] fill-slate-500 font-medium"
                  >
                    {mes}
                  </text>
                </g>
              );
            })}

            {/* Líneas para cada competidor */}
            {competidores.map((comp) => {
              const puntos = meses
                .map((mes, index) => {
                  const precio = groupedByMonth[mes][comp.id];
                  return precio !== undefined ? { x: getX(index), y: getY(precio), val: precio } : null;
                })
                .filter(p => p !== null);

              if (puntos.length === 0) return null;

              // Crear string de la ruta
              const dStr = puntos.reduce((acc, p, idx) => {
                return acc + `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y} `;
              }, '');

              return (
                <g key={comp.id}>
                  {/* Línea */}
                  <path 
                    d={dStr} 
                    fill="none" 
                    stroke={comp.color} 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                  {/* Puntos y Hover values */}
                  {puntos.map((p, idx) => (
                    <g key={idx}>
                      <circle 
                        cx={p.x} 
                        cy={p.y} 
                        r="4" 
                        fill="white" 
                        stroke={comp.color} 
                        strokeWidth="2" 
                      />
                      <text
                        x={p.x}
                        y={p.y - 8}
                        textAnchor="middle"
                        className="font-mono text-[9px] font-bold fill-slate-700"
                      >
                        ${p.val.toFixed(1)}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })}

            {/* Línea horizontal de NUESTRO precio de venta (para referencia de comparación constante) */}
            {selectedProduct && (
              <g>
                <line 
                  x1={paddingLeft} 
                  y1={getY(selectedProduct.precio_venta)} 
                  x2={width - paddingRight} 
                  y2={getY(selectedProduct.precio_venta)} 
                  stroke="#10B981" 
                  strokeWidth="2" 
                  strokeDasharray="5 3" 
                />
                <rect 
                  x={width - paddingRight - 80} 
                  y={getY(selectedProduct.precio_venta) - 18} 
                  width="78" 
                  height="14" 
                  rx="3" 
                  fill="#10B981" 
                />
                <text 
                  x={width - paddingRight - 41} 
                  y={getY(selectedProduct.precio_venta) - 8} 
                  textAnchor="middle" 
                  className="fill-white text-[8px] font-bold uppercase tracking-wider"
                >
                  Ntro: ${selectedProduct.precio_venta.toFixed(2)}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Acotaciones / Leyenda de Competidores */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs justify-center">
          <div className="flex items-center space-x-1.5 font-medium">
            <span className="w-3 h-3 bg-emerald-500 border-2 border-dashed border-emerald-700 rounded-full" />
            <span className="text-emerald-700 font-bold">Nuestro Precio</span>
          </div>
          {competidores.map((comp) => {
            const hasData = historicalPrices.some(h => h.competidor_id === comp.id);
            if (!hasData) return null;
            return (
              <div key={comp.id} className="flex items-center space-x-1.5 text-slate-600 font-medium">
                <span className="w-3.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: comp.color }} />
                <span>{comp.nombre}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Historial y Reportes</h1>
          <p className="text-slate-500 text-sm">Visualiza la evolución de precios, descarga reportes y atiende alertas de actualizaciones pendientes.</p>
        </div>
      </div>

      {/* Tabs Internas */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveSubTab('historial')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-all ${activeSubTab === 'historial' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          >
            Historial por Medicamento
          </button>
          <button
            onClick={() => setActiveSubTab('exportar')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-all ${activeSubTab === 'exportar' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          >
            Exportar CSV Mensual
          </button>
          <button
            onClick={() => setActiveSubTab('alertas')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-all ${activeSubTab === 'alertas' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          >
            Alertas de Actualización
            {outdatedProducts.length > 0 && (
              <span className="ml-1.5 bg-red-100 text-red-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {outdatedProducts.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* --- VISTA: HISTORIAL POR MEDICAMENTO --- */}
      {activeSubTab === 'historial' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" ref={dropdownRef}>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Buscar medicamento para ver su gráfico histórico:
            </label>
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Ej. Aspirina, Ibuprofeno..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                value={historyQuery}
                onChange={(e) => {
                  setHistoryQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
              
              {showDropdown && historyResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {historyResults.map((prod) => (
                    <div
                      key={prod.id}
                      className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-sm border-b border-slate-100 last:border-0"
                      onClick={() => {
                        setSelectedProduct(prod);
                        setHistoryQuery(prod.descripcion);
                        setShowDropdown(false);
                      }}
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{prod.descripcion}</p>
                        <p className="text-xs text-slate-400">Marca: {prod.marca}</p>
                      </div>
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{prod.sku}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedProduct ? (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-slate-800">{selectedProduct.descripcion}</h2>
                  <p className="text-xs text-slate-500">Laboratorio: {selectedProduct.marca} • SKU: {selectedProduct.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-medium">Nuestro Precio de Venta</p>
                  <p className="text-lg font-bold text-slate-900 font-mono">${selectedProduct.precio_venta.toFixed(2)}</p>
                </div>
              </div>

              {loadingHistory ? (
                <div className="py-20 text-center text-slate-400 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Cargando evolución de precios...
                </div>
              ) : (
                renderLineChart()
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-xl shadow-sm">
              Selecciona un medicamento para graficar su comportamiento histórico.
            </div>
          )}
        </div>
      )}

      {/* --- VISTA: EXPORTAR CSV MENSUAL --- */}
      {activeSubTab === 'exportar' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-lg">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Exportar Comparativa a CSV</h2>
          <p className="text-slate-500 text-xs mb-6">
            Genera un archivo CSV legible en Excel con la lista completa de medicamentos, tus precios propios, y la captura más reciente de cada competidor para el mes seleccionado.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Selecciona Mes Calendario
              </label>
              <div className="relative max-w-xs">
                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-slate-400 pointer-events-none" />
                <input
                  type="month"
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={exportMonth}
                  onChange={(e) => setExportMonth(e.target.value)}
                />
              </div>
            </div>

            <button
              disabled={exporting}
              onClick={handleExportCSV}
              className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm text-sm flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <Download className="h-4.5 w-4.5" />
              <span>{exporting ? 'Generando CSV...' : 'Descargar Reporte CSV'}</span>
            </button>
          </div>
        </div>
      )}

      {/* --- VISTA: ALERTAS DE ACTUALIZACIÓN PENDIENTE --- */}
      {activeSubTab === 'alertas' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-800 mb-2">
            <AlertTriangle className="h-5.5 w-5.5 text-red-500" />
            <h2 className="text-lg font-bold">Medicamentos sin Actualizar (más de 30 días)</h2>
          </div>
          <p className="text-slate-500 text-xs mb-6">
            Los siguientes productos no registran capturas de precios de competencia en el transcurso de los últimos 30 días. Es recomendable capturar nuevos datos.
          </p>

          {loadingAlerts ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Buscando productos desactualizados...
            </div>
          ) : outdatedProducts.length === 0 ? (
            <div className="py-8 text-center text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl text-sm font-medium">
              ✨ ¡Felicidades! Todos los productos de la farmacia tienen precios de competencia capturados recientemente en los últimos 30 días.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="w-full border-collapse text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">Medicamento</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3 text-right font-mono">Última Captura</th>
                    <th className="px-4 py-3 text-right">Días Transcurridos</th>
                    <th className="px-6 py-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outdatedProducts.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 font-semibold text-slate-800">
                        <div>{prod.descripcion}</div>
                        <div className="text-[10px] text-slate-400 font-normal font-mono">{prod.sku} • {prod.marca}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                          {prod.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {prod.ultimaCaptura ? prod.ultimaCaptura : <span className="text-red-500 italic">Nunca capturado</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600 font-mono">
                        {prod.diasTranscurridos !== null ? `${prod.diasTranscurridos} días` : '--'}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => onSelectProductForCapture(prod)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold py-1 px-3 rounded-lg text-xs flex items-center space-x-1.5 mx-auto transition-colors"
                        >
                          <span>Capturar</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
