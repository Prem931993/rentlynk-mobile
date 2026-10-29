import { api, unwrap } from "./client";

export type Role = "ADMIN" | "OWNER" | "TENANT";

export interface User {
  id: string; email: string; name: string; role: Role; phone?: string | null; avatar_url?: string | null;
  address?: string | null; emergency_contact_name?: string | null; emergency_contact_phone?: string | null;
  upi_id?: string | null; bank_account_name?: string | null; bank_account_number?: string | null; bank_ifsc?: string | null; bank_name?: string | null;
  preferences?: Record<string, any>; must_change_password?: boolean; registration_source?: string;
  has_pin?: boolean; has_signature?: boolean; signature?: { type?: "draw" | "image"; paths?: string[]; width?: number; height?: number; image_url?: string | null } | null; created_at?: string; last_login_at?: string;
}
export interface LegalDoc { id: string; slug: string; title: string; version: number; summary?: string | null; content?: string; published_at?: string }
export interface Requirements { must_change_password: boolean; must_set_pin?: boolean; pending_consents: LegalDoc[] }
export interface LineItem { label: string; amount: number; category: string }
export interface Invoice {
  id: string; invoice_number: string; type: string; month: number; year: number; total: number; amount_paid: number; balance: number;
  discount: number; status: string; due_date: string; line_items: LineItem[]; notes?: string; tenancy_id: string;
  tenant_name?: string; unit_number?: string; property_name?: string; lease_number?: string; pending_verification?: number; cancel_reason?: string;
  payments?: Payment[]; owner?: any; reminders?: any[]; paid_at?: string; created_at?: string;
}
export interface Payment {
  id: string; invoice_id: string; amount: number; method: string; status: string; transaction_id?: string; payment_date: string;
  rejection_reason?: string; receipt_number?: string; proof_url?: string | null; has_proof?: boolean; notes?: string;
  invoice_number?: string; month?: number; year?: number; tenant_name?: string; unit_number?: string; property_name?: string;
  invoice_total?: number; invoice_paid?: number; duplicate_reference_flag?: boolean; recorded_by_owner?: boolean; created_at: string; verified_at?: string;
}

const get = <T = any>(url: string, params?: object) => unwrap<T>(api.get(url, { params }));
const post = <T = any>(url: string, body?: object) => unwrap<T>(api.post(url, body));
const put = <T = any>(url: string, body?: object) => unwrap<T>(api.put(url, body));
const del = <T = any>(url: string) => unwrap<T>(api.delete(url));
const upload = <T = any>(url: string, form: FormData) =>
  unwrap<T>(api.post(url, form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 }));

export const Auth = {
  /** Sign in with mobile number or email + 4-digit PIN (or a password for accounts created before PINs). */
  login: (identifier: string, cred: { pin?: string; password?: string }) => post("/auth/login", { identifier, ...cred, portal: "mobile" }),
  register: (body: object) => post("/auth/register", body),
  me: () => get<{ user: User; requirements: Requirements }>("/auth/me"),
  logout: (refreshToken: string | null) => post("/auth/logout", { refreshToken }),
  logoutAll: () => post("/auth/logout-all"),
  forgot: (identifier: string) => post<{ channels?: { email?: string; sms?: string | null } } | null>("/auth/forgot-password", { identifier }),
  reset: (identifier: string, otp: string, new_pin: string) => post("/auth/reset-password", { identifier, otp, new_pin }),
  setPin: (pin: string, current_pin?: string) => post("/auth/pin", { pin, current_pin }),
  saveSignature: (body: { paths?: string[]; width?: number; height?: number; clear?: boolean }) => put<User>("/auth/signature", body),
  changePassword: (current_password: string, new_password: string) => post("/auth/change-password", { current_password, new_password }),
  acceptConsents: (document_ids: string[]) => post("/auth/consents/accept", { document_ids }),
  myConsents: () => get("/auth/consents"),
  updateProfile: (body: object) => put<User>("/auth/profile", body),
  uploadAvatar: (form: FormData) => upload<User>("/auth/avatar", form),
  uploadSignatureImage: (form: FormData) => upload<User>("/auth/signature/image", form),
  preferences: (body: object) => put("/auth/preferences", body),
  sessions: () => get<any[]>("/auth/sessions"),
  revokeSession: (id: string) => del(`/auth/sessions/${id}`),
  acceptInvite: (code: string) => post("/auth/invitations/accept", { code }),
};

export const Public = {
  settings: () => get("/settings/public"),
  legal: (role?: string) => get<LegalDoc[]>("/legal", role ? { role } : undefined),
  legalDoc: (slug: string) => get<LegalDoc>(`/legal/${slug}`),
  cms: (slug: string) => get(`/cms/pages/${slug}`),
  banners: () => get<any[]>("/banners/active", { placement: "MOBILE_HOME" }),
};

export const Notifications = {
  list: (page = 1) => api.get("/notifications", { params: { page, limit: 30 } }).then((r) => r.data),
  unread: () => get<{ unread: number }>("/notifications/unread-count"),
  read: (id: string) => put(`/notifications/${id}/read`),
  readAll: () => put("/notifications/read-all"),
  remove: (id: string) => del(`/notifications/${id}`),
};

