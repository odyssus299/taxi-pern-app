CREATE TABLE IF NOT EXISTS admins (
  id          BIGSERIAL PRIMARY KEY,
  first_name  TEXT        NOT NULL CHECK (length(btrim(first_name)) > 0),
  last_name   TEXT        NOT NULL DEFAULT '' CHECK (length(btrim(last_name)) >= 0),
  email       TEXT        NOT NULL UNIQUE,
  password    TEXT        NOT NULL CHECK (length(password) >= 10),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Τελική απόφαση: κρατάμε ΜΟΝΟ created_at
ALTER TABLE admins DROP COLUMN IF EXISTS updated_at;

-- 3) Προσθήκη τηλεφώνου + κανόνες
ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3a) Γέμισε έγκυρη τιμή όπου λείπει/δεν ταιριάζει στο pattern (προσαρμόζεις τον αριθμό)
UPDATE admins
SET phone = '6900000000'
WHERE phone IS NULL OR phone !~ '^[0-9]{10,15}$';

-- 3b) Κάν’ το υποχρεωτικό
ALTER TABLE admins
  ALTER COLUMN phone SET NOT NULL;

-- 3c) Έλεγχος μορφής: 10–15 ψηφία
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_phone_ck;
ALTER TABLE admins
  ADD CONSTRAINT admins_phone_ck CHECK (phone ~ '^[0-9]{10,15}$');

-- (Προαιρετικό) Seed admin για δοκιμές
-- INSERT INTO admins (first_name, last_name, email, phone, password)
-- VALUES ('Admin', 'Root', 'admin@example.com', '6900000000', 'AdminStrong1!');

-- Γρήγορος έλεγχος
-- SELECT id, first_name, last_name, email, phone, created_at FROM admins;

CREATE TABLE IF NOT EXISTS drivers (
  id              BIGSERIAL PRIMARY KEY,

  first_name      TEXT        NOT NULL CHECK (length(btrim(first_name)) > 0),
  last_name       TEXT        NOT NULL CHECK (length(btrim(last_name)) > 0),

  email           TEXT        NOT NULL
                               CHECK (email ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'),
  phone           TEXT        NOT NULL
                               CHECK (phone ~ '^[0-9]{10,}$'),

  car_number      TEXT        NOT NULL
                               CHECK (car_number ~ '^[Α-Ω]{3}-[0-9]{4}$'),

  password        TEXT        NOT NULL CHECK (length(password) >= 10),

  status          TEXT        NOT NULL DEFAULT 'offline'
                               CHECK (status IN ('available','on_ride','offline')),

  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),

  average_rating  NUMERIC(3,1) NOT NULL DEFAULT 0.0 CHECK (average_rating >= 0 AND average_rating <= 5),
  rating_count    INTEGER      NOT NULL DEFAULT 0   CHECK (rating_count >= 0),

  role            TEXT        NOT NULL DEFAULT 'driver' CHECK (role = 'driver'),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ΜΟΝΟ case-insensitive μοναδικότητα στο email
DROP INDEX IF EXISTS drivers_email_lower_ux;
CREATE UNIQUE INDEX drivers_email_lower_ux ON drivers ((lower(email)));

-- Optional sanity checks πριν το unique (τρέξε αν θες να ελέγξεις)
-- SELECT lower(email) AS e, COUNT(*) FROM drivers GROUP BY e HAVING COUNT(*) > 1;

ALTER TABLE drivers
  ADD CONSTRAINT drivers_car_number_ux UNIQUE (car_number);

  ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_email_check;
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_email_ck;

-- 2) Βάλε νέο, σταθερό CHECK για email
ALTER TABLE drivers
  ADD CONSTRAINT drivers_email_check
  CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$');


