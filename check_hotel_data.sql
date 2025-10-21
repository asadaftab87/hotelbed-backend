-- Find hotels with most complete data across all tables
SELECT 
    h.id,
    h.name,
    (SELECT COUNT(*) FROM hotel_room_allocations WHERE hotel_id = h.id) as rooms,
    (SELECT COUNT(*) FROM hotel_rates WHERE hotel_id = h.id) as rates,
    (SELECT COUNT(*) FROM hotel_inventory WHERE hotel_id = h.id) as inventory,
    (SELECT COUNT(*) FROM hotel_contracts WHERE hotel_id = h.id) as contracts,
    (SELECT COUNT(*) FROM hotel_supplements WHERE hotel_id = h.id) as supplements,
    (SELECT COUNT(*) FROM hotel_email_settings WHERE hotel_id = h.id) as emails,
    (SELECT COUNT(*) FROM hotel_configurations WHERE hotel_id = h.id) as configs,
    (SELECT COUNT(*) FROM hotel_rate_tags WHERE hotel_id = h.id) as tags,
    (SELECT COUNT(*) FROM hotel_occupancy_rules WHERE hotel_id = h.id) as occupancy,
    (SELECT COUNT(*) FROM hotel_promotions WHERE hotel_id = h.id) as promotions,
    (SELECT COUNT(*) FROM hotel_special_requests WHERE hotel_id = h.id) as requests,
    (SELECT COUNT(*) FROM hotel_groups WHERE hotel_id = h.id) as groups_count,
    (SELECT COUNT(*) FROM hotel_cancellation_policies WHERE hotel_id = h.id) as cancellations,
    (SELECT COUNT(*) FROM hotel_special_conditions WHERE hotel_id = h.id) as conditions,
    (SELECT COUNT(*) FROM hotel_room_features WHERE hotel_id = h.id) as features,
    (SELECT COUNT(*) FROM hotel_pricing_rules WHERE hotel_id = h.id) as pricing,
    (SELECT COUNT(*) FROM hotel_tax_info WHERE hotel_id = h.id) as taxes
FROM hotels h
WHERE h.id IN (
    SELECT DISTINCT hotel_id FROM hotel_rates LIMIT 20
)
ORDER BY rates DESC, rooms DESC, inventory DESC
LIMIT 10;
