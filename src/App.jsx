import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import SupabaseSetup from './components/SupabaseSetup';
import Dashboard from './components/Dashboard';
import Productos from './components/Productos';
import PreciosCompetencia from './components/PreciosCompetencia';
import Competidores from './components/Competidores';
import Reportes from './components/Reportes';
import Configuracion from './components/Configuracion';
import { 
  LayoutDashboard, 
  Pill, 
  DollarSign, 
  Users, 
  BarChart3, 
  Settings, 
  AlertTriangle, 
  Database,
  RefreshCw,
  Bell
} from 'lucide-react';

export default function App() {
  const [supabaseConnected, setSupabaseConnected] = useState(isSupabaseConfigured);
  const [dbMissingTables, setDbMissingTables] = useState(false);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Enrutamiento SPA
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Producto seleccionado para pre-cargar en Captura de Precios
  const [captureSelectedProduct, setCaptureSelectedProduct] = useState(null);

  // Sistema de Notificaciones (Toasts)
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    // Auto ocultar después de 4 segundos
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  useEffect(() => {
    if (supabaseConnected) {
      fetchConfig();
    } else {
      setLoading(false);
    }
  }, [supabaseConnected]);

  const fetchConfig = async () => {
    setLoading(true);
    setDbMissingTables(false);
    try {
      // Intentar leer la fila 1 de configuración
      const { data, error } = await supabase
        .from('configuracion')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        // Código de error 42P01 en PostgreSQL significa que la tabla no existe
        if (error.code === '42P01') {
          setDbMissingTables(true);
          return;
        }
        throw error;
      }

      if (data) {
        setConfig(data);
      } else {
        // Si no existe, crear la fila 1 inicial con valores por defecto
        const defaultPayload = {
          id: 1,
          nombre_farmacia: 'Farmacia Local',
          margen_minimo: 20.0
        };
        const { data: insertedData, error: insertError } = await supabase
          .from('configuracion')
          .insert([defaultPayload])
          .select()
          .single();

        if (insertError) throw insertError;
        setConfig(insertedData);
      }
    } catch (err) {
      showToast('Error al conectar con la base de datos: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Callback del asistente de setup
  const handleOnConfigured = () => {
    setSupabaseConnected(true);
    window.location.reload(); // Recargar para inicializar el cliente Supabase con las nuevas credenciales en localStorage
  };

  // Atender click en Alertas para ir a capturar
  const handleSelectProductForCapture = (product) => {
    setCaptureSelectedProduct(product);
    setActiveTab('precios-competencia');
  };

  // Si no hay configuración de Supabase, cargar Setup Wizard
  if (!supabaseConnected) {
    return <SupabaseSetup onConfigured={handleOnConfigured} />;
  }

  // Si las tablas no existen
  if (dbMissingTables) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-red-200">
          <div className="bg-red-600 px-6 py-4 text-white flex items-center space-x-2">
            <AlertTriangle className="h-6 w-6 text-red-100" />
            <h1 className="text-xl font-bold">Tablas Faltantes en Supabase</h1>
          </div>
          
          <div className="p-6 space-y-4">
            <p className="text-slate-600 text-sm leading-relaxed">
              La conexión con Supabase se estableció correctamente, pero las tablas necesarias para FarmaPrecios no existen en tu base de datos.
            </p>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs font-mono text-slate-700">
              <p className="font-semibold text-slate-900 mb-1">Instrucciones:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Abre tu panel de Supabase.</li>
                <li>Ve a la pestaña <strong>SQL Editor</strong> &gt; <strong>New Query</strong>.</li>
                <li>Pega el contenido del script <strong className="text-emerald-700 font-bold bg-slate-100 px-1 py-0.5 rounded">schema.sql</strong> ubicado en la raíz del proyecto.</li>
                <li>Haz clic en <strong>Run</strong> para inicializar las tablas de la farmacia.</li>
              </ol>
            </div>
            
            <button
              onClick={fetchConfig}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center space-x-1"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Verificar nuevamente</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard config={config} showToast={showToast} />;
      case 'productos':
        return <Productos config={config} showToast={showToast} />;
      case 'precios-competencia':
        return (
          <PreciosCompetencia 
            config={config} 
            showToast={showToast} 
            key={captureSelectedProduct ? captureSelectedProduct.id : 'PC-Grid'} 
          />
        );
      case 'competidores':
        return <Competidores showToast={showToast} />;
      case 'reportes':
        return (
          <Reportes 
            config={config} 
            showToast={showToast} 
            onSelectProductForCapture={handleSelectProductForCapture} 
          />
        );
      case 'configuracion':
        return (
          <Configuracion 
            config={config} 
            onConfigUpdated={fetchConfig} 
            showToast={showToast} 
          />
        );
      default:
        return <Dashboard config={config} showToast={showToast} />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard Comparativo', icon: LayoutDashboard },
    { id: 'productos', label: 'Catálogo y Precios', icon: Pill },
    { id: 'precios-competencia', label: 'Captura Competencia', icon: DollarSign },
    { id: 'competidores', label: 'Competidores', icon: Users },
    { id: 'reportes', label: 'Gráficos y Reportes', icon: BarChart3 },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0 shadow-xl z-20">
        <div>
          {/* Logo / Header */}
          <div className="bg-slate-950 px-6 py-5 border-b border-slate-800 flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-600 rounded-lg">
              <Pill className="h-5 w-5 text-white animate-bounce" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm tracking-tight text-white uppercase">FarmaPrecios</h2>
              <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Monitor Competitivo</p>
            </div>
          </div>

          {/* Menú de Tabs */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'precios-competencia') {
                      setCaptureSelectedProduct(null); // Resetear selección al cambiar de pestaña
                    }
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-150 ${isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1.5 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400">Supabase Online</span>
          </div>
          <span>v1.0</span>
        </div>
      </aside>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Cabecera superior (Barra de estado) */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
              {config ? config.nombre_farmacia : 'Cargando farmacia...'}
            </h2>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full font-medium">
              <Database className="h-3.5 w-3.5 text-emerald-600" />
              <span>Base en Nube Conectada</span>
            </div>
          </div>
        </header>

        {/* CONTENIDO DINÁMICO */}
        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-slate-500">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="font-semibold text-sm">Cargando base de datos y configuración...</p>
            </div>
          ) : (
            renderActiveComponent()
          )}
        </main>
      </div>

      {/* TOAST SYSTEM (Notificación flotante) */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div className={`flex items-center space-x-2 px-5 py-3 rounded-lg shadow-xl border text-sm font-semibold ${
            toast.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : toast.type === 'error' 
                ? 'bg-red-50 text-red-900 border-red-200' 
                : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}>
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}
