import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Plus, Edit2, Trash2, Save, X, ChevronLeft, ChevronRight, Calculator, Calendar, FileSpreadsheet, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Productos({ config, showToast }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Paginación y búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const autocompleteRef = useRef(null);
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const downloadTemplate = () => {
    try {
      const templateData = [
        {
          'Codigo': '7501002003001',
          'Descripcion': 'Paracetamol 500mg 10 Tabs',
          'CNC': 10.50,
          'PMSTDR': 15.00
        },
        {
          'Codigo': '7501002003002',
          'Descripcion': 'Ibuprofeno 400mg 10 Caps',
          'CNC': 12.00,
          'PMSTDR': 18.00
        }
      ];
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
      XLSX.writeFile(workbook, 'plantilla_productos.xlsx');
      showToast('Plantilla descargada con éxito', 'success');
    } catch (err) {
      showToast('Error al descargar plantilla: ' + err.message, 'error');
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonData || jsonData.length === 0) {
          showToast('El archivo de Excel está vacío.', 'error');
          setImporting(false);
          return;
        }

        const normalizedRows = jsonData.map(row => {
          const normalized = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (cleanKey === 'codigo') {
              normalized.sku = String(row[key]).trim();
            } else if (cleanKey === 'descripcion') {
              normalized.descripcion = String(row[key]).trim();
            } else if (cleanKey === 'cnc') {
              normalized.costo = parseFloat(row[key]);
            } else if (cleanKey === 'pmstdr') {
              normalized.precio_venta = parseFloat(row[key]);
            }
          });
          return normalized;
        });

        const validRows = normalizedRows.filter(row => row.sku && row.descripcion);

        if (validRows.length === 0) {
          showToast('No se encontraron productos válidos. Asegúrate de incluir las columnas: Codigo, Descripcion, CNC, PMSTDR.', 'error');
          setImporting(false);
          return;
        }

        const payloads = validRows.map(row => ({
          sku: row.sku,
          descripcion: row.descripcion,
          marca: 'Genérico',
          categoria: config.categorias?.[0] || 'Analgésicos',
          presentacion: 'Otro',
          unidad_medida: 'pz',
          costo: isNaN(row.costo) ? 0 : row.costo,
          precio_venta: isNaN(row.precio_venta) ? 0 : row.precio_venta,
          fecha_actualizacion_precio: new Date().toISOString()
        }));

        const { error } = await supabase
          .from('productos')
          .upsert(payloads, { onConflict: 'sku' });

        if (error) throw error;

        showToast(`Se importaron/actualizaron ${payloads.length} productos correctamente.`, 'success');
        fetchProductos();
      } catch (err) {
        showToast('Error al procesar el Excel: ' + err.message, 'error');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    
    reader.onerror = () => {
      showToast('Error al leer el archivo.', 'error');
      setImporting(false);
    };

    reader.readAsBinaryString(file);
  };


  // Filtros de tabla
  const [filterCategoria, setFilterCategoria] = useState('');

  // Estado del formulario
  const [editingId, setEditingId] = useState(null);
  const [sku, setSku] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [marca, setMarca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [presentacion, setPresentacion] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('pz');
  const [costo, setCosto] = useState('0.00');
  const [precioVenta, setPrecioVenta] = useState('0.00');
  const [margen, setMargen] = useState(0);

  // Presentaciones sugeridas
  const presentacionesSugeridas = ['Tabletas', 'Cápsulas', 'Jarabe', 'Crema', 'Ungüento', 'Solución Inyectable', 'Gotas', 'Polvo', 'Spray', 'Gel', 'Parche', 'Otro'];
  // Unidades de medida sugeridas
  const unidadesSugeridas = ['pz', 'caja', 'frasco', 'tubo', 'ampolleta', 'ml', 'g'];

  useEffect(() => {
    fetchProductos();
  }, [currentPage, filterCategoria]);

  // Manejo de autocompletado en base a búsqueda en tiempo real
  useEffect(() => {
    const fetchAutocompleteResults = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        // Buscar productos por SKU o descripción
        const { data, error } = await supabase
          .from('productos')
          .select('id, sku, descripcion, marca')
          .or(`sku.ilike.%${searchQuery}%,descripcion.ilike.%${searchQuery}%`)
          .limit(5);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error('Error autocomplete:', err.message);
      }
    };

    const delayDebounce = setTimeout(() => {
      fetchAutocompleteResults();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Cerrar autocompletado al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target)) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recalcular margen en tiempo real
  useEffect(() => {
    const c = parseFloat(costo) || 0;
    const v = parseFloat(precioVenta) || 0;
    if (v > 0) {
      const marg = ((v - c) / v) * 100;
      setMargen(marg.toFixed(2));
    } else {
      setMargen(0);
    }
  }, [costo, precioVenta]);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('productos')
        .select('*', { count: 'exact' });

      // Aplicar filtros
      if (filterCategoria) {
        query = query.eq('categoria', filterCategoria);
      }

      if (searchQuery && searchQuery.trim().length >= 2) {
        query = query.or(`sku.ilike.%${searchQuery}%,descripcion.ilike.%${searchQuery}%`);
      }

      // Ordenar por descripción
      query = query
        .order('descripcion', { ascending: true })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      setProductos(data || []);
      setTotalItems(count || 0);
    } catch (err) {
      showToast('Error al cargar productos: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setShowAutocomplete(false);
    setCurrentPage(1);
    fetchProductos();
  };

  const handleAutocompleteSelect = (prod) => {
    setSearchQuery(prod.descripcion);
    setShowAutocomplete(false);
    // Filtrar la tabla a este producto específico
    setCurrentPage(1);
    // Ejecutar búsqueda inmediata
    setTimeout(() => {
      fetchProductos();
    }, 50);
  };

  const resetForm = () => {
    setEditingId(null);
    setSku('');
    setDescripcion('');
    setMarca('');
    setCategoria(config.categorias?.[0] || 'Analgésicos');
    setPresentacion(presentacionesSugeridas[0]);
    setUnidadMedida(unidadesSugeridas[0]);
    setCosto('0.00');
    setPrecioVenta('0.00');
    setMargen(0);
  };

  // Inicializar categoría si config cambia
  useEffect(() => {
    if (config.categorias && config.categorias.length > 0 && !categoria) {
      setCategoria(config.categorias[0]);
    }
  }, [config]);

  const handleEdit = (prod) => {
    setEditingId(prod.id);
    setSku(prod.sku);
    setDescripcion(prod.descripcion);
    setMarca(prod.marca);
    setCategoria(prod.categoria);
    setPresentacion(prod.presentacion);
    setUnidadMedida(prod.unidad_medida);
    setCosto(prod.costo.toString());
    setPrecioVenta(prod.precio_venta.toString());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sku.trim() || !descripcion.trim()) {
      showToast('Por favor complete los campos obligatorios (SKU, Descripción)', 'error');
      return;
    }

    const payload = {
      sku: sku.trim(),
      descripcion: descripcion.trim(),
      marca: marca ? marca.trim() : 'Genérico',
      categoria: categoria || config.categorias?.[0] || 'Analgésicos',
      presentacion: presentacion || 'Otro',
      unidad_medida: unidadMedida || 'pz',
      costo: parseFloat(costo) || 0,
      precio_venta: parseFloat(precioVenta) || 0,
      fecha_actualizacion_precio: new Date().toISOString()
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('productos')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        showToast('Producto actualizado con éxito', 'success');
      } else {
        const { error } = await supabase
          .from('productos')
          .insert([payload]);

        if (error) throw error;
        showToast('Producto registrado con éxito', 'success');
      }
      resetForm();
      fetchProductos();
    } catch (err) {
      showToast('Error al guardar producto: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto? Se eliminará del catálogo y su historial de precios de competencia.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Producto eliminado con éxito', 'success');
      fetchProductos();
      if (editingId === id) resetForm();
    } catch (err) {
      showToast('Error al eliminar producto: ' + err.message, 'error');
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setCurrentPage(1);
    // Forzar recarga sin búsqueda
    setTimeout(() => {
      fetchProductos();
    }, 50);
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Catálogo de Productos y Precios Propios</h1>
          <p className="text-slate-500 text-sm">Gestiona el catálogo de medicamentos, sus especificaciones y tus márgenes de ganancia.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelUpload}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <button
            type="button"
            onClick={downloadTemplate}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg text-sm transition-colors border border-slate-300 flex items-center space-x-1"
            title="Descargar plantilla de Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Descargar Plantilla</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm text-sm transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            {importing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span>Cargar Excel</span>
          </button>
        </div>
      </div>


      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Formulario de registro/edición (1 columna en pantallas xl, stacks en menores) */}
        <div className="xl:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            {editingId ? <Edit2 className="h-5 w-5 mr-2 text-emerald-600" /> : <Plus className="h-5 w-5 mr-2 text-emerald-600" />}
            {editingId ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Código SKU / Barras *</label>
              <input
                type="text"
                placeholder="Ej. 750100200300"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Descripción / Nombre Comercial *</label>
              <input
                type="text"
                placeholder="Ej. Paracetamol 500mg"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
              />
            </div>



            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Unidad de Medida</label>
              <select
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
                value={unidadMedida}
                onChange={(e) => setUnidadMedida(e.target.value)}
              >
                {unidadesSugeridas.map((uni) => (
                  <option key={uni} value={uni}>{uni}</option>
                ))}
              </select>
            </div>

            {/* SECCIÓN PRECIOS PROPIOS */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-700 flex items-center">
                <Calculator className="h-4 w-4 mr-1 text-emerald-600" />
                Precios Propios
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Costo Compra ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono text-right"
                    value={costo}
                    onChange={(e) => setCosto(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Precio Venta ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono text-right"
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(e.target.value)}
                  />
                </div>
              </div>

              {/* Margen Calculado */}
              <div className="flex justify-between items-center text-xs py-1 border-t border-slate-200">
                <span className="text-slate-500 font-medium">Margen Calculado:</span>
                <span className={`font-bold px-2 py-0.5 rounded font-mono ${margen >= config.margen_minimo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {margen}%
                </span>
              </div>
              <p className="text-[10px] text-slate-400 italic">Mínimo sugerido: {config.margen_minimo}%</p>
            </div>

            <div className="flex space-x-2 pt-2 border-t border-slate-100">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm text-sm flex items-center justify-center space-x-1"
              >
                <Save className="h-4 w-4" />
                <span>{editingId ? 'Actualizar' : 'Guardar'}</span>
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

        {/* Listado y Tabla de productos (3 columnas) */}
        <div className="xl:col-span-3 space-y-4">
          
          {/* Barra de Filtros y Búsqueda */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Buscador con autocompletado */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-lg" ref={autocompleteRef}>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por SKU o descripción..."
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowAutocomplete(true);
                  }}
                  onFocus={() => setShowAutocomplete(true)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-sm font-semibold"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Dropdown de Autocompletado */}
              {showAutocomplete && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((prod) => (
                    <div
                      key={prod.id}
                      className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-sm border-b border-slate-100 last:border-0"
                      onClick={() => handleAutocompleteSelect(prod)}
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
            </form>

            {/* Filtro por Categoría */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoría:</span>
              <select
                className="px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs bg-white"
                value={filterCategoria}
                onChange={(e) => {
                  setFilterCategoria(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">Todas</option>
                {config.categorias?.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabla de Productos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">SKU / Descripción</th>
                    <th className="px-4 py-3.5 text-right">Costo</th>
                    <th className="px-4 py-3.5 text-right">Precio Venta</th>
                    <th className="px-4 py-3.5 text-center">Margen</th>
                    <th className="px-4 py-3.5">Última Act.</th>
                    <th className="px-6 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Buscando productos en catálogo...
                      </td>
                    </tr>
                  ) : productos.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                        Ningún producto encontrado en esta categoría o búsqueda.
                      </td>
                    </tr>
                  ) : (
                    productos.map((prod) => {
                      const c = prod.costo || 0;
                      const v = prod.precio_venta || 0;
                      const marg = v > 0 ? (((v - c) / v) * 100).toFixed(1) : '0.0';
                      const isMargenOk = parseFloat(marg) >= config.margen_minimo;
                      const formattedDate = prod.fecha_actualizacion_precio
                        ? new Date(prod.fecha_actualizacion_precio).toLocaleDateString('es-MX', {
                            day: 'numeric',
                            month: 'short',
                            year: '2-digit'
                          })
                        : 'N/A';

                      return (
                        <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">{prod.descripcion}</div>
                            <div className="text-xs font-mono text-slate-400">{prod.sku} <span className="text-slate-400">({prod.unidad_medida})</span></div>
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-xs font-medium">${c.toFixed(2)}</td>
                          <td className="px-4 py-4 text-right font-mono text-sm font-semibold text-slate-900">${v.toFixed(2)}</td>
                          <td className="px-4 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${isMargenOk ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                              {marg}%
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-400 font-medium">
                            <div className="flex items-center space-x-1" title={prod.fecha_actualizacion_precio}>
                              <Calendar className="h-3 w-3" />
                              <span>{formattedDate}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => handleEdit(prod)}
                              className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4 inline" />
                            </button>
                            <button
                              onClick={() => handleDelete(prod.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalItems > itemsPerPage && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  Mostrando <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
                  <span className="font-semibold">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de{' '}
                  <span className="font-semibold">{totalItems}</span> productos
                </div>
                <div className="flex space-x-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg flex items-center justify-center">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
