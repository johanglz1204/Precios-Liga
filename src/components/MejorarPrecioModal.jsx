import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  X,
  Percent,
  ShieldCheck,
  AlertTriangle,
  TrendingDown,
  ArrowRight,
  Check,
  Loader2,
  Users,
  DollarSign,
  Calculator,
  Info
} from 'lucide-react';

/**
 * MejorarPrecioModal
 * 
 * Modal interactivo para calcular un precio competitivo en tiempo real.
 * Asegura NUNCA violar el margen mínimo global sobre el costo de adquisición.
 *
 * Props:
 *  - product       : Objeto del producto { id, sku, descripcion, costo, precio_venta }
 *  - config        : Configuración global { margen_minimo, ... }
 *  - showToast     : Función para mostrar notificaciones
 *  - onClose       : Callback para cerrar el modal
 *  - onPriceUpdated: Callback tras aplicar un nuevo precio (cierra modal + recarga tabla)
 */
export default function MejorarPrecioModal({ product, config, showToast, onClose, onPriceUpdated }) {

  // ── Estado local ────────────────────────────────────────────────────
  const [competidores, setCompetidores] = useState([]);
  const [loadingComps, setLoadingComps] = useState(true);
  const [selectedCompetidor, setSelectedCompetidor] = useState('');
  const [precioCompetidor, setPrecioCompetidor] = useState('');
  const [applying, setApplying] = useState(false);

  // ── Cargar competidores activos al montar ───────────────────────────
  useEffect(() => {
    const fetchCompetidores = async () => {
      setLoadingComps(true);
      try {
        const { data, error } = await supabase
          .from('competidores')
          .select('id, nombre, color')
          .eq('activo', true)
          .order('nombre', { ascending: true });

        if (error) throw error;
        setCompetidores(data || []);
      } catch (err) {
        showToast('Error al cargar competidores: ' + err.message, 'error');
      } finally {
        setLoadingComps(false);
      }
    };
    fetchCompetidores();
  }, []);

  // ── Cerrar con Escape ───────────────────────────────────────────────
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // ── Cálculos en tiempo real ─────────────────────────────────────────
  const costo = product.costo || 0;
  const precioVentaActual = product.precio_venta || 0;
  const margenGlobal = config.margen_minimo || 0;

  const calculo = useMemo(() => {
    const precioComp = parseFloat(precioCompetidor);
    if (!precioCompetidor || isNaN(precioComp) || precioComp <= 0) {
      return null; // Sin datos suficientes para calcular
    }

    // Precio mínimo permitido (piso): Costo × (1 + margen / 100)
    const precioMinimo = costo * (1 + margenGlobal / 100);

    // Evaluación
    const esSeguro = precioComp >= precioMinimo;

    // Precio sugerido
    const precioSugerido = esSeguro ? precioComp : precioMinimo;

    // Margen resultante si se aplicara el precio sugerido
    const margenResultante = precioSugerido > 0
      ? ((precioSugerido - costo) / precioSugerido) * 100
      : 0;

    // Diferencia porcentual vs precio actual
    const diferenciaPct = precioVentaActual > 0
      ? ((precioSugerido - precioVentaActual) / precioVentaActual) * 100
      : 0;

    return {
      precioComp,
      precioMinimo,
      esSeguro,
      precioSugerido,
      margenResultante,
      diferenciaPct
    };
  }, [precioCompetidor, costo, margenGlobal, precioVentaActual]);

  // ── Aplicar nuevo precio ────────────────────────────────────────────
  const handleAplicarPrecio = async () => {
    if (!calculo || !calculo.esSeguro) return;

    setApplying(true);
    try {
      const { error } = await supabase
        .from('productos')
        .update({
          precio_venta: parseFloat(calculo.precioSugerido.toFixed(2)),
          fecha_actualizacion_precio: new Date().toISOString()
        })
        .eq('id', product.id);

      if (error) throw error;

      showToast(
        `Precio de "${product.descripcion}" actualizado a $${calculo.precioSugerido.toFixed(2)}`,
        'success'
      );
      onPriceUpdated();
    } catch (err) {
      showToast('Error al actualizar precio: ' + err.message, 'error');
    } finally {
      setApplying(false);
    }
  };

  // ── Helper: formateo de moneda ──────────────────────────────────────
  const fmt = (n) => `$${Number(n).toFixed(2)}`;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mejora-precio-titulo"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Panel del Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slideUp">

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 text-white shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
                <Percent className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 id="mejora-precio-titulo" className="font-bold text-base tracking-tight">
                  Calculadora de Precio Competitivo
                </h2>
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mt-0.5">
                  Optimidad de Precios
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Info del producto */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Producto</p>
              <p className="text-sm font-bold text-white truncate" title={product.descripcion}>
                {product.descripcion}
              </p>
              <p className="text-xs font-mono text-slate-400 mt-0.5">{product.sku}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Costo</p>
                <p className="text-sm font-bold font-mono text-amber-400">{fmt(costo)}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">P. Venta</p>
                <p className="text-sm font-bold font-mono text-emerald-400">{fmt(precioVentaActual)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto min-h-0">

          {/* Formulario de entrada */}
          <div className="space-y-4">

            {/* Selector de competidor */}
            <div>
              <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <span>Competidor</span>
              </label>
              {loadingComps ? (
                <div className="flex items-center space-x-2 text-sm text-slate-400 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Cargando competidores...</span>
                </div>
              ) : (
                <select
                  value={selectedCompetidor}
                  onChange={(e) => setSelectedCompetidor(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-white transition-shadow"
                >
                  <option value="">— Selecciona un competidor —</option>
                  {competidores.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Input de precio del competidor */}
            <div>
              <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                <span>Precio del Competidor ($)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={precioCompetidor}
                  onChange={(e) => setPrecioCompetidor(e.target.value)}
                  className="w-full pl-7 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono text-right transition-shadow"
                  autoFocus
                />
              </div>
            </div>
          </div>

          {/* ── ÁREA DE RESULTADOS EN TIEMPO REAL ────────────────── */}
          {calculo && (
            <div className={`rounded-xl border-2 p-4 space-y-4 transition-all duration-300 ${
              calculo.esSeguro
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}>

              {/* Badge de estado */}
              <div className="flex items-center justify-between">
                <div className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  calculo.esSeguro
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {calculo.esSeguro
                    ? <><ShieldCheck className="h-3.5 w-3.5" /><span>Margen Seguro</span></>
                    : <><AlertTriangle className="h-3.5 w-3.5" /><span>Alerta de Pérdida</span></>
                  }
                </div>
                <span className={`text-xs font-semibold ${calculo.esSeguro ? 'text-emerald-600' : 'text-red-600'}`}>
                  Margen mínimo: {margenGlobal}%
                </span>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-3 gap-3">
                {/* Precio Mínimo (Piso) */}
                <div className="bg-white/80 rounded-lg px-3 py-2 border border-slate-200/60">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Piso Mínimo</p>
                  <p className="text-sm font-bold font-mono text-slate-700">{fmt(calculo.precioMinimo)}</p>
                </div>

                {/* Precio Sugerido */}
                <div className={`rounded-lg px-3 py-2 border ${
                  calculo.esSeguro
                    ? 'bg-emerald-100/80 border-emerald-200'
                    : 'bg-red-100/80 border-red-200'
                }`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                    calculo.esSeguro ? 'text-emerald-600' : 'text-red-600'
                  }`}>Precio Sugerido</p>
                  <p className={`text-sm font-bold font-mono ${
                    calculo.esSeguro ? 'text-emerald-800' : 'text-red-800'
                  }`}>{fmt(calculo.precioSugerido)}</p>
                </div>

                {/* Margen Resultante */}
                <div className="bg-white/80 rounded-lg px-3 py-2 border border-slate-200/60">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Margen Result.</p>
                  <p className={`text-sm font-bold font-mono ${
                    calculo.margenResultante >= margenGlobal ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {calculo.margenResultante.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Visualización de flujo de precios */}
              <div className="flex items-center justify-center space-x-3 text-xs font-semibold py-1">
                <div className="text-center">
                  <p className="text-slate-400 uppercase tracking-wider text-[10px]">Actual</p>
                  <p className="font-mono text-slate-700">{fmt(precioVentaActual)}</p>
                </div>
                <ArrowRight className={`h-4 w-4 ${calculo.esSeguro ? 'text-emerald-500' : 'text-red-400'}`} />
                <div className="text-center">
                  <p className={`uppercase tracking-wider text-[10px] ${calculo.esSeguro ? 'text-emerald-500' : 'text-red-500'}`}>Nuevo</p>
                  <p className={`font-mono font-bold ${calculo.esSeguro ? 'text-emerald-700' : 'text-red-700'}`}>
                    {fmt(calculo.precioSugerido)}
                  </p>
                </div>
                <span className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  calculo.diferenciaPct < 0
                    ? 'bg-red-100 text-red-600'
                    : calculo.diferenciaPct > 0
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-slate-100 text-slate-500'
                }`}>
                  {calculo.diferenciaPct >= 0 ? '+' : ''}{calculo.diferenciaPct.toFixed(1)}%
                </span>
              </div>

              {/* Mensaje de alerta (solo CASO B) */}
              {!calculo.esSeguro && (
                <div className="flex items-start space-x-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-red-700 leading-relaxed">
                    <p className="font-bold">¡Advertencia!</p>
                    <p>
                      El precio del competidor ({fmt(calculo.precioComp)}) está por debajo del margen
                      mínimo global permitido ({margenGlobal}%). El precio mínimo que podemos
                      ofrecer es <strong className="font-mono">{fmt(calculo.precioMinimo)}</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Indicador cuando no hay datos suficientes */}
          {!calculo && precioCompetidor === '' && (
            <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
              <Info className="h-4 w-4 flex-shrink-0" />
              <p>Ingresa el precio del competidor para ver el análisis en tiempo real.</p>
            </div>
          )}
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={handleAplicarPrecio}
            disabled={!calculo || !calculo.esSeguro || applying || !selectedCompetidor}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 shadow-sm ${
              calculo && calculo.esSeguro && selectedCompetidor
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-md active:scale-[0.98]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title={
              !selectedCompetidor
                ? 'Selecciona un competidor primero'
                : !calculo
                  ? 'Ingresa un precio del competidor'
                  : !calculo.esSeguro
                    ? 'No se puede aplicar: el precio viola el margen mínimo'
                    : 'Aplicar nuevo precio de venta'
            }
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Aplicando...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Aplicar Precio</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
