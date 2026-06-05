-- Migration: remove start/end, add arrivalAt to flight table
-- Date: 2026-06-02

USE focus_fly;

-- Add arrivalAt column (copy from end)
ALTER TABLE `flight` ADD COLUMN `arrivalAt` INT NOT NULL DEFAULT 0 AFTER `takeoffAt`;

-- Migrate existing data
UPDATE `flight` SET `arrivalAt` = `end`;

-- Drop old columns
ALTER TABLE `flight` DROP COLUMN `start`;
ALTER TABLE `flight` DROP COLUMN `end`;
