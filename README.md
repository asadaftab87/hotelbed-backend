# Hotel Bed Backend - TypeScript Express API

A robust backend API built with TypeScript, Node.js, Express.js following Service-Repository architecture pattern with MySQL database using raw SQL queries.

## 🚀 Features

- **TypeScript** - Type-safe code with full TypeScript support
- **Service-Repository Architecture** - Clean separation of concerns
- **MySQL Database** - Relational database with raw SQL queries
- **Redis Caching** - Fast caching with Redis integration
- **Swagger Documentation** - Interactive API documentation
- **Winston Logging** - Advanced logging with daily rotation
- **Monitoring** - Health checks and system metrics
- **Axios HTTP Client** - Pre-configured for third-party APIs
- **Express.js** - Fast and minimal web framework
- **Rate Limiting** - Request rate limiting for security
- **Compression** - Response compression for better performance
- **Error Handling** - Comprehensive error handling middleware
- **CORS & Security** - Configured with helmet and CORS
- **Environment Configuration** - Dotenv for environment variables
- **Hot Reload** - Development with ts-node-dev for instant updates

## 📁 Project Structure

```
New Hotel-Bed/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.ts  # MySQL connection pool
│   │   └── env.ts       # Environment configuration
│   ├── controllers/     # Request handlers
│   │   ├── userController.ts
│   │   ├── roomController.ts
│   │   └── bookingController.ts
│   ├── services/        # Business logic layer
│   │   ├── userService.ts
│   │   ├── roomService.ts
│   │   └── bookingService.ts
│   ├── repositories/    # Data access layer
│   │   ├── userRepository.ts
│   │   ├── roomRepository.ts
│   │   └── bookingRepository.ts
│   ├── routes/          # API routes
│   │   ├── userRoutes.ts
│   │   ├── roomRoutes.ts
│   │   ├── bookingRoutes.ts
│   │   └── index.ts
│   ├── middlewares/     # Custom middlewares
│   │   ├── errorHandler.ts
│   │   └── requestLogger.ts
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts
│   ├── app.ts          # Express app setup
│   └── server.ts       # Server entry point
├── database/
│   └── schema.sql      # Database schema
├── .env                # Environment variables
├── .env.example        # Environment variables example
├── .gitignore          # Git ignore rules
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── README.md           # This file
```

## 🛠️ Installation

1. **Clone the repository**
```bash
cd "New Hotel-Bed"
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env and update with your MySQL credentials
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=hotel_bed_db
```

4. **Setup MySQL Database**
```bash
# Login to MySQL
mysql -u root -p

# Run the schema.sql file
source database/schema.sql
```

## 🚀 Usage

### Development Mode (with hot reload)
```bash
npm run dev
# or
npm run start:dev
```

### Production Mode
```bash
# Build first
npm run build

# Then start
npm start
# or
npm run start:prod
```

### Other Commands
```bash
# TypeScript watch mode
npm run watch

# Clean build directory
npm run clean
```

## 📡 API Endpoints

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Rooms
- `GET /api/rooms` - Get all rooms
- `GET /api/rooms/available` - Get available rooms
- `GET /api/rooms/type/:type` - Get rooms by type
- `GET /api/rooms/:id` - Get room by ID
- `POST /api/rooms` - Create new room
- `PUT /api/rooms/:id` - Update room
- `PATCH /api/rooms/:id/status` - Update room status
- `DELETE /api/rooms/:id` - Delete room

### Bookings
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/:id` - Get booking by ID
- `GET /api/bookings/user/:userId` - Get bookings by user
- `GET /api/bookings/room/:roomId` - Get bookings by room
- `POST /api/bookings` - Create new booking
- `PUT /api/bookings/:id` - Update booking
- `PATCH /api/bookings/:id/cancel` - Cancel booking
- `PATCH /api/bookings/:id/complete` - Complete booking
- `DELETE /api/bookings/:id` - Delete booking

### Monitoring
- `GET /api/monitoring/health` - Basic health check
- `GET /api/monitoring/health/detailed` - Detailed health check (DB + Redis)
- `GET /api/monitoring/metrics` - System metrics
- `GET /api/monitoring/stats` - Application statistics
- `POST /api/monitoring/cache/clear` - Clear all caches

### Documentation
- `GET /api-docs` - Swagger UI documentation
- `GET /api-docs.json` - Swagger JSON specification

## 📝 API Request Examples

### Create User
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }'
```

### Create Room
```bash
curl -X POST http://localhost:3000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "room_number": "101",
    "room_type": "Single",
    "price": 1500,
    "status": "available"
  }'
```

### Create Booking
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "room_id": 1,
    "check_in_date": "2025-10-25",
    "check_out_date": "2025-10-27",
    "status": "pending"
  }'
```

## 🏗️ Architecture

### Service-Repository Pattern

**Controllers** → Handle HTTP requests/responses
- Parse request data
- Call service methods
- Format and send responses

**Services** → Business logic layer
- Validate data
- Implement business rules
- Orchestrate repository calls

**Repositories** → Data access layer
- Execute raw SQL queries
- Handle database operations
- Return data to services

## 🔒 Database Schema

### Users Table
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- name (VARCHAR)
- email (VARCHAR, UNIQUE)
- phone (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### Rooms Table
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- room_number (VARCHAR, UNIQUE)
- room_type (VARCHAR)
- price (DECIMAL)
- status (ENUM: available, occupied, maintenance)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### Bookings Table
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- user_id (INT, FOREIGN KEY)
- room_id (INT, FOREIGN KEY)
- check_in_date (DATE)
- check_out_date (DATE)
- total_amount (DECIMAL)
- status (ENUM: pending, confirmed, cancelled, completed)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

## 🔧 Technologies Used

### Core
- **Node.js** - JavaScript runtime
- **TypeScript** - Type-safe JavaScript
- **Express.js** - Web framework

### Database & Cache
- **MySQL** (mysql2) - Relational database with connection pooling
- **Redis** - In-memory caching and session storage

### Documentation & API
- **Swagger (swagger-ui-express)** - API documentation
- **Axios** - HTTP client for third-party APIs

### Logging & Monitoring
- **Winston** - Advanced logging with daily rotation
- **Morgan** - HTTP request logger

### Security & Performance
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **express-rate-limit** - Rate limiting
- **compression** - Response compression

### Development
- **ts-node-dev** - Hot reload for development
- **cross-env** - Cross-platform environment variables
- **nodemon** - Alternative dev server

## 📦 Key Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.5",
    "redis": "^4.6.12",
    "axios": "^1.6.5",
    "winston": "^3.11.0",
    "swagger-ui-express": "^5.0.0",
    "swagger-jsdoc": "^6.2.8",
    "compression": "^1.7.4",
    "express-rate-limit": "^7.1.5",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0",
    "cross-env": "^7.0.3"
  }
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC

## 👨‍💻 Author

Your Name

## 🎯 Future Enhancements

- [ ] Add authentication (JWT)
- [ ] Add input validation middleware
- [ ] Add pagination
- [ ] Add filtering and sorting
- [ ] Add unit tests
- [ ] Add API documentation (Swagger)
- [ ] Add rate limiting
- [ ] Add caching (Redis)
- [ ] Add file upload for room images

## 📞 Support

For support, email your-email@example.com