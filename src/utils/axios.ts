import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import logger from '@utils/logger';

// Create custom axios instance
const axiosInstance: AxiosInstance = axios.create({
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Log request
    logger.http(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    // Add timestamp to track request duration
    config.headers['request-startTime'] = new Date().getTime().toString();
    
    // You can add authentication token here if needed
    // const token = getToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    
    return config;
  },
  (error: AxiosError) => {
    logger.error('API Request Error:', error.message);
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Calculate request duration
    const startTime = parseInt(response.config.headers['request-startTime'] as string);
    const duration = new Date().getTime() - startTime;
    
    // Log response
    logger.http(
      `API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${
        response.status
      } - ${duration}ms`
    );
    
    return response;
  },
  (error: AxiosError) => {
    // Log error
    if (error.response) {
      logger.error(
        `API Error Response: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${
          error.response.status
        } - ${error.response.statusText}`
      );
    } else if (error.request) {
      logger.error(`API No Response: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
    } else {
      logger.error(`API Setup Error: ${error.message}`);
    }
    
    return Promise.reject(error);
  }
);

// Helper functions for common HTTP methods
export const httpClient = {
  get: async <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosInstance.get<T>(url, config);
    return response.data;
  },

  post: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosInstance.post<T>(url, data, config);
    return response.data;
  },

  put: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosInstance.put<T>(url, data, config);
    return response.data;
  },

  patch: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosInstance.patch<T>(url, data, config);
    return response.data;
  },

  delete: async <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosInstance.delete<T>(url, config);
    return response.data;
  },
};

// Example third-party API service
export class ThirdPartyApiService {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async get<T>(endpoint: string, params?: any): Promise<T> {
    try {
      return await httpClient.get<T>(`${this.baseURL}${endpoint}`, { params });
    } catch (error) {
      logger.error(`Third-party API GET error: ${endpoint}`, error);
      throw error;
    }
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    try {
      return await httpClient.post<T>(`${this.baseURL}${endpoint}`, data);
    } catch (error) {
      logger.error(`Third-party API POST error: ${endpoint}`, error);
      throw error;
    }
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    try {
      return await httpClient.put<T>(`${this.baseURL}${endpoint}`, data);
    } catch (error) {
      logger.error(`Third-party API PUT error: ${endpoint}`, error);
      throw error;
    }
  }

  async delete<T>(endpoint: string): Promise<T> {
    try {
      return await httpClient.delete<T>(`${this.baseURL}${endpoint}`);
    } catch (error) {
      logger.error(`Third-party API DELETE error: ${endpoint}`, error);
      throw error;
    }
  }
}

// Example: Create an instance for a specific third-party API
// export const jsonPlaceholderApi = new ThirdPartyApiService('https://jsonplaceholder.typicode.com');

export default axiosInstance;

