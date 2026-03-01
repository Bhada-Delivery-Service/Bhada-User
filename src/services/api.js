import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        window.dispatchEvent(new Event('tokenRefreshed'));
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  verifyFirebase: (idToken) => api.post('/auth/verify-firebase', { idToken, role: 'user' }),
  refreshToken:   (token)   => api.post('/auth/refresh-token', { refreshToken: token }),
  checkSession:   ()        => api.get('/auth/check-session'),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersAPI = {
  getMyOrders:       ()            => api.get('/orders/my'),
  getMyDrafts:       ()            => api.get('/orders/my/drafts'),
  deleteDraft:       (id)          => api.delete(`/orders/${id}/draft`),
  getById:           (id)          => api.get(`/orders/${id}`),
  checkAvailability: (params)      => api.get('/orders/check-availability', { params }),
  getReceiverInfo:   (phone)       => api.get('/orders/receiver-info', { params: { phone } }),

  // NEW: Step 3→4 — create draft + billing after items filled
  prepare:           (data)        => api.post('/orders/prepare', data),

  // NEW: Finalise and place an existing draft (COD or post-payment)
  placeDraft:        (id, data)    => api.post(`/orders/${id}/place`, data),

  // Legacy single-step place (kept for compat)
  place:             (data)        => api.post('/orders', data),

  saveDraft:         (data)        => api.post('/orders/draft', data),
  cancel:            (id, reason)  => api.put(`/orders/${id}/cancel`, { reason }),
  markReady:         (id)          => api.put(`/orders/${id}/ready`),
  applyOffer:        (id, code)    => api.post(`/orders/${id}/offer`, { offerCode: code }),
  removeOffer:       (id, offerId) => api.delete(`/orders/${id}/offer/${offerId}`),
  getOffers:         (id)          => api.get(`/orders/${id}/offers`),
  handover:          (id, otp)     => api.post(`/orders/${id}/handover`, { pickupOtp: otp }),
};

// ── Payments (Razorpay — v2.3.0) ──────────────────────────────────────────────
export const paymentsAPI = {
  initiate:  (data)       => api.post('/payments/initiate', data),
  verify:    (pid, data)  => api.post(`/payments/${pid}/verify`, data),
  getStatus: (pid)        => api.get(`/payments/${pid}/status`),
  refund:    (pid, data)  => api.post(`/payments/${pid}/refund`, data),
};

// ── Pricing ───────────────────────────────────────────────────────────────────
export const pricingAPI = {
  estimate:  (distanceKm, category) => api.post('/pricing/estimate', { distanceKm, category }),
  getActive: ()                     => api.get('/pricing/active'),
};

// ── Notifications (v2.3.0) ────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll:      (limit = 30) => api.get(`/notifications?limit=${limit}`),
  getCount:    ()            => api.get('/notifications/count'),
  markSeen:    (id)          => api.put(`/notifications/${id}/seen`),
  markAllSeen: ()            => api.put('/notifications/seen-all'),
};

// ── Addresses ─────────────────────────────────────────────────────────────────
export const addressesAPI = {
  getAll:            ()      => api.get('/addresses'),
  create:            (data)  => api.post('/addresses', data),
  update:            (id, d) => api.put(`/addresses/${id}`, d),
  remove:            (id)    => api.delete(`/addresses/${id}`),
  setPreferredPickup:(id)    => api.put(`/addresses/${id}/preferred-pickup`),
  setPreferredDrop:  (id)    => api.put(`/addresses/${id}/preferred-drop`),
};

// ── Disputes ──────────────────────────────────────────────────────────────────
export const disputesAPI = {
  getMyDisputes: ()         => api.get('/disputes/my'),
  getById:       (id)       => api.get(`/disputes/${id}`),
  raise:         (data)     => api.post('/disputes', data),
  addEvidence:   (id, data) => api.post(`/disputes/${id}/evidence`, data),
  // Chat
  getChat:       (id)       => api.get(`/disputes/${id}/chat`),
  sendMessage:   (id, data) => api.post(`/disputes/${id}/chat`, data),
};

// ── Offers ────────────────────────────────────────────────────────────────────
export const offersAPI = {
  // amount = current payable amount so server can compute eligible flag per offer
  getAll: (amount = 0) => api.get(`/offers/all?amount=${amount}`),
};

// ── Files ─────────────────────────────────────────────────────────────────────
export const filesAPI = {
  // Upload a single file; returns { url, filename }
  // Pass a File object from <input type="file">
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
// ── Profile ───────────────────────────────────────────────────────────────────
export const profileAPI = {
  getMe:    ()     => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
};