import React, { useState } from 'react';
import { Database, Key, CheckCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { saveCredentialsToLocal } from '../supabaseClient';

export default function SupabaseSetup({ onConfigured }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim() || !key.trim()) {
      setError('Por favor, ingresa tanto la URL como la Anon Key.');
      return;
    }
    if (!url.startsWith('https://')) {
      setError('La URL de Supabase debe comenzar con https://');
      return;
    }

    try {
      saveCredentialsToLocal(url, key);
      setSuccess(true);
      setError('');
      setTimeout(() => {
        if (onConfigured) onConfigured();
      }, 1500);
    } catch (err) {
      setError('Error al guardar las credenciales: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-8 py-6 text-white text-center">
          <div className="inline-flex p-3 bg-white/10 rounded-full mb-3">
            <Database className="h-8 w-8 text-emerald-100" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Precios Liga — Conexión</h1>
          <p className="text-emerald-100 text-sm mt-1">Configuración del cliente de base de datos en la nube (Supabase)</p>
        </div>

        <div className="p-8">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start space-x-3 text-amber-800 text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">¡Se requiere configuración de Supabase!</p>
              <p className="mt-1">
                Para que la aplicación funcione, edita el archivo <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">src/supabaseClient.js</code> con las credenciales de tu proyecto, o configúralas temporalmente aquí abajo.
              </p>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-slate-800 mb-3">Pasos de Instalación:</h2>
          <ol className="list-decimal list-inside space-y-2.5 text-sm text-slate-600 mb-8">
            <li>
              Crea un proyecto gratuito en{' '}
              <a 
                href="https://supabase.com" 
                target="_blank" 
                rel="noreferrer" 
                className="text-emerald-600 hover:text-emerald-700 font-semibold inline-flex items-center space-x-1"
              >
                <span>Supabase.com</span>
                <ExternalLink className="h-3 w-3" />
              </a>.
            </li>
            <li>
              Ve al editor SQL de Supabase y pega el contenido del script{' '}
              <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs">schema.sql</span>{' '}
              que creamos en la raíz del proyecto para crear las tablas necesarias.
            </li>
            <li>
              Obtén la <strong>Project URL</strong> y la <strong>API Anon Key</strong> desde{' '}
              <span className="font-medium text-slate-700">Project Settings &gt; API</span> en Supabase.
            </li>
          </ol>

          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-emerald-800">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-2 animate-bounce" />
              <p className="font-semibold text-lg">¡Configuración Guardada!</p>
              <p className="text-sm text-emerald-600 mt-1">Conectando a Supabase y cargando Catálogo de Precios Liga...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  SUPABASE_URL (Project URL)
                </label>
                <div className="relative">
                  <Database className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <input
                    type="url"
                    placeholder="https://xxxxxx.supabase.co"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  SUPABASE_ANON_KEY (Public Anon Key)
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm font-medium">{error}</p>
              )}

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition duration-200"
              >
                Conectar con Supabase
              </button>
            </form>
          )}
        </div>

        <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
          <span>Catálogo de Precios Liga v1.0.0</span>
          <span>Desarrollado con React + Supabase</span>
        </div>

      </div>
    </div>
  );
}
