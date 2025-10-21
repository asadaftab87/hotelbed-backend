// Type definitions for the application

export interface User {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface Room {
  id?: number;
  room_number: string;
  room_type: string;
  price: number;
  status: 'available' | 'occupied' | 'maintenance';
  created_at?: Date;
  updated_at?: Date;
}

export interface Booking {
  id?: number;
  user_id: number;
  room_id: number;
  check_in_date: Date;
  check_out_date: Date;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at?: Date;
  updated_at?: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