export const Owner = {
  dashboard: () => get("/owner/dashboard"),
  properties: (params?: object) => get<any[]>("/owner/properties", params),
  property: (id: string) => get(`/owner/properties/${id}`),
  createProperty: (b: object) => post("/owner/properties", b),
  updateProperty: (id: string, b: object) => put(`/owner/properties/${id}`, b),
  deleteProperty: (id: string) => del(`/owner/properties/${id}`),
  addPropertyImage: (id: string, form: FormData) => upload(`/owner/properties/${id}/images`, form),
  createUnit: (propertyId: string, b: object) => post(`/owner/properties/${propertyId}/units`, b),
  unit: (id: string) => get(`/owner/units/${id}`),
  updateUnit: (id: string, b: object) => put(`/owner/units/${id}`, b),
  deleteUnit: (id: string) => del(`/owner/units/${id}`),
  leases: (params?: object) => get<any[]>("/owner/leases", params),
  lease: (id: string) => get(`/owner/leases/${id}`),
  createLease: (b: object) => post("/owner/leases", b),
  updateLease: (id: string, b: object) => put(`/owner/leases/${id}`, b),
  deposit: (id: string, b: object) => post(`/owner/leases/${id}/deposit`, b),
  uploadDocument: (id: string, form: FormData) => upload(`/owner/leases/${id}/documents`, form),
  deleteDocument: (docId: string) => del(`/owner/documents/${docId}`),
  addUtilityBill: (leaseId: string, form: FormData) => upload(`/owner/leases/${leaseId}/utility-bills`, form),
  deleteUtilityBill: (billId: string) => del(`/owner/utility-bills/${billId}`),
  startMoveOut: (leaseId: string, b: object) => post(`/owner/leases/${leaseId}/move-out`, b),
  invitations: () => get<any[]>("/owner/invitations"),
  cancelInvite: (id: string) => post(`/owner/invitations/${id}/cancel`),
  regenerateInvite: (id: string) => post<{ code: string }>(`/owner/invitations/${id}/regenerate`),
  invoices: (params?: object) => api.get("/owner/invoices", { params }).then((r) => r.data),
  invoice: (id: string) => get<Invoice>(`/owner/invoices/${id}`),
  createInvoice: (b: object) => post<Invoice>("/owner/invoices", b),
  addCharges: (id: string, items: LineItem[]) => post(`/owner/invoices/${id}/charges`, { items }),
  cancelInvoice: (id: string, reason: string) => post(`/owner/invoices/${id}/cancel`, { reason }),
  remind: (id: string) => post(`/owner/invoices/${id}/remind`),
  payments: (params?: object) => get<Payment[]>("/owner/payments", params),
  payment: (id: string) => get<Payment & { other_payments: Payment[] }>(`/owner/payments/${id}`),
  review: (id: string, b: { action: "APPROVE" | "REJECT"; rejection_reason?: string }) => put(`/owner/payments/${id}/review`, b),
  recordPayment: (b: object) => post("/owner/payments", b),
  moveOuts: (params?: object) => get<any[]>("/owner/move-outs", params),
  moveOut: (id: string) => get(`/owner/move-outs/${id}`),
  acknowledgeMoveOut: (id: string, b: object) => post(`/owner/move-outs/${id}/acknowledge`, b),
  proposeSettlement: (id: string, b: object) => post(`/owner/move-outs/${id}/settlement`, b),
  completeMoveOut: (id: string, b: object) => post(`/owner/move-outs/${id}/complete`, b),
  cancelMoveOut: (id: string) => post(`/owner/move-outs/${id}/cancel`),
  maintenance: (params?: object) => get<any[]>("/owner/maintenance", params),
  maintenanceItem: (id: string) => get(`/owner/maintenance/${id}`),
  updateMaintenance: (id: string, b: object) => put(`/owner/maintenance/${id}`, b),
  announcements: () => get<any[]>("/owner/announcements"),
  createAnnouncement: (b: object) => post("/owner/announcements", b),
  deleteAnnouncement: (id: string) => del(`/owner/announcements/${id}`),
};

export const Tenant = {
  dashboard: () => get("/tenant/dashboard"),
  lease: () => get("/tenant/lease"),
  leases: () => get<any[]>("/tenant/leases"),
  acknowledgeLease: () => post("/tenant/lease/acknowledge"),
  uploadDocument: (form: FormData) => upload("/tenant/lease/documents", form),
  invoices: (status?: string) => get<Invoice[]>("/tenant/invoices", status ? { status } : undefined),
  invoice: (id: string) => get<Invoice>(`/tenant/invoices/${id}`),
  pay: (form: FormData) => upload<Payment>("/tenant/payments", form),
  payments: () => get<Payment[]>("/tenant/payments"),
  maintenance: () => get<any[]>("/tenant/maintenance"),
  createMaintenance: (form: FormData) => upload("/tenant/maintenance", form),
  maintenanceItem: (id: string) => get(`/tenant/maintenance/${id}`),
  commentMaintenance: (id: string, b: object) => post(`/tenant/maintenance/${id}/comment`, b),
  moveOut: () => get("/tenant/move-out"),
  requestMoveOut: (b: object) => post("/tenant/move-out", b),
  respondSettlement: (id: string, b: object) => post(`/tenant/move-out/${id}/respond`, b),
  cancelMoveOut: (id: string) => post(`/tenant/move-out/${id}/cancel`),
  notices: () => get<any[]>("/tenant/notices"),
};
