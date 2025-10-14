## User tower inputs

`user_id` → Embedding (id)

`gender` → small categorical embedding (e.g., 4 values incl. unknown)

`recent_history_dishes` → last N dish ids (N = 20) as sequence → embed & average / attention

`allergy` (list of food_tag names) → multi-hot or embed each tag & average

`dislike_taste` (list of taste_tag names) → multi-hot or embed & average

`dislike_food` (list of food_tag names) → multi-hot or embed & average

`dislike_cooking_method` (list of cooking_method_tag names) → multi-hot or embed & average

`dislike_culture` (list of culture_tag names) → multi-hot or embed & average

`like_taste` (list of taste_tag names) → multi-hot or embed & average

`like_food` (list of food_tag names) → multi-hot or embed & average

`like_cooking_method` (list of cooking_method_tag names) → multi-hot or embed & average

`like_culture` (list of culture_tag names) → multi-hot or embed & average



**Hard filters** (outside model): `allergy` and `dislike_taste` must be used as exclusion rules at serving time 
(these are NOT soft features — they are hard constraints for FP penalties per your requirement).

## Context features (optional input to both towers)

`time_of_day` → cyclical transform (sin/cos) or embedding of binned hour (24 bins).

`day_of_week` → embedding (7 bins).

`recency` → scalar (days since last order), scaled.