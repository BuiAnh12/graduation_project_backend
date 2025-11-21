import ast
import torch
import pandas as pd
import numpy as np
from torch.utils.data import Dataset
from typing import Dict, List, Tuple, Any
from datetime import datetime
from src.data_preprocessor import DataPreprocessor
import random

class FoodRecommendationDataset(Dataset):
    """
    PyTorch Dataset that prepares user, dish, and context features 
    for the recommendation model.
    """

    def __init__(self, interactions_df: pd.DataFrame, users_df: pd.DataFrame, 
                 dishes_df: pd.DataFrame):
        
        # 1. Basic Validation
        if users_df.empty or 'id' not in users_df.columns:
            raise ValueError("Users DataFrame is empty or missing 'id' column.")
        if dishes_df.empty or 'id' not in dishes_df.columns:
            raise ValueError("Dishes DataFrame is empty or missing 'id' column.")

        self.interactions_df = interactions_df
        self.users_df = users_df
        self.dishes_df = dishes_df

        # 2. Create Fast Lookups (Index -> Data Row)
        # This makes retrieving user/dish details during training much faster
        self.users_lookup = users_df.set_index('id').to_dict('index')
        self.dishes_lookup = dishes_df.set_index('id').to_dict('index')

        # 3. Build Vocabularies (Map Strings -> Integer IDs)
        self._create_vocabularies()

    def _create_vocabularies(self):
        """
        Maps categorical data (IDs, Tags) to integers for the Embedding layers.
        """
        # --- Entity Vocabularies ---
        # We add <UNK> (Unknown) at index 0 to handle missing or new items safely
        
        # Users
        user_ids = self.users_df['id'].unique()
        self.user_vocab = {uid: idx + 1 for idx, uid in enumerate(user_ids)}
        self.user_vocab['<UNK>'] = 0
        self.user_vocab_size = len(self.user_vocab)

        # Dishes
        dish_ids = self.dishes_df['id'].unique()
        self.dish_vocab = {did: idx + 1 for idx, did in enumerate(dish_ids)}
        self.dish_vocab['<UNK>'] = 0
        self.dish_vocab_size = len(self.dish_vocab)

        # Stores
        store_ids = self.dishes_df['store_id'].dropna().unique() if 'store_id' in self.dishes_df.columns else []
        self.store_vocab = {sid: idx + 1 for idx, sid in enumerate(store_ids)}
        self.store_vocab['<UNK>'] = 0
        self.store_vocab_size = len(self.store_vocab)

        # Categories
        categories = self.dishes_df['category'].dropna().unique() if 'category' in self.dishes_df.columns else []
        self.category_vocab = {cat: idx + 1 for idx, cat in enumerate(categories)}
        self.category_vocab['<UNK>'] = 0
        self.category_vocab_size = len(self.category_vocab)

        # --- Combined Tag Vocabulary ---
        # We merge Food, Taste, Cooking, and Culture tags into one large vocabulary
        self.tag_vocab = {'<PAD>': 0, '<UNK>': 1} 
        tag_id_counter = 2
        all_unique_tags = set()
        
        tag_cols = ['food_tags', 'taste_tags', 'cooking_method_tags', 'culture_tags']

        for col in tag_cols:
            if col in self.dishes_df.columns:
                # Parse string lists "['tag1', 'tag2']" into actual lists
                parsed_col = self.dishes_df[col].apply(lambda x: self._safe_literal_eval(x, default=[]))
                for tag_list in parsed_col:
                    if isinstance(tag_list, list):
                        all_unique_tags.update(tag for tag in tag_list if isinstance(tag, str))

        for tag in sorted(list(all_unique_tags)):
            self.tag_vocab[tag] = tag_id_counter
            tag_id_counter += 1
            
        self.tag_vocab_size = len(self.tag_vocab)
        print(f"Dataset Initialized: {len(self.interactions_df)} interactions.")
        print(f" - Vocab Sizes: User={self.user_vocab_size}, Dish={self.dish_vocab_size}, Tags={self.tag_vocab_size}")

    def __len__(self):
        return len(self.interactions_df)

    def __getitem__(self, idx):
        row = self.interactions_df.iloc[idx]
        timestamp = row['timestamp']

        # --- 1. NEGATIVE SAMPLING STRATEGY (Crucial) ---
        # We flip a coin. 50% of the time, we show the model a "Fake" (Negative) dish.
        # This teaches the model to differentiate between good and bad matches.
        if random.random() < 0.5:
            # --- NEGATIVE BRANCH ---
            # 1. Get Real User
            user_id = row['user_id']
            user_data = self.users_lookup.get(user_id)
            if user_data is None: 
                # Fallback for safety
                user_features = self._get_dummy_user_features(timestamp)
            else:
                user_features = self._encode_user_features(user_data, user_id, timestamp)

            # 2. Pick a Random "Wrong" Dish
            all_dish_ids = list(self.dish_vocab.keys())
            # Remove special tokens
            for token in ['<UNK>', '<PAD>', 0]:
                if token in all_dish_ids: all_dish_ids.remove(token)
            
            # Pick random dish that is NOT the current one
            current_dish_id = row['dish_id']
            neg_dish_id = random.choice(all_dish_ids)
            while neg_dish_id == current_dish_id:
                neg_dish_id = random.choice(all_dish_ids)

            neg_dish_data = self.dishes_lookup.get(neg_dish_id)
            
            # 3. Encode Negative Dish
            # Handle potential lookup failure for random dish
            if neg_dish_data is None:
                 dish_features = self._get_dummy_dish_features(timestamp)
            else:
                 dish_features = self._encode_dish_features(neg_dish_data, neg_dish_id, timestamp)

            # LABEL IS 0.0 FOR NEGATIVE SAMPLE
            return user_features, dish_features, torch.tensor(0.0, dtype=torch.float)

        else:
            # --- 2. POSITIVE BRANCH (Real Data) ---
            user_id = row['user_id']
            dish_id = row['dish_id']
            
            user_data = self.users_lookup.get(user_id)
            dish_data = self.dishes_lookup.get(dish_id)

            if user_data is None: user_features = self._get_dummy_user_features(timestamp)
            else: user_features = self._encode_user_features(user_data, user_id, timestamp)

            if dish_data is None: dish_features = self._get_dummy_dish_features(timestamp)
            else: dish_features = self._encode_dish_features(dish_data, dish_id, timestamp)

            # --- FIX COLUMN NAME HERE ---
            # Check 'status' column instead of 'interaction_type'
            status = str(row.get('status', '')).lower().strip()
            
            # Check 'rating_value' if it exists (optional, but good practice)
            rating = row.get('rating_value')
            has_rating = pd.notna(rating) and str(rating).strip() != ''

            if status == 'done' or has_rating:
                label = 1.0
            else:
                # If the row exists but status isn't done, do we treat it as 1 or 0?
                # Usually, if it's in the transaction table, it implies interest, 
                # but sticking to 'done' is safer.
                label = 0.0

            return user_features, dish_features, torch.tensor(label, dtype=torch.float)

    # --- Feature Encoding Methods ---

    def _encode_user_features(self, user_data: Dict, user_id: str, timestamp: datetime) -> Dict[str, torch.Tensor]:
        # ID
        uid_idx = self.user_vocab.get(user_id, self.user_vocab['<UNK>'])
        
        # Demographics
        age = (user_data.get('age', 25) / 100.0) # Normalize 0-1
        gender_map = {'male': 1, 'female': 2}
        gender_idx = gender_map.get(user_data.get('gender', 'unknown'), 0) # 0 is Unknown

        # Context
        time_val = timestamp.hour / 24.0
        day_val = timestamp.weekday()

        def encode_tags(tag_list, max_len=10):
            t_tensor = torch.zeros(max_len, dtype=torch.long)
            if isinstance(tag_list, list):
                # Filter only strings, truncate to max_len
                valid_tags = [t for t in tag_list if isinstance(t, str)][:max_len]
                for i, t in enumerate(valid_tags):
                    t_tensor[i] = self.tag_vocab.get(t, 1) # 1 is <UNK>
            return t_tensor

        return {
            'user_id': torch.tensor(uid_idx, dtype=torch.long),
            'age': torch.tensor(age, dtype=torch.float),
            'gender': torch.tensor(gender_idx, dtype=torch.long),
            'time_of_day': torch.tensor(time_val, dtype=torch.float),
            'day_of_week': torch.tensor(day_val, dtype=torch.long),

            'liked_tags': encode_tags(user_data.get('liked_tags', [])),
            'disliked_tags': encode_tags(user_data.get('disliked_tags', [])),
            'allergy_tags': encode_tags(user_data.get('allergy_tags', []))
        }

    def _encode_dish_features(self, dish_data: Dict, dish_id: str, timestamp: datetime) -> Dict[str, torch.Tensor]:
        # IDs
        did_idx = self.dish_vocab.get(dish_id, self.dish_vocab['<UNK>'])
        sid_idx = self.store_vocab.get(dish_data.get('store_id'), self.store_vocab['<UNK>'])
        cat_idx = self.category_vocab.get(dish_data.get('category'), self.category_vocab['<UNK>'])

        # Numerical
        price = dish_data.get('price', 0) / 100000.0 # Normalize
        rating = dish_data.get('rating', 3.0) / 5.0  # Normalize

        # Context
        time_val = timestamp.hour / 24.0
        day_val = timestamp.weekday()

        # Tags Processing (Combine all 4 tag types into one vector)
        tags_tensor = torch.zeros(10, dtype=torch.long) # Max 10 tags, padded with 0
        collected_tags = []
        
        for col in ['food_tags', 'taste_tags', 'cooking_method_tags', 'culture_tags']:
            raw_tags = dish_data.get(col, '[]')
            tag_list = self._safe_literal_eval(raw_tags, default=[])
            if isinstance(tag_list, list):
                collected_tags.extend([t for t in tag_list if isinstance(t, str)])

        # Fill Tensor
        unique_tags = list(set(collected_tags))[:10] # Take unique, truncate to 10
        for i, tag_str in enumerate(unique_tags):
            tags_tensor[i] = self.tag_vocab.get(tag_str, self.tag_vocab['<UNK>'])

        return {
            'dish_id': torch.tensor(did_idx, dtype=torch.long),
            'store_id': torch.tensor(sid_idx, dtype=torch.long),
            'category': torch.tensor(cat_idx, dtype=torch.long),
            'tags': tags_tensor,
            'price': torch.tensor(price, dtype=torch.float),
            'rating': torch.tensor(rating, dtype=torch.float),
            'time_of_day': torch.tensor(time_val, dtype=torch.float),
            'day_of_week': torch.tensor(day_val, dtype=torch.long),
        }

    # --- Helper Methods ---

    def _safe_literal_eval(self, x, default=None):
        """Safely parses string representation of python objects."""
        if pd.isna(x) or not isinstance(x, str):
            return default
        try:
            return ast.literal_eval(x)
        except (ValueError, SyntaxError):
            return default

    def _get_dummy_user_features(self, timestamp):
        """Returns default/unknown features for missing users."""
        return self._encode_user_features({}, 'dummy_user', timestamp)

    def _get_dummy_dish_features(self, timestamp):
        """Returns default/unknown features for missing dishes."""
        return self._encode_dish_features({}, 'dummy_dish', timestamp)