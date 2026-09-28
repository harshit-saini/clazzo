-- Adds ACCOUNTANT so an institute can hire fee-handling staff without
-- granting full OWNER access.
ALTER TYPE "StaffRole" ADD VALUE 'ACCOUNTANT';
