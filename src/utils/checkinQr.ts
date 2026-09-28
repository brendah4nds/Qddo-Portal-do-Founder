// QR code impresso no QDDO aponta para /checkin?qr=checkin. Ao abrir esse link
// o portal dispara o check-in sozinho (mesma validação de GPS do botão).
export const CHECKIN_QR_PATH = '/checkin';
export const CHECKIN_QR_PARAM = 'qr';
export const CHECKIN_QR_VALUE = 'checkin';

export function isCheckinQrLink(): boolean {
  return new URLSearchParams(window.location.search).get(CHECKIN_QR_PARAM) === CHECKIN_QR_VALUE;
}

// Remove o parâmetro da URL para que um refresh não dispare o check-in de novo.
export function clearCheckinQrParam() {
  const params = new URLSearchParams(window.location.search);
  params.delete(CHECKIN_QR_PARAM);
  const query = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
}
