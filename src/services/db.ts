import { Timestamp } from "firebase/firestore"; // We might want to remove this type completely if we migrate fully away from firestore types
import { auth } from "../lib/firebase";

export interface Restaurant {
  id: number;
  name: string;
  ownerUid: string;
  createdAt: string; // or Date
}

export interface Program {
  id: number;
  restaurantId: number;
  name: string;
  visitsRequired: number;
  rewardDescription: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  restaurantId: number;
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
  restaurantId: number;
  date: string;
  validatedBy: string;
}

export interface Employee {
  id: number;
  restaurantId: number;
  name: string;
  role: string;
  phone: string;
  status: string;
  avatarUrl?: string;
  createdAt: string;
}

const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const token = await auth.currentUser.getIdToken();
  
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

export const getRestaurant = async (userId: string) => {
  return fetchApi('/restaurant');
};

export const createRestaurant = async (userId: string, name: string) => {
  return fetchApi('/restaurant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
};

export const getPrograms = async (restaurantId: number) => {
  return fetchApi(`/restaurants/${restaurantId}/programs`);
};

export const createProgram = async (restaurantId: number, data: Omit<Program, "id" | "restaurantId" | "createdAt">) => {
  return fetchApi(`/restaurants/${restaurantId}/programs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

export const getCustomers = async (restaurantId: number) => {
  return fetchApi(`/restaurants/${restaurantId}/customers`);
};

export const createCustomer = async (restaurantId: number, data: Omit<Customer, "id" | "restaurantId" | "visits" | "rewardStatus" | "createdAt">) => {
  return fetchApi(`/restaurants/${restaurantId}/customers`, {
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

export const recordVisit = async (customerId: string, restaurantId: number, staffId: string) => {
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

export const getEmployees = async (restaurantId: number) => {
  return fetchApi(`/restaurants/${restaurantId}/employees`);
};

export const createEmployee = async (restaurantId: number, data: { name: string, role: string, phone: string, avatarUrl?: string }) => {
  return fetchApi(`/restaurants/${restaurantId}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const getServices = async (restaurantId: number) => {
  return fetchApi(`/restaurants/${restaurantId}/services`);
};

export const createService = async (restaurantId: number, data: any) => {
  return fetchApi(`/restaurants/${restaurantId}/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const getAppointments = async (restaurantId: number) => {
  return fetchApi(`/restaurants/${restaurantId}/appointments`);
};

export const createAppointment = async (restaurantId: number, data: any) => {
  return fetchApi(`/restaurants/${restaurantId}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};
