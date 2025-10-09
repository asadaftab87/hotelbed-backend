import { Router } from 'express';
import { SearchController } from './search.controller';
import { cacheAside, hashFilters } from '../../../middleware/cacheAside';
import { redisManager } from '../../../config/redis.config';

export class SearchRoutes {
  readonly router: Router = Router();
  readonly controller: SearchController = new SearchController();

  constructor() {
    this.initRoutes();
  }

  initRoutes(): void {
    /**
     * @swagger
     * /search:
     *   get:
     *     tags: [Search]
     *     summary: Search hotels with advanced filters
     *     description: |
     *       Search hotels using 20+ filters including destination, dates, price range, amenities, and more.
     *       Results are cached in Redis for optimal performance (30 min TTL).
     *       
     *       **Performance**: p95 ≤ 500ms (cache hit), ≤ 1200ms (cache miss)
     *       
     *       **Cache Strategy**: Cache-aside pattern with Stale-While-Revalidate (SWR)
     *     parameters:
     *       - in: query
     *         name: destination
     *         required: true
     *         schema:
     *           type: string
     *         description: Destination code (e.g., PMI)
     *         example: PMI
     *       - in: query
     *         name: nights
     *         required: true
     *         schema:
     *           type: integer
     *         description: Number of nights
     *         example: 3
     *       - in: query
     *         name: checkIn
     *         schema:
     *           type: string
     *           format: date
     *         description: Check-in date (YYYY-MM-DD)
     *         example: "2025-11-01"
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
     *         name: priceMin
     *         schema:
     *           type: number
     *         description: Minimum price per person
     *       - in: query
     *         name: priceMax
     *         schema:
     *           type: number
     *         description: Maximum price per person
     *       - in: query
     *         name: board
     *         schema:
     *           type: array
     *           items:
     *             type: string
     *             enum: [RO, BB, HB, FB, AI]
     *         description: Board types
     *       - in: query
     *         name: amenities
     *         schema:
     *           type: array
     *           items:
     *             type: string
     *         description: Required amenities (e.g., WIFI, POOL)
     *       - in: query
     *         name: promotion
     *         schema:
     *           type: boolean
     *         description: Filter promotional offers only
     *       - in: query
     *         name: sort
     *         schema:
     *           type: string
     *           enum: [price_asc, price_desc, rating_desc, rating_asc, distance_asc, promo_desc]
     *           default: price_asc
     *         description: Sort order
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
     *         description: Successful search
     *         headers:
     *           X-Cache:
     *             schema:
     *               type: string
     *               enum: [HIT, MISS]
     *             description: Cache status
     *           X-Response-Time:
     *             schema:
     *               type: string
     *             description: Response time in milliseconds
     *           X-Trace-ID:
     *             schema:
     *               type: string
     *             description: Request trace ID
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SearchResponse'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       500:
     *         $ref: '#/components/responses/InternalServerError'
     */
    this.router.get(
      '/',
      cacheAside({
        ttl: redisManager.keyConfig.ttl.search,
        keyGenerator: (req) => {
          const params = {
            destination: req.query.destination as string,
            zone: req.query.zone as string,
            geo: req.query.geo as string,
            checkIn: req.query.checkIn as string,
            nights: parseInt(req.query.nights as string) || 2,
            occupancy: parseInt(req.query.adults as string) || 2,
            filtersHash: hashFilters(req.query),
          };
          return redisManager.generateSearchKey(params);
        },
        enabled: true,
        staleWhileRevalidate: process.env.ENABLE_SWR === 'true',
        swrStaleTime: parseInt(process.env.SWR_STALE_TIME_SEC || '300'),
      }),
      this.controller.search
    );

    /**
     * @swagger
     * /search/suggestions:
     *   get:
     *     tags: [Search]
     *     summary: Get hotel name suggestions (autocomplete)
     *     description: Returns hotel suggestions based on partial name match
     *     parameters:
     *       - in: query
     *         name: q
     *         required: true
     *         schema:
     *           type: string
     *           minLength: 2
     *         description: Search query (min 2 characters)
     *         example: "Beach"
     *     responses:
     *       200:
     *         description: Suggestions retrieved
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
     *                     query:
     *                       type: string
     *                     suggestions:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           hotelCode:
     *                             type: string
     *                           name:
     *                             type: string
     *                           fromPricePP:
     *                             type: number
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     */
    this.router.get('/suggestions', this.controller.suggestions);
  }
}

