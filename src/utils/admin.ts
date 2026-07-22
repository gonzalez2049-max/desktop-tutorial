// Modo administrador / auditor. El acceso se controla con el perfil de
// administrador (clave local) o, de forma retrocompatible, con ?admin=1.

import { isAdmin } from './adminConfig';

/** ¿Está activo el modo administrador (auditor)? */
export function isAdminMode(): boolean {
  return isAdmin();
}
