import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Pill, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          setError('Usuario o contraseña incorrectos.');
        } else {
          setError(authError.message);
        }
      }
      // Si no hay error, onAuthStateChange en App.jsx detectará la sesión automáticamente
    } catch (err) {
      setError('Error inesperado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-600/30 mb-4">
            <Pill className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Catálogo de Precios Liga</h1>
          <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mt-1">Monitor Competitivo</p>
        </div>

        {/* Card del formulario */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <h2 className="text-base font-bold text-white mb-1">Iniciar Sesión</h2>
          <p className="text-slate-500 text-sm mb-6">Ingresa tus credenciales para continuar.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Campo Usuario */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="usuario@fm.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-600 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center space-x-2 bg-red-900/30 border border-red-800/50 text-red-400 rounded-lg px-3 py-2.5 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center space-x-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verificando...</span>
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-700 text-xs mt-6">
          Sistema de uso interno · Catálogo de Precios Liga v1.0
        </p>
      </div>
    </div>
  );
}
