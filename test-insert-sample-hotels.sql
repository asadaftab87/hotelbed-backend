-- Sample test data for quick testing
-- Run this in your MySQL database

-- Insert sample hotels
INSERT INTO `HotelMaster` (`id`, `hotelBedId`, `hotelCode`, `hotelName`, `countryCode`, `destinationCode`, `hotelCategory`, `createdAt`, `updatedAt`) VALUES
(UUID(), UUID(), '914180', 'Hotel Sol Palmanova', 'ES', 'PMI', '4', NOW(), NOW()),
(UUID(), UUID(), '915432', 'Iberostar Playa de Palma', 'ES', 'PMI', '5', NOW(), NOW()),
(UUID(), UUID(), '916789', 'Hotel Nixe Palace', 'ES', 'PMI', '5', NOW(), NOW()),
(UUID(), UUID(), '917234', 'Grupotel Parc Natural', 'ES', 'PMI', '4', NOW(), NOW()),
(UUID(), UUID(), '918567', 'SENTIDO Cala Viñas', 'ES', 'PMI', '4', NOW(), NOW());

-- Insert sample board types
INSERT INTO `BoardMaster` (`id`, `hotelBedId`, `boardCode`, `boardDescription`, `createdAt`, `updatedAt`) VALUES
(UUID(), UUID(), 'RO', 'Room Only', NOW(), NOW()),
(UUID(), UUID(), 'BB', 'Bed & Breakfast', NOW(), NOW()),
(UUID(), UUID(), 'HB', 'Half Board', NOW(), NOW()),
(UUID(), UUID(), 'FB', 'Full Board', NOW(), NOW()),
(UUID(), UUID(), 'AI', 'All Inclusive', NOW(), NOW());

-- Success message
SELECT 'Sample data inserted successfully!' AS status;
SELECT COUNT(*) AS total_hotels FROM `HotelMaster`;


