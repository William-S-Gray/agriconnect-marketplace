-- Server-side shopping cart.
--
-- The cart used to live in localStorage alongside the auth state. Moving it
-- into the database keeps the browser free of application state entirely, and
-- makes the cart survive across devices. Rows are scoped to a buyer profile, so
-- ownership is a foreign key rather than a check the API has to remember.

CREATE TABLE cart_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id   UUID          NOT NULL REFERENCES buyers(id)   ON DELETE CASCADE,
  listing_id UUID          NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  quantity   NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- One row per listing per buyer; adding again adjusts the quantity.
  UNIQUE (buyer_id, listing_id)
);

CREATE INDEX cart_items_buyer_id_idx ON cart_items(buyer_id);
