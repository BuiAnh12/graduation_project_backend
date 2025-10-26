import pandas as pd
import torch
from torch.utils.data import Dataset
from typing import Dict
from datetime import datetime
import ast # Import ast for safe parsing
from src.data_preprocessor import DataPreprocessor

class Dataset(Dataset):
    """PyTorch Dataset for mock data."""

    def __init__(self, interactions_df: pd.DataFrame, users_df: pd.DataFrame,
                 dishes_df: pd.DataFrame, preprocessor: DataPreprocessor):
        self.interactions_df = interactions_df
        self.users_df = users_df
        self.dishes_df = dishes_df
        self.preprocessor = preprocessor

        # --- Handle potential empty dataframes ---
        if self.users_df.empty or 'id' not in self.users_df.columns:
             raise ValueError("Users DataFrame is empty or missing 'id' column.")
        if self.dishes_df.empty or 'id' not in self.dishes_df.columns:
             raise ValueError("Dishes DataFrame is empty or missing 'id' column.")
        # ----------------------------------------

        self.users_lookup = users_df.set_index('id').to_dict('index')
        self.dishes_lookup = dishes_df.set_index('id').to_dict('index')

        self._create_vocabularies()

    def _create_vocabularies(self):
        """Create vocabulary mappings for categorical features."""
        # --- Add <UNK> token (index 0) ---
        self.user_vocab = {'<UNK>': 0}
        self.user_vocab.update({user_id: idx + 1 for idx, user_id in enumerate(self.users_df['id'].unique())})
        self.user_vocab_size = len(self.user_vocab)

        self.dish_vocab = {'<UNK>': 0}
        self.dish_vocab.update({dish_id: idx + 1 for idx, dish_id in enumerate(self.dishes_df['id'].unique())})
        self.dish_vocab_size = len(self.dish_vocab)

        self.store_vocab = {'<UNK>': 0}
        # Ensure 'store_id' column exists and handle potential NaNs
        store_ids = self.dishes_df['store_id'].dropna().unique() if 'store_id' in self.dishes_df.columns else []
        self.store_vocab.update({store_id: idx + 1 for idx, store_id in enumerate(store_ids)})
        self.store_vocab_size = len(self.store_vocab)

        self.category_vocab = {'<UNK>': 0}
        # Use the default category defined in preprocessor if needed
        categories = self.dishes_df['category'].dropna().unique() if 'category' in self.dishes_df.columns else []
        self.category_vocab.update({cat: idx + 1 for idx, cat in enumerate(categories)})
        self.category_vocab_size = len(self.category_vocab)

        # --- Combined Tag Vocabulary from IDs ---
        self.tag_vocab = {'<PAD>': 0, '<UNK>': 1} # Padding and Unknown tokens
        tag_id_counter = 2
        all_unique_tag_ids = set()

        tag_columns = ['food_tags', 'taste_tags', 'cooking_method_tags', 'culture_tags']

        # Iterate through dishes dataframe to find all unique tag IDs
        for col in tag_columns:
            if col in self.dishes_df.columns:
                 # Apply safe eval to the column first
                 try:
                      parsed_tags = self.dishes_df[col].apply(lambda x: self._safe_literal_eval(x, default_value=[]))
                      # Flatten the list of lists and add unique IDs to the set
                      for tag_list in parsed_tags:
                           if isinstance(tag_list, list): # Ensure it's a list after eval
                                all_unique_tag_ids.update(tag for tag in tag_list if isinstance(tag, str)) # Add only strings
                 except Exception as e:
                      print(f"Warning: Error processing column {col} for tag vocabulary: {e}")


        # Build vocabulary from unique IDs
        for tag_id in sorted(list(all_unique_tag_ids)):
            if tag_id not in self.tag_vocab:
                self.tag_vocab[tag_id] = tag_id_counter
                tag_id_counter += 1

        self.tag_vocab_size = len(self.tag_vocab)
        print(f"Created combined tag vocabulary with {self.tag_vocab_size} unique tag IDs.")


    def __len__(self):
        return len(self.interactions_df)

    def __getitem__(self, idx):
        row = self.interactions_df.iloc[idx]

        user_id = row['user_id']
        dish_id = row['dish_id']
        timestamp = row['timestamp'] # Already datetime from preprocessor

        # Handle cases where user/dish from interaction might not be in lookup
        # (e.g., if data files are inconsistent)
        user_data = self.users_lookup.get(user_id)
        dish_data = self.dishes_lookup.get(dish_id)

        if user_data is None or dish_data is None:
            # Option 1: Skip this interaction
             print(f"Warning: Skipping interaction {idx} due to missing user ({user_id}) or dish ({dish_id}) lookup.")
             # To make DataLoader skip, return None (requires custom collate_fn) or raise IndexError
             # For simplicity, let's create dummy features for now, but skipping is better
             user_features = self._get_dummy_user_features(timestamp)
             dish_features = self._get_dummy_dish_features(timestamp)
             if user_data is None: user_features['user_id'] = torch.tensor(self.user_vocab['<UNK>'], dtype=torch.long)
             if dish_data is None: dish_features['dish_id'] = torch.tensor(self.dish_vocab['<UNK>'], dtype=torch.long)
            # Option 2: Raise error
            # raise ValueError(f"User {user_id} or Dish {dish_id} not found in lookups for interaction {idx}")

        else:
             user_features = self._encode_user_features(user_data, user_id, timestamp)
             dish_features = self._encode_dish_features(dish_data, dish_id, timestamp)

        # Label based on interaction type (adjust as needed)
        # Use .get() for safety if 'interaction_type' might be missing
        interaction_type = row.get('interaction_type', '')
        label = 1 if interaction_type in ['order', 'rating'] else 0 # Assuming 'rating' is positive

        return user_features, dish_features, torch.tensor(label, dtype=torch.float)

     # --- Add dummy feature methods for robustness ---
    def _get_dummy_user_features(self, timestamp):
         # Returns features with UNK or default values
         return {
            'user_id': torch.tensor(self.user_vocab['<UNK>'], dtype=torch.long),
            'age': torch.tensor(0.25, dtype=torch.float), # Default age ~25
            'gender': torch.tensor(0, dtype=torch.long), # Unknown
            'time_of_day': torch.tensor(timestamp.hour / 24.0, dtype=torch.float),
            'day_of_week': torch.tensor(timestamp.weekday(), dtype=torch.long),
         }

    def _get_dummy_dish_features(self, timestamp):
         # Returns features with UNK or default values
         return {
            'dish_id': torch.tensor(self.dish_vocab['<UNK>'], dtype=torch.long),
            'store_id': torch.tensor(self.store_vocab['<UNK>'], dtype=torch.long),
            'tags': torch.zeros(10, dtype=torch.long), # Use PAD index (0)
            'category': torch.tensor(self.category_vocab['<UNK>'], dtype=torch.long),
            'price': torch.tensor(0.5, dtype=torch.float), # Default price
            'rating': torch.tensor(3.0 / 5.0, dtype=torch.float), # Default rating
            'time_of_day': torch.tensor(timestamp.hour / 24.0, dtype=torch.float),
            'day_of_week': torch.tensor(timestamp.weekday(), dtype=torch.long),
         }
     # ---------------------------------------------

    def _encode_user_features(self, user_data: Dict, user_id: str, timestamp: datetime) -> Dict[str, torch.Tensor]:
        """Encode user features."""
        # Use .get() with defaults for safety
        user_id_tensor = torch.tensor(self.user_vocab.get(user_id, self.user_vocab['<UNK>']), dtype=torch.long)
        # Normalize age, handle potential missing value
        age = torch.tensor((user_data.get('age', 25)) / 100.0, dtype=torch.float)

        gender_map = {'male': 1, 'female': 2, 'unknown': 0}
        gender = torch.tensor(gender_map.get(user_data.get('gender', 'unknown'), 0), dtype=torch.long)

        # Time features
        time_of_day = torch.tensor(timestamp.hour / 24.0, dtype=torch.float)
        day_of_week = torch.tensor(timestamp.weekday(), dtype=torch.long)

        # --- REMOVED recency and location ---

        return {
            'user_id': user_id_tensor,
            'age': age,
            'gender': gender,
            # 'location': location, # Removed
            'time_of_day': time_of_day,
            'day_of_week': day_of_week,
            # 'recency': recency # Removed
        }

    def _encode_dish_features(self, dish_data: Dict, dish_id: str, timestamp: datetime) -> Dict[str, torch.Tensor]:
        """Encode dish features."""
        dish_id_tensor = torch.tensor(self.dish_vocab.get(dish_id, self.dish_vocab['<UNK>']), dtype=torch.long)
        store_id_val = dish_data.get('store_id') # Get store_id first
        store_id_tensor = torch.tensor(self.store_vocab.get(store_id_val, self.store_vocab['<UNK>']), dtype=torch.long)

        category_val = dish_data.get('category', 'unknown_category') # Use default if missing
        category_tensor = torch.tensor(self.category_vocab.get(category_val, self.category_vocab['<UNK>']), dtype=torch.long)

        # Use .get() with defaults and normalize
        price = torch.tensor(dish_data.get('price', 0) / 100000.0, dtype=torch.float)
        rating = torch.tensor(dish_data.get('rating', 3.0) / 5.0, dtype=torch.float)

        # Time features
        time_of_day = torch.tensor(timestamp.hour / 24.0, dtype=torch.float)
        day_of_week = torch.tensor(timestamp.weekday(), dtype=torch.long)

        # --- Combined Tags Encoding (using IDs) ---
        tags = torch.zeros(10, dtype=torch.long) # Use PAD index 0
        tag_idx_counter = 0
        all_tag_ids_for_dish: List[str] = [] # Collect all IDs first

        tag_columns = ['food_tags', 'taste_tags', 'cooking_method_tags', 'culture_tags']

        for col in tag_columns:
            try:
                # Safely parse the string list of IDs
                tag_id_list = self._safe_literal_eval(dish_data.get(col, '[]'), default_value=[])
                if isinstance(tag_id_list, list):
                     # Add only string IDs to the combined list
                     all_tag_ids_for_dish.extend([tid for tid in tag_id_list if isinstance(tid, str)])
            except Exception as e:
                # print(f"Warning: Error parsing tag column {col} for dish {dish_id}: {e}")
                pass

        # Fill the tensor using the combined list and tag_vocab (ID -> Index)
        unique_ids_for_dish = list(set(all_tag_ids_for_dish)) # Ensure uniqueness per dish if needed
        for tag_id in unique_ids_for_dish:
            if tag_idx_counter >= 10: break # Max 10 tags
            # Map the tag ID (string) to its vocabulary index (integer)
            tag_index = self.tag_vocab.get(tag_id, self.tag_vocab['<UNK>'])
            tags[tag_idx_counter] = tag_index
            tag_idx_counter += 1

        return {
            'dish_id': dish_id_tensor,
            'store_id': store_id_tensor,
            'tags': tags,          # Now contains all tag types
            # 'tastes': tastes,    # Removed
            'category': category_tensor,
            'price': price,
            # 'order_times': order_times, # Removed
            'rating': rating,
            # 'location': location,  # Removed
            'time_of_day': time_of_day,
            'day_of_week': day_of_week
        }

    # --- Add the safe parsing helper within Dataset as well ---
    def _safe_literal_eval(self, x, default_value=None):
         if pd.isna(x) or not isinstance(x, str):
            return default_value if default_value is not None else [] # Default to list for tags
         try:
            val = ast.literal_eval(x)
            # Basic type check after eval
            if default_value is not None and not isinstance(val, type(default_value)):
                 return default_value
            return val
         except (ValueError, SyntaxError, TypeError) as e:
            # print(f"Warning: Could not parse '{x}'. Error: {e}. Returning default.")
            return default_value if default_value is not None else []