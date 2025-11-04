-- STAGING TABLES FOR ZERO-DOWNTIME SYNC
-- Run this once to create staging tables

CREATE TABLE IF NOT EXISTS hotels_staging LIKE hotels;
CREATE TABLE IF NOT EXISTS hotel_rates_staging LIKE hotel_rates;
CREATE TABLE IF NOT EXISTS hotel_contracts_staging LIKE hotel_contracts;
CREATE TABLE IF NOT EXISTS hotel_room_allocations_staging LIKE hotel_room_allocations;
CREATE TABLE IF NOT EXISTS hotel_inventory_staging LIKE hotel_inventory;
CREATE TABLE IF NOT EXISTS hotel_supplements_staging LIKE hotel_supplements;
CREATE TABLE IF NOT EXISTS hotel_occupancy_rules_staging LIKE hotel_occupancy_rules;
CREATE TABLE IF NOT EXISTS hotel_email_settings_staging LIKE hotel_email_settings;
CREATE TABLE IF NOT EXISTS hotel_rate_tags_staging LIKE hotel_rate_tags;
CREATE TABLE IF NOT EXISTS hotel_configurations_staging LIKE hotel_configurations;
CREATE TABLE IF NOT EXISTS hotel_groups_staging LIKE hotel_groups;
CREATE TABLE IF NOT EXISTS hotel_special_requests_staging LIKE hotel_special_requests;
CREATE TABLE IF NOT EXISTS hotel_special_conditions_staging LIKE hotel_special_conditions;
CREATE TABLE IF NOT EXISTS hotel_pricing_rules_staging LIKE hotel_pricing_rules;

SELECT 'Staging tables created' as status;
