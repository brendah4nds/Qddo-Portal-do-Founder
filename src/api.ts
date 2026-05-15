import axios from 'axios';
import { auth } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'https://vps.qddo.com.br';

export const api = axios.create({ baseURL: API_URL, withCredentials: false });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && auth.currentUser && !err.config._retry) {
      err.config._retry = true;
      try {
        const idToken = await auth.currentUser.getIdToken(true);
        const { data } = await axios.post(`${API_URL}/api/auth/google`, { idToken });
        localStorage.setItem('jwt', data.token);
        err.config.headers.Authorization = `Bearer ${data.token}`;
        return axios(err.config);
      } catch {}
    }
    return Promise.reject(err);
  }
);

export const API_BASE = API_URL;
