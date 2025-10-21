import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Hotel Bed Backend API',
    version: '1.0.0',
    description: 'A complete TypeScript Node.js Express backend API with Service-Repository Architecture',
    contact: {
      name: 'API Support',
      email: 'support@hotelbed.com',
    },
    license: {
      name: 'ISC',
    },
  },
  servers: [
    {
      url: 'http://localhost:5001',
      description: 'Development server',
    },
    {
      url: 'https://api.hotelbed.com',
      description: 'Production server',
    },
  ],
  tags: [
    {
      name: 'Users',
      description: 'User management endpoints',
    },
    {
      name: 'Rooms',
      description: 'Room management endpoints',
    },
    {
      name: 'Bookings',
      description: 'Booking management endpoints',
    },
    {
      name: 'HotelBed',
      description: 'HotelBed data processing and inventory management endpoints',
    },
    {
      name: 'Health',
      description: 'Health check and monitoring endpoints',
    },
  ],
  components: {
    schemas: {
      User: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          id: {
            type: 'integer',
            description: 'User ID',
            example: 1,
          },
          name: {
            type: 'string',
            description: 'User name',
            example: 'John Doe',
          },
          email: {
            type: 'string',
            description: 'User email',
            example: 'john@example.com',
          },
          phone: {
            type: 'string',
            description: 'User phone number',
            example: '+1234567890',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      Room: {
        type: 'object',
        required: ['room_number', 'room_type', 'price'],
        properties: {
          id: {
            type: 'integer',
            description: 'Room ID',
            example: 1,
          },
          room_number: {
            type: 'string',
            description: 'Room number',
            example: '101',
          },
          room_type: {
            type: 'string',
            description: 'Room type',
            example: 'Single',
          },
          price: {
            type: 'number',
            format: 'float',
            description: 'Room price per night',
            example: 1500.0,
          },
          status: {
            type: 'string',
            enum: ['available', 'occupied', 'maintenance'],
            description: 'Room status',
            example: 'available',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Booking: {
        type: 'object',
        required: ['user_id', 'room_id', 'check_in_date', 'check_out_date'],
        properties: {
          id: {
            type: 'integer',
            description: 'Booking ID',
            example: 1,
          },
          user_id: {
            type: 'integer',
            description: 'User ID',
            example: 1,
          },
          room_id: {
            type: 'integer',
            description: 'Room ID',
            example: 1,
          },
          check_in_date: {
            type: 'string',
            format: 'date',
            description: 'Check-in date',
            example: '2025-10-25',
          },
          check_out_date: {
            type: 'string',
            format: 'date',
            description: 'Check-out date',
            example: '2025-10-27',
          },
          total_amount: {
            type: 'number',
            format: 'float',
            description: 'Total booking amount',
            example: 3000.0,
          },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'cancelled', 'completed'],
            description: 'Booking status',
            example: 'pending',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Success status',
            example: true,
          },
          message: {
            type: 'string',
            description: 'Response message',
            example: 'Operation successful',
          },
          data: {
            type: 'object',
            description: 'Response data',
          },
          error: {
            type: 'string',
            description: 'Error message (if any)',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Error message',
          },
          error: {
            type: 'string',
            example: 'Detailed error description',
          },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/api/components/**/*.routes.ts',
    './src/api/components/**/*.controller.ts',
    './src/api/components/**/*.service.ts',
    './src/api/components/index.ts',
  ], // Path to API docs
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