CREATE TABLE IF NOT EXISTS public.rides (
  id               BIGSERIAL PRIMARY KEY,
  driver_id        BIGINT NOT NULL
                   REFERENCES public.drivers(id) ON DELETE CASCADE,

  -- Κατάσταση διαδρομής
  status           TEXT NOT NULL DEFAULT 'completed'
                   CHECK (status IN ('pending','ongoing','completed','canceled')),

  -- Συντεταγμένες (προαιρετικές)
  pickup_lat       DOUBLE PRECISION,
  pickup_lng       DOUBLE PRECISION,
  dropoff_lat      DOUBLE PRECISION,
  dropoff_lng      DOUBLE PRECISION,
  CHECK (pickup_lat  IS NULL OR (pickup_lat  >= -90  AND pickup_lat  <= 90)),
  CHECK (pickup_lng  IS NULL OR (pickup_lng  >= -180 AND pickup_lng  <= 180)),
  CHECK (dropoff_lat IS NULL OR (dropoff_lat >= -90  AND dropoff_lat <= 90)),
  CHECK (dropoff_lng IS NULL OR (dropoff_lng >= -180 AND dropoff_lng <= 180)),

  -- Review flow
  review_token     TEXT NOT NULL,
  review_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  review_sent_at   TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Για σύνθετο FK από reviews ώστε να “δένει” και ο driver
  UNIQUE (id, driver_id)
);

ALTER TABLE public.rides
  DROP CONSTRAINT IF EXISTS rides_review_token_ck;
ALTER TABLE public.rides
  ADD CONSTRAINT rides_review_token_ck
  CHECK (length(btrim(review_token)) >= 6 AND review_token ~ '^[A-Za-z0-9_-]+$');

ALTER TABLE public.rides
  DROP CONSTRAINT IF EXISTS rides_review_token_ux;
ALTER TABLE public.rides
  ADD CONSTRAINT rides_review_token_ux UNIQUE (review_token);

  CREATE TABLE IF NOT EXISTS public.reviews (
  id          BIGSERIAL PRIMARY KEY,
  ride_id     BIGINT  NOT NULL,
  driver_id   BIGINT  NOT NULL,

  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  CHECK (comment IS NULL OR length(comment) <= 1000),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Δένει την κριτική με το ΣΥΓΚΕΚΡΙΜΕΝΟ ride+driver
  CONSTRAINT reviews_ride_fk
    FOREIGN KEY (ride_id, driver_id)
    REFERENCES public.rides (id, driver_id)
    ON DELETE CASCADE,

  -- Μία κριτική ανά διαδρομή
  CONSTRAINT reviews_one_per_ride_ux UNIQUE (ride_id)
);

-- (Προαιρετικά) Αν θες να βεβαιωθείς ότι δεν υπάρχουν “ορφανές” εγγραφές:
-- SELECT ride_id FROM public.reviews r
-- LEFT JOIN public.rides ri ON (ri.id = r.ride_id AND ri.driver_id = r.driver_id)
-- WHERE ri.id IS NULL;

-- Drop παλιού check (όποιο όνομα κι αν έχει)
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_ck;
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_check;

-- Νέο CHECK: επιτρεπόμενα status
ALTER TABLE public.rides
ADD CONSTRAINT rides_status_ck CHECK (
  status IN (
    'pending',      -- αίτημα στάλθηκε
    'accepted',     -- (αν το χρησιμοποιήσεις)
    'ongoing',      -- σε εξέλιξη
    'completed',    -- επιτυχής
    'rejected',     -- απόρριψη από οδηγό ή timeout 10s
    'problematic',  -- υποβλήθηκε αναφορά προβλήματος
    'canceled'      -- (αν το χρειαστείς σε άλλα flows)
  )
);

-- 1) Δες τι status υπάρχουν
SELECT status, COUNT(*) FROM public.rides GROUP BY status ORDER BY status;

-- 2) Μετατροπές παλιών τιμών → στις επιτρεπόμενες
UPDATE public.rides SET status = 'rejected' WHERE status IN ('canceled','cancelled');
UPDATE public.rides SET status = 'ongoing'  WHERE status = 'accepted';
UPDATE public.rides SET status = 'pending'  WHERE status IS NULL OR btrim(status) = '';

