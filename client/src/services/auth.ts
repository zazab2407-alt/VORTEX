import type { OrderSummary, User } from '../types';
import { apiGet, apiSend } from './http';

/** Exact text of the 403 the server returns when a deactivated customer's signed-in cookie is used at checkout. Must match server/src/middleware/auth.js. */
export const ACCOUNT_DEACTIVATED_MESSAGE = 'This account has been deactivated, so orders cannot be placed while signed in. Please contact the store.';

export const authService = {
  /** null = not logged in (a normal state, not an error, and no 401 in the console). */
  async me(signal?: AbortSignal): Promise<User | null> {
    return (await apiGet<{ user: User | null }>('/auth/session', { signal })).data.user;
  },
  async login(email: string, password: string): Promise<User> {
    return (await apiSend<{ user: User }>('POST', '/auth/login', { email, password })).data.user;
  },
  async register(name: string, email: string, password: string): Promise<User> {
    return (await apiSend<{ user: User }>('POST', '/auth/register', { name, email, password })).data.user;
  },
  async logout(): Promise<void> { await apiSend('POST', '/auth/logout'); },
  async updateProfile(patch: Partial<Pick<User, 'name' | 'phone' | 'address' | 'city'>>): Promise<User> {
    return (await apiSend<{ user: User }>('PATCH', '/auth/me', patch)).data.user;
  },
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiSend('PUT', '/auth/password', { currentPassword, newPassword });
  },
  async myOrders(signal?: AbortSignal): Promise<OrderSummary[]> {
    return (await apiGet<OrderSummary[]>('/orders/mine', { signal })).data;
  },
};
