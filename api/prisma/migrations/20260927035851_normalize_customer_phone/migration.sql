-- This is an empty migration.
UPDATE "Customer"
SET
    phone = regexp_replace(phone, '\s', '', 'g')
WHERE
    phone IS NOT NULL;