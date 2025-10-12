## User tower inputs

`user_id` → Embedding (id)

`age` (computed from date_of_birth) → numeric, standardize

`gender` → small categorical embedding (e.g., 4 values incl. unknown)

`location_lat`, `location_lon` → normalized floats (optionally convert to tile/geohash and embed)

`recent_history_dishes` → last N dish ids (N = 20) as sequence → embed & average / attention

`allergy` (list of food_tag ids) → multi-hot or embed each tag & average

`dislike_taste` (list of taste_tag ids) → multi-hot or embed & average

**Hard filters** (outside model): `allergy` and `dislike_taste` must be used as exclusion rules at serving time 
(these are NOT soft features — they are hard constraints for FP penalties per your requirement).

## Context features (optional input to both towers)

`time_of_day` → cyclical transform (sin/cos) or embedding of binned hour (24 bins).

`day_of_week` → embedding (7 bins).

`recency` → scalar (days since last order), scaled.