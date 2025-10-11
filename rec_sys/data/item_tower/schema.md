## Item tower inputs (dish)

`dish_id` → Embedding (id)

`store_id` → Embedding (id)

`dish_tags` (list of food_tags) → embed each & average

`taste_tags` → embed each & average

`price` → log(price) then standardize

`order_times` (popularity count) → log + standardize

`avg_rating` → standardize

`system_category_id` → embedding

`lat`, `lon` → normalized floats (or tile/geohash embedding)

## Context features (optional input to both towers)

`time_of_day` → cyclical transform (sin/cos) or embedding of binned hour (24 bins).

`day_of_week` → embedding (7 bins).

`recency` → scalar (days since last order), scaled.