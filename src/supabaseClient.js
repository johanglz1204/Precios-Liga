import { createClient } from '@supabase/supabase-js';

// =========================================================================
// CONFIGURACIÓN DE CREDENCIALES DE SUPABASE
// Modifica estas constantes con la URL y la clave anónima de tu proyecto.
// Puedes encontrarlas en Supabase -> Project Settings -> API.
// =========================================================================
export const SUPABASE_URL = 'https://oymhrcjwaupuynxxahzf.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_6g3XRBPL7ywhYgxlFJ5SlA_22IrBLN0';

// Helper para verificar si las credenciales en el código han sido modificadas.
const checkConfigured = (url, key) => {
  return url && 
         key && 
         url !== 'https://tu-proyecto.supabase.co' && 
         key !== 'tu-clave-anon-key-aqui' && 
         url.trim() !== '' && 
         key.trim() !== '';
};

// Intentar obtener credenciales dinámicas de localStorage como alternativa
// para que el usuario pueda probar la app inmediatamente desde el navegador sin editar el archivo.
const getCredentials = () => {
  const codeConfigured = checkConfigured(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  if (codeConfigured) {
    return {
      url: SUPABASE_URL,
      key: SUPABASE_ANON_KEY,
      source: 'code'
    };
  }
  
  // Si no está configurado en código, buscar en localStorage
  const localUrl = localStorage.getItem('FARMA_SUPABASE_URL') || '';
  const localKey = localStorage.getItem('FARMA_SUPABASE_ANON_KEY') || '';
  const localConfigured = checkConfigured(localUrl, localKey);
  
  if (localConfigured) {
    return {
      url: localUrl,
      key: localKey,
      source: 'local'
    };
  }
  
  return {
    url: '',
    key: '',
    source: 'none'
  };
};

const credentials = getCredentials();

export const isSupabaseConfigured = credentials.source !== 'none';
export const supabaseSource = credentials.source;

export const supabase = isSupabaseConfigured
  ? createClient(credentials.url, credentials.key)
  : null;

// Funciones para guardar/borrar credenciales de localStorage si se configuran desde la UI
export const saveCredentialsToLocal = (url, key) => {
  localStorage.setItem('FARMA_SUPABASE_URL', url.trim());
  localStorage.setItem('FARMA_SUPABASE_ANON_KEY', key.trim());
};

export const clearCredentialsFromLocal = () => {
  localStorage.removeItem('FARMA_SUPABASE_URL');
  localStorage.removeItem('FARMA_SUPABASE_ANON_KEY');
};
