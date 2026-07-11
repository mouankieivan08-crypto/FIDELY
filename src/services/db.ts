import { supabase } from "../lib/supabase";

export interface Business {
  id: number;
  name: string;
  ownerUid: string;
  createdAt: string; // or Date
}

export interface Program {
  id: number;
  businessId: number;
  name: string;
  visitsRequired: number;
  rewardDescription: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  businessId: number;
  name: string;
  phone: string;
  visits: number;
  programId: number;
  rewardStatus: "pending" | "available" | "redeemed";
  createdAt: string;
}

export interface Visit {
  id: number;
  customerId: string;
  businessId: number;
  date: string;
  validatedBy: string;
}

export interface Employee {
  id: number;
  businessId: number;
  name: string;
  role: string;
  phone: string;
  status: string;
  avatarUrl?: string;
  createdAt: string;
}

const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Not authenticated");
  const token = data.session.access_token;

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
};

export const getBusiness = async (userId: string) => {
  return fetchApi('/business');
};

export const createBusiness = async (userId: string, name: string) => {
  return fetchApi('/business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
};

export const getPrograms = async (businessId: number) => {
  return fetchApi(`/businesses/${businessId}/programs`);
};

export const createProgram = async (businessId: number, data: Omit<Program, "id" | "businessId" | "createdAt">) => {
  return fetchApi(`/businesses/${businessId}/programs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

export const getCustomers = async (businessId: number) => {
  return fetchApi(`/businesses/${businessId}/customers`);
};

export const createCustomer = async (businessId: number, data: Omit<Customer, "id" | "businessId" | "visits" | "rewardStatus" | "createdAt">) => {
  return fetchApi(`/businesses/${businessId}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

export const getCustomer = async (customerId: string) => {
  const response = await fetch(`/api/customers/${customerId}`);
  if (!response.ok) throw new Error("Not found");
  return response.json();
};

export const recordVisit = async (customerId: string, businessId: number, staffId: string) => {
  return fetchApi(`/customers/${customerId}/visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
};

export const getVisits = async (customerId: string) => {
  const response = await fetch(`/api/customers/${customerId}/visits`);
  if (!response.ok) throw new Error("Not found");
  return response.json();
};

export const redeemReward = async (customerId: string) => {
  return fetchApi(`/customers/${customerId}/redeem`, {
    method: 'POST',
  });
};

export const getEmployees = async (businessId: number) => {
  return fetchApi(`/businesses/${businessId}/employees`);
};

export const createEmployee = async (businessId: number, data: { name: string, role: string, phone: string, avatarUrl?: string }) => {
  return fetchApi(`/businesses/${businessId}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const getServices = async (businessId: number) => {
  return fetchApi(`/businesses/${businessId}/services`);
};

export const createService = async (businessId: number, data: any) => {
  return fetchApi(`/businesses/${businessId}/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const clockIn = async (employeeId: number, data: { selfieUrl?: string; locationLat?: string; locationLng?: string }) => {
  return fetchApi(`/employees/${employeeId}/clock-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

export const clockOut = async (employeeId: number) => {
  return fetchApi(`/employees/${employeeId}/clock-out`, {
    method: 'POST',
  });
};

export const getAppointments = async (businessId: number) => {
  return fetchApi(`/businesses/${businessId}/appointments`);
};

export const createAppointment = async (businessId: number, data: any) => {
  return fetchApi(`/businesses/${businessId}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

// --- Categories ---
export interface Category { id: number; businessId: number; name: string; createdAt: string; }

export const getCategories = async (businessId: number) => {
  return fetchApi(`/businesses/${businessId}/categories`);
};

export const createCategory = async (businessId: number, name: string) => {
  return fetchApi(`/businesses/${businessId}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
};

export const deleteCategory = async (categoryId: number) => {
  return fetchApi(`/categories/${categoryId}`, { method: 'DELETE' });
};

// --- Service variants ---
export interface ServiceVariant {
  id: number;
  serviceId: number;
  name: string;
  price: number; // cents
  duration?: number;
  createdAt: string;
}

export const getVariants = async (serviceId: number) => {
  return fetchApi(`/services/${serviceId}/variants`);
};

export const createVariant = async (serviceId: number, data: { name: string; price: number; duration?: number }) => {
  return fetchApi(`/services/${serviceId}/variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

export const deleteVariant = async (variantId: number) => {
  return fetchApi(`/variants/${variantId}`, { method: 'DELETE' });
};

// --- Accounting / transactions ---
export interface Transaction {
  id: number;
  businessId: number;
  type: "credit" | "debit";
  amount: number; // FCFA
  category?: string;
  description?: string;
  date: string;
  createdAt: string;
}

export const getTransactions = async (businessId: number, from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return fetchApi(`/businesses/${businessId}/transactions${qs ? `?${qs}` : ""}`);
};

export const createTransaction = async (businessId: number, data: Omit<Transaction, "id" | "businessId" | "createdAt">) => {
  return fetchApi(`/businesses/${businessId}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

export const deleteTransaction = async (transactionId: number) => {
  return fetchApi(`/transactions/${transactionId}`, { method: 'DELETE' });
};

// --- Staff / members ---
export interface Member {
  id: number;
  businessId: number;
  email: string;
  uid?: string;
  name?: string;
  role: "admin" | "staff";
  createdAt: string;
}

export const getMembers = async (businessId: number) => {
  return fetchApi(`/businesses/${businessId}/members`);
};

export const createMember = async (businessId: number, data: { email: string; name?: string; role?: "admin" | "staff" }) => {
  return fetchApi(`/businesses/${businessId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

export const updateMemberRole = async (memberId: number, role: "admin" | "staff") => {
  return fetchApi(`/members/${memberId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
};

export const deleteMember = async (memberId: number) => {
  return fetchApi(`/members/${memberId}`, { method: 'DELETE' });
};
