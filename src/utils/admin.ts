// Modo administrador / auditor. Al no existir backend, el acceso se controla
// con un parámetro en la URL (?admin=1 o ?auditor=1). Se recuerda en la sesión
// del navegador para que sobreviva a la navegación interna.

const FLAG = 'nex-admin';

/** ¿Está activo el modo administrador (auditor)? */
export function isAdminMode(): boolean {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('admin') === '1' || url.searchParams.get('auditor') === '1';
    if (fromUrl) {
      window.sessionStorage.setItem(FLAG, '1');
      return true;
    }
    return window.sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}
