import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './globals';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hotelbeds Cache API',
      version: '1.0.0',
      description: `
## Hotelbeds Cache API Documentation

A comprehensive API for searching hotels, retrieving pricing matrices, and accessing hotel static data.

### Architecture
- **Cache-Aside Pattern**: Redis caching with versioned keys
- **Performance**: p95 latency ≤ 500-700ms
- **Data Source**: Hotelbeds cache files (updated hourly)
- **Precomputed Prices**: "From € p.p." calculated per travel category

### Key Features
- 🔍 **Advanced Search**: 20+ filters including destination, dates, price, amenities
- 💰 **Price Matrix**: Detailed room pricing with nightly breakdown
- 🏨 **Static Data**: Hotel descriptions, amenities, landmarks
- ⚡ **Fast Response**: Redis caching with 70%+ hit ratio
- 📊 **Monitoring**: Prometheus metrics for observability

### Client Requirements
Built per Sunsky Belgium specifications (September 2025).
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.NODE_PORT}/api/${env.API_VERSION}`,
        description: 'Development server',
      },
      {
        url: `https://api.example.com/api/${env.API_VERSION}`,
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Search',
        description: 'Hotel search with advanced filters',
      },
      {
        name: 'Hotels',
        description: 'Hotel details and pricing matrix',
      },
      {
        name: 'Admin',
        description: 'Administrative operations',
      },
    ],
    components: {
      schemas: {
        SearchRequest: {
          type: 'object',
          properties: {
            destination: {
              type: 'string',
              description: 'Destination code (e.g., PMI for Palma de Mallorca)',
              example: 'PMI',
            },
            zone: {
              type: 'string',
              description: 'Zone code',
            },
            country: {
              type: 'string',
              description: 'Country code (ISO 3166-1 alpha-2)',
              example: 'ES',
            },
            checkIn: {
              type: 'string',
              format: 'date',
              description: 'Check-in date (YYYY-MM-DD)',
              example: '2025-11-01',
            },
            checkOut: {
              type: 'string',
              format: 'date',
              description: 'Check-out date (YYYY-MM-DD)',
            },
            nights: {
              type: 'integer',
              description: 'Number of nights',
              example: 3,
              minimum: 1,
            },
            adults: {
              type: 'integer',
              description: 'Number of adults',
              example: 2,
              default: 2,
            },
            children: {
              type: 'integer',
              description: 'Number of children',
              example: 0,
              default: 0,
            },
            childAges: {
              type: 'string',
              description: 'Comma-separated child ages',
              example: '5,8',
            },
            name: {
              type: 'string',
              description: 'Hotel name search (full-text)',
              example: 'Beach Resort',
            },
            board: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['RO', 'BB', 'HB', 'FB', 'AI'],
              },
              description: 'Board types (RO=Room Only, BB=Bed & Breakfast, HB=Half Board, FB=Full Board, AI=All Inclusive)',
            },
            category: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Hotel star categories',
              example: ['4*', '5*'],
            },
            accommodationType: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Accommodation types',
              example: ['HOTEL', 'RESORT'],
            },
            ratingMin: {
              type: 'number',
              description: 'Minimum rating',
              example: 7.5,
            },
            chain: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Hotel chains',
            },
            amenities: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Required amenities',
              example: ['WIFI', 'POOL', 'SPA'],
            },
            kidsFacilities: {
              type: 'boolean',
              description: 'Filter hotels with kids facilities',
            },
            beachDistanceMax: {
              type: 'integer',
              description: 'Maximum distance to beach in meters',
              example: 500,
            },
            centerDistanceMax: {
              type: 'integer',
              description: 'Maximum distance to center in meters',
              example: 2000,
            },
            priceMin: {
              type: 'number',
              description: 'Minimum price per person',
              example: 100,
            },
            priceMax: {
              type: 'number',
              description: 'Maximum price per person',
              example: 500,
            },
            lastMinute: {
              type: 'boolean',
              description: 'Last minute deals only',
            },
            promotion: {
              type: 'boolean',
              description: 'Promotional offers only',
            },
            sort: {
              type: 'string',
              enum: ['price_asc', 'price_desc', 'rating_desc', 'rating_asc', 'distance_asc', 'promo_desc'],
              description: 'Sort order',
              default: 'price_asc',
            },
            page: {
              type: 'integer',
              description: 'Page number',
              default: 1,
              minimum: 1,
            },
            pageSize: {
              type: 'integer',
              description: 'Results per page',
              default: 50,
              maximum: 100,
            },
          },
          required: ['destination', 'nights'],
        },
        SearchResult: {
          type: 'object',
          properties: {
            hotelId: {
              type: 'string',
              format: 'uuid',
            },
            hotelCode: {
              type: 'string',
              example: '914180',
            },
            name: {
              type: 'string',
              example: 'Hotel Nice Beach',
            },
            fromPricePP: {
              type: 'number',
              description: 'Price per person',
              example: 155.50,
            },
            currency: {
              type: 'string',
              example: 'EUR',
            },
            boardCode: {
              type: 'string',
              example: 'BB',
            },
            startDate: {
              type: 'string',
              format: 'date',
              example: '2025-11-01',
            },
            nights: {
              type: 'integer',
              example: 3,
            },
            rating: {
              type: 'number',
              example: 8.7,
            },
            category: {
              type: 'string',
              example: '4*',
            },
            distances: {
              type: 'object',
              properties: {
                beach: {
                  type: 'integer',
                  description: 'Distance to beach in meters',
                },
                center: {
                  type: 'integer',
                  description: 'Distance to center in meters',
                },
              },
            },
            badges: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['PROMO', 'FREE_NIGHTS', 'LAST_MINUTE'],
              },
            },
            hasPromotion: {
              type: 'boolean',
            },
            accommodationType: {
              type: 'string',
            },
            amenities: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
        },
        SearchResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Search completed',
            },
            data: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/SearchResult',
                  },
                },
                total: {
                  type: 'integer',
                  example: 156,
                },
                page: {
                  type: 'integer',
                  example: 1,
                },
                pageSize: {
                  type: 'integer',
                  example: 50,
                },
                nextCursor: {
                  type: 'string',
                  description: 'Cursor for next page (keyset pagination)',
                },
              },
            },
          },
        },
        MatrixResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Matrix retrieved',
            },
            data: {
              type: 'object',
              properties: {
                hotelId: {
                  type: 'string',
                },
                hotelCode: {
                  type: 'string',
                },
                hotelName: {
                  type: 'string',
                },
                checkIn: {
                  type: 'string',
                  format: 'date',
                },
                checkOut: {
                  type: 'string',
                  format: 'date',
                },
                nights: {
                  type: 'integer',
                },
                occupancy: {
                  type: 'object',
                  properties: {
                    adults: { type: 'integer' },
                    children: { type: 'integer' },
                  },
                },
                rooms: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/RoomMatrix',
                  },
                },
              },
            },
          },
        },
        RoomMatrix: {
          type: 'object',
          properties: {
            roomCode: {
              type: 'string',
              example: 'DBL',
            },
            roomName: {
              type: 'string',
              example: 'Double Room',
            },
            characteristic: {
              type: 'string',
            },
            board: {
              type: 'string',
              example: 'BB',
            },
            totalPrice: {
              type: 'number',
              example: 310.00,
            },
            pricePerPerson: {
              type: 'number',
              example: 155.00,
            },
            currency: {
              type: 'string',
              example: 'EUR',
            },
            nightlyBreakdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: {
                    type: 'string',
                    format: 'date',
                  },
                  price: {
                    type: 'number',
                  },
                },
              },
            },
            policies: {
              type: 'object',
              properties: {
                cancellation: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      daysBeforeCheckin: { type: 'integer' },
                      chargeType: { type: 'string' },
                      amount: { type: 'number' },
                      percentage: { type: 'number' },
                    },
                  },
                },
                prepayment: {
                  type: 'string',
                },
              },
            },
            restrictions: {
              type: 'object',
              properties: {
                minNights: { type: 'integer' },
                maxNights: { type: 'integer' },
                cta: { type: 'integer' },
                ctd: { type: 'integer' },
                releaseDays: { type: 'integer' },
              },
            },
            promotionApplied: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                value: { type: 'number' },
                freeNights: { type: 'integer' },
              },
            },
            availability: {
              type: 'object',
              properties: {
                isAvailable: { type: 'boolean' },
                allotment: { type: 'integer' },
              },
            },
          },
        },
        StaticDataResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
            },
            data: {
              type: 'object',
              properties: {
                hotels: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/HotelStaticData',
                  },
                },
              },
            },
          },
        },
        HotelStaticData: {
          type: 'object',
          properties: {
            hotelId: {
              type: 'string',
            },
            hotelCode: {
              type: 'string',
            },
            name: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            category: {
              type: 'string',
            },
            chain: {
              type: 'string',
            },
            accommodationType: {
              type: 'string',
            },
            location: {
              type: 'object',
              properties: {
                country: { type: 'string' },
                destination: { type: 'string' },
                latitude: { type: 'number' },
                longitude: { type: 'number' },
              },
            },
            distances: {
              type: 'object',
              properties: {
                beach: { type: 'integer' },
                center: { type: 'integer' },
              },
            },
            amenities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  name: { type: 'string' },
                },
              },
            },
            landmarks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  type: { type: 'string' },
                  distance: { type: 'integer' },
                },
              },
            },
            rating: {
              type: 'number',
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
            statusCode: {
              type: 'integer',
              example: 400,
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/Api/Components/**/*.routes.ts', './src/Api/Components/**/*.controller.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