-- (προαιρετικό) ξανά-έλεγχος
SELECT status, COUNT(*) FROM public.rides GROUP BY status ORDER BY status;

-- 3) Ρίξε το παλιό constraint (αν υπάρχει) και πρόσθεσε νέο ως NOT VALID
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_ck;
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_check;

ALTER TABLE public.rides
ADD CONSTRAINT rides_status_ck CHECK (
  status IN ('pending','ongoing','completed','rejected','problematic')
) NOT VALID;

-- 4) Επιβεβαίωση (θα αποτύχει αν έμεινε “περίεργη” τιμή)
ALTER TABLE public.rides VALIDATE CONSTRAINT rides_status_ck;

-- ΜΟΝΟ προσθήκη πεδίων για τα δεδομένα του πελάτη/διεύθυνση
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS requester_first_name TEXT,
  ADD COLUMN IF NOT EXISTS requester_last_name  TEXT,
  ADD COLUMN IF NOT EXISTS requester_phone      TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address       TEXT;

-- Ελαφρύ validation για τηλέφωνο πελάτη (αν δοθεί)
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_req_phone_ck;
ALTER TABLE public.rides
  ADD CONSTRAINT rides_req_phone_ck
  CHECK (requester_phone IS NULL OR requester_phone ~ '^[0-9]{10,}$');

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS requester_email   TEXT;

ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_req_email_ck;
ALTER TABLE public.rides
  ADD CONSTRAINT rides_req_email_ck
  CHECK (requester_email IS NULL OR requester_email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$');

ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_req_phone_ck;
ALTER TABLE public.rides
  ADD CONSTRAINT rides_req_phone_ck
  CHECK (requester_phone IS NULL OR requester_phone ~ '^[0-9]{10,}$');


CREATE TABLE IF NOT EXISTS public.requests (
  id                  SERIAL PRIMARY KEY,
  driver_id           INTEGER NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  requested_first_name TEXT,
  requested_last_name  TEXT,
  requested_email      TEXT,
  requested_phone      TEXT,
  requested_car_number TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Προαιρετικά: για μελλοντική επέκταση (π.χ. reason/notes)
  -- reason TEXT
  CONSTRAINT requests_email_ck CHECK (
    requested_email IS NULL OR requested_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT requests_phone_ck CHECK (
    requested_phone IS NULL OR requested_phone ~ '^[0-9]{10,}$'
  ),
  CONSTRAINT requests_car_number_ck CHECK (
    requested_car_number IS NULL OR requested_car_number ~ '^[Α-Ω]{3}-[0-9]{4}$'
  )
);


CREATE TABLE IF NOT EXISTS public.admin_messages (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL CHECK (btrim(content) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.problems (
  id         SERIAL PRIMARY KEY,
  driver_id  INTEGER NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  ride_id    INTEGER     NULL REFERENCES public.rides(id)   ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (btrim(description) <> ''),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DELETE FROM public.problems WHERE ride_id IS NULL;

-- Κάνε το πεδίο υποχρεωτικό
ALTER TABLE public.problems
  ALTER COLUMN ride_id SET NOT NULL;


  CREATE TABLE IF NOT EXISTS public.users (
  id           BIGSERIAL PRIMARY KEY,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  password     TEXT NOT NULL,            -- (hash αργότερα)
  role         TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Basic validations
  CONSTRAINT users_email_ck CHECK (email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'),
  CONSTRAINT users_phone_ck CHECK (phone IS NULL OR phone ~ '^[0-9]{10,}$')
);

-- Case-insensitive μοναδικό email
DROP INDEX IF EXISTS users_email_lower_ux;
CREATE UNIQUE INDEX users_email_lower_ux ON public.users ((lower(email)));

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_email_ck;

-- 3) Ξαναπρόσθεσέ το, πιο «σωστό»
-- Χρησιμοποιώ btrim() και case-insensitive (~*), και αποφεύγω \s με POSIX [:space:]
ALTER TABLE public.users
  ADD CONSTRAINT users_email_ck
  CHECK (
    btrim(email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

  CREATE TABLE IF NOT EXISTS public.ride_candidates (
  id            BIGSERIAL PRIMARY KEY,
  ride_id       BIGINT NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id     BIGINT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL CHECK (position >= 1),
  status        TEXT NOT NULL CHECK (status IN ('queued','awaiting_response','rejected','accepted')),
  assigned_at   TIMESTAMPTZ,
  responded_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ride_id, driver_id),
  UNIQUE (ride_id, position)
);

-- Προαιρετικά index για pending αναθέσεις
CREATE INDEX IF NOT EXISTS ride_candidates_ride_id_ix ON public.ride_candidates (ride_id);
CREATE INDEX IF NOT EXISTS ride_candidates_status_ix  ON public.ride_candidates (status);

CREATE INDEX IF NOT EXISTS ride_candidates_ride_status_idx
ON public.ride_candidates (ride_id, status);

CREATE INDEX IF NOT EXISTS ride_candidates_ride_idx
ON public.ride_candidates (ride_id);

-- Σιγουρέψου ότι το rides έχει τα πεδία πελάτη/διεύθυνσης/συντεταγμένων
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS requester_first_name TEXT,
  ADD COLUMN IF NOT EXISTS requester_last_name  TEXT,
  ADD COLUMN IF NOT EXISTS requester_phone      TEXT,
  ADD COLUMN IF NOT EXISTS requester_email      TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address       TEXT;

ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_req_phone_ck;
ALTER TABLE public.rides
  ADD CONSTRAINT rides_req_phone_ck
  CHECK (requester_phone IS NULL OR requester_phone ~ '^[0-9]{10,}$');

ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_req_email_ck;
ALTER TABLE public.rides
  ADD CONSTRAINT rides_req_email_ck
  CHECK (requester_email IS NULL OR requester_email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$');

-- Προαιρετικά: index για driver_id + status pending (γρήγορη άντληση προτάσεων)
CREATE INDEX IF NOT EXISTS rides_driver_pending_ix
  ON public.rides (driver_id)
  WHERE status = 'pending';

-- Προαιρετικά: index για created_at (reports)
CREATE INDEX IF NOT EXISTS rides_created_at_ix ON public.rides (created_at);

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS user_id INTEGER
    REFERENCES public.users(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS rides_driver_pending_idx
ON public.rides (driver_id, created_at DESC)
WHERE status = 'pending';


ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_req_email_ck;

ALTER TABLE public.rides
ADD CONSTRAINT rides_req_email_ck
CHECK (
  requester_email IS NULL
  OR requester_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
);

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS review_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS rides_review_token_idx
  ON public.rides (review_token);

DROP INDEX IF EXISTS public.rides_review_token_idx;


CREATE INDEX IF NOT EXISTS rides_created_at_idx    ON public.rides(created_at);
CREATE INDEX IF NOT EXISTS reviews_created_at_idx  ON public.reviews(created_at);

CREATE INDEX IF NOT EXISTS problems_created_at_idx
  ON public.problems (created_at);

  -- βάλε χρόνο λήξης στην προσφορά του candidate
ALTER TABLE public.ride_candidates
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- επιτρέπουμε ΜΟΝΟ έναν awaiting ανά ride
CREATE UNIQUE INDEX IF NOT EXISTS ride_candidates_one_awaiting_per_ride
  ON public.ride_candidates (ride_id)
  WHERE status = 'awaiting_response';

-- γρήγορη αναζήτηση ληγμένων awaiting
CREATE INDEX IF NOT EXISTS ride_candidates_awaiting_expires_idx
  ON public.ride_candidates (expires_at)
  WHERE status = 'awaiting_response';

-- συχνό lookup: "τί περιμένει απάντηση για τον Χ οδηγό;"
CREATE INDEX IF NOT EXISTS ride_candidates_driver_status_idx
  ON public.ride_candidates (driver_id, status);

  CREATE UNIQUE INDEX IF NOT EXISTS ride_candidates_one_awaiting_per_ride
  ON public.ride_candidates (ride_id)
  WHERE status = 'awaiting_response';