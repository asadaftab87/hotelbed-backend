import { Router } from 'express';
import { HotelsController } from './hotels.controller';
import { cacheAside } from '../../../middleware/cacheAside';
import { redisManager } from '../../../config/redis.config';

export class HotelsRoutes {
  readonly router: Router = Router();
  readonly controller: HotelsController = new HotelsController();

  constructor() {
    this.initRoutes();
  }

  initRoutes(): void {
    /**
     * @swagger
     * /hotels:
     *   get:
     *     tags: [Hotels]
     *     summary: Get available hotels list
     *     description: Returns a list of available hotels with basic information
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *         description: Page number
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 50
     *           maximum: 100
     *         description: Results per page
     *     responses:
     *       200:
     *         description: Hotels list retrieved
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     hotels:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           hotelCode:
     *                             type: string
     *                           hotelName:
     *                             type: string
     *                           minPricePP:
     *                             type: number
     *                           rating:
     *                             type: number
     *                           countryCode:
     *                             type: string
     *                           destinationCode:
     *                             type: string
     *                           hasPromotion:
     *                             type: boolean
     *                     total:
     *                       type: integer
     *                     page:
     *                       type: integer
     *                     pageSize:
     *                       type: integer
     *       500:
     *         $ref: '#/components/responses/InternalServerError'
     */
    this.router.get(
      '/',
      cacheAside({
        ttl: redisManager.keyConfig.ttl.search,
        enabled: true,
      }),
      this.controller.getList
    );

    /**
     * @swagger
     * /hotels/{id}/matrix:
     *   get:
     *     tags: [Hotels]
     *     summary: Get hotel pricing matrix
     *     description: |
     *       Returns detailed pricing matrix for all available rooms including:
     *       - Nightly price breakdown
     *       - Cancellation policies
     *       - Restrictions (min/max nights, CTA/CTD)
     *       - Applied promotions
     *       - Availability status
     *       
     *       **Performance**: p95 ≤ 700ms (with cache)
     *       
     *       **Cache**: 15 min TTL with SWR (stale-while-revalidate)
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Hotel code
     *         example: "914180"
     *       - in: query
     *         name: checkIn
     *         required: true
     *         schema:
     *           type: string
     *           format: date
     *         description: Check-in date (YYYY-MM-DD)
     *         example: "2025-11-01"
     *       - in: query
     *         name: nights
     *         required: true
     *         schema:
     *           type: integer
     *           minimum: 1
     *         description: Number of nights
     *         example: 3
     *       - in: query
     *         name: adults
     *         schema:
     *           type: integer
     *           default: 2
     *         description: Number of adults
     *       - in: query
     *         name: children
     *         schema:
     *           type: integer
     *           default: 0
     *         description: Number of children
     *       - in: query
     *         name: childAges
     *         schema:
     *           type: string
     *         description: Comma-separated child ages
     *         example: "5,8"
     *     responses:
     *       200:
     *         description: Matrix retrieved successfully
     *         headers:
     *           X-Cache:
     *             schema:
     *               type: string
     *             description: Cache status (HIT/MISS)
     *           X-Cache-Status:
     *             schema:
     *               type: string
     *             description: Cache freshness (FRESH/STALE)
     *           X-Response-Time:
     *             schema:
     *               type: string
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MatrixResponse'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *       500:
     *         $ref: '#/components/responses/InternalServerError'
     */
    this.router.get(
      '/:id/matrix',
      cacheAside({
        ttl: redisManager.keyConfig.ttl.matrix,
        keyGenerator: (req) => {
          const params = {
            hotelId: req.params.id,
            checkIn: req.query.checkIn as string,
            nights: parseInt(req.query.nights as string) || 1,
            occupancy: parseInt(req.query.adults as string) || 2,
          };
          return redisManager.generateMatrixKey(params);
        },
        enabled: true,
        staleWhileRevalidate: process.env.ENABLE_SWR === 'true',
        swrStaleTime: parseInt(process.env.SWR_STALE_TIME_SEC || '300'),
      }),
      this.controller.getMatrix
    );

    /**
     * @swagger
     * /hotels/static:
     *   get:
     *     tags: [Hotels]
     *     summary: Get static hotel data (bulk)
     *     description: |
     *       Returns static information for multiple hotels including:
     *       - Basic information (name, category, chain)
     *       - Location (country, destination, coordinates)
     *       - Amenities with codes
     *       - Nearby landmarks with distances
     *       - Ratings and contact information
     *       
     *       **Cache**: 24 hours TTL
     *     parameters:
     *       - in: query
     *         name: ids
     *         required: true
     *         schema:
     *           type: string
     *         description: Comma-separated hotel codes (max 50)
     *         example: "914180,915432,916789"
     *     responses:
     *       200:
     *         description: Static data retrieved
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/StaticDataResponse'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       500:
     *         $ref: '#/components/responses/InternalServerError'
     */
    this.router.get(
      '/static',
      cacheAside({
        ttl: redisManager.keyConfig.ttl.static,
        keyGenerator: (req) => {
          const ids = Array.isArray(req.query.ids)
            ? (req.query.ids as string[]).join(',')
            : (req.query.ids as string);
          return `st:${redisManager.keyConfig.version}:bulk:${ids}`;
        },
        enabled: true,
      }),
      this.controller.getStatic
    );

    /**
     * @swagger
     * /hotels/{id}:
     *   get:
     *     tags: [Hotels]
     *     summary: Get single hotel static data
     *     description: Returns static information for a single hotel
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Hotel code
     *         example: "914180"
     *     responses:
     *       200:
     *         description: Hotel data retrieved
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   $ref: '#/components/schemas/HotelStaticData'
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *       500:
     *         $ref: '#/components/responses/InternalServerError'
     */
    this.router.get(
      '/:id',
      cacheAside({
        ttl: redisManager.keyConfig.ttl.static,
        keyGenerator: (req) => redisManager.generateStaticKey(req.params.id),
        enabled: true,
      }),
      this.controller.getById
    );
  }
}

