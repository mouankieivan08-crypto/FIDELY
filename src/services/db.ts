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
