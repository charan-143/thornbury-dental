-- Stop a clinician being double booked, in the database rather than in a check
-- the application has to remember to run.
--
-- An earlier version of this product computed availability by comparing start
-- times only, so a sixty minute appointment blocked its first half hour and
-- nothing else. Two bookings could then sit on top of each other. Application
-- logic alone cannot close that hole: two concurrent requests can both pass
-- the same check and both insert.
--
-- An exclusion constraint removes the race. Postgres refuses the second write
-- itself, whatever the calling code believes.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- The span an appointment occupies. This cannot be a generated column: adding
-- an interval to a timestamptz is only STABLE, not IMMUTABLE, because the
-- result depends on the session time zone across a daylight saving boundary,
-- and generated columns require immutability. A trigger maintains it instead,
-- which keeps the value just as impossible to set wrongly from application code.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS period tstzrange;

CREATE OR REPLACE FUNCTION appointments_set_period() RETURNS TRIGGER AS $fn$
BEGIN
  -- Half open, so an appointment ending at 10:00 and one starting at 10:00 do
  -- not count as overlapping.
  NEW.period := tstzrange(
    NEW.starts_at,
    NEW.starts_at + make_interval(mins => NEW.duration_min),
    '[)'
  );
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_period ON appointments;
CREATE TRIGGER appointments_period
  BEFORE INSERT OR UPDATE OF starts_at, duration_min ON appointments
  FOR EACH ROW EXECUTE FUNCTION appointments_set_period();

-- Backfill anything that predates the trigger.
UPDATE appointments
   SET period = tstzrange(starts_at, starts_at + make_interval(mins => duration_min), '[)')
 WHERE period IS NULL;

ALTER TABLE appointments ALTER COLUMN period SET NOT NULL;

-- Cancelled appointments are excluded: releasing the slot is the point of
-- cancelling one.
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap') THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_no_overlap
      EXCLUDE USING gist (clinician_id WITH =, period WITH &&)
      WHERE (status <> 'cancelled');
  END IF;
END
$mig$;
