import pandas as pd
import torch
from torch.utils.data import Dataset
from typing import Dict
from datetime import datetime
from src.data_preprocessor import DataPreprocessor

class Dataset(Dataset):
    """PyTorch Dataset for mock data."""
    
    def __init__(self, interactions_df: pd.DataFrame, users_df: pd.DataFrame, 
                 dishes_df: pd.DataFrame, preprocessor: DataPreprocessor):
        self.interactions_df = interactions_df
        self.users_df = users_df
        self.dishes_df = dishes_df
        self.preprocessor = preprocessor
        
        # Create lookup dictionaries
        self.users_lookup = users_df.set_index('id').to_dict('index')
        self.dishes_lookup = dishes_df.set_index('id').to_dict('index')
        
        # Create vocabulary mappings
        self._create_vocabularies()
        
    def _create_vocabularies(self):
        """Create vocabulary mappings for categorical features."""
        # User vocabulary
        self.user_vocab = {user_id: idx for idx, user_id in enumerate(self.users_df['id'].unique())}
        self.user_vocab_size = len(self.user_vocab)
        
        # Dish vocabulary
        self.dish_vocab = {dish_id: idx for idx, dish_id in enumerate(self.dishes_df['id'].unique())}
        self.dish_vocab_size = len(self.dish_vocab)
        
        # Store vocabulary
        self.store_vocab = {store_id: idx for idx, store_id in enumerate(self.dishes_df['store_id'].unique())}
        self.store_vocab_size = len(self.store_vocab)
        
        # Category vocabulary
        self.category_vocab = {cat: idx for idx, cat in enumerate(self.dishes_df['category'].unique())}
        self.category_vocab_size = len(self.category_vocab)
        
        # Tag vocabularies
        self.tag_vocab = {}
        tag_id = 0
        
        # Food tags
        for _, row in self.preprocessor.food_tag_map.items():
            self.tag_vocab[row] = tag_id
            tag_id += 1
        
        # Taste tags
        for _, row in self.preprocessor.taste_tag_map.items():
            self.tag_vocab[row] = tag_id
            tag_id += 1
        
        # Cooking method tags
        for _, row in self.preprocessor.cooking_tag_map.items():
            self.tag_vocab[row] = tag_id
            tag_id += 1
        
        # Culture tags
        for _, row in self.preprocessor.culture_tag_map.items():
            self.tag_vocab[row] = tag_id
            tag_id += 1
        
        self.tag_vocab_size = len(self.tag_vocab)
        
        # Taste vocabulary (separate from tags)
        self.taste_vocab = {taste: idx for idx, taste in enumerate(self.preprocessor.taste_tag_map.values())}
        self.taste_vocab_size = len(self.taste_vocab)
    
    def __len__(self):
        return len(self.interactions_df)
    
    def __getitem__(self, idx):
        row = self.interactions_df.iloc[idx]
        
        user_id = row['user_id']
        dish_id = row['dish_id']
        
        # Get user and dish data
        user_data = self.users_lookup[user_id]
        dish_data = self.dishes_lookup[dish_id]
        
        # Extract timestamp
        timestamp = pd.to_datetime(row['timestamp'])
        
        # Encode user features (pass user_id separately since it's not in user_data)
        user_features = self._encode_user_features(user_data, user_id, timestamp)
        
        # Encode dish features (pass dish_id separately since it's not in dish_data)
        dish_features = self._encode_dish_features(dish_data, dish_id, timestamp)
        
        # Create label (1 for positive interactions, 0 for negative)
        label = 1 if row['interaction_type'] in ['order', 'rating'] else 0
        
        return user_features, dish_features, torch.tensor(label, dtype=torch.float)
    
    def _encode_user_features(self, user_data: Dict, user_id: str, timestamp: datetime) -> Dict[str, torch.Tensor]:
        """Encode user features."""
        # Basic features
        user_id_tensor = torch.tensor(self.user_vocab[user_id], dtype=torch.long)
        age = torch.tensor(user_data['age'] / 100.0, dtype=torch.float)  # Normalize age
        
        # Gender encoding (0: unknown, 1: male, 2: female)
        gender_map = {'male': 1, 'female': 2, 'unknown': 0}
        gender = torch.tensor(gender_map.get(user_data['gender'], 0), dtype=torch.long)
        
        # Location
        location = torch.tensor([
            user_data['location_lat'],
            user_data['location_lon']
        ], dtype=torch.float)
        
        # Time features
        time_of_day = torch.tensor(timestamp.hour / 24.0, dtype=torch.float)
        day_of_week = torch.tensor(timestamp.weekday(), dtype=torch.long)
        
        # Recency (days since last interaction - simplified)
        recency = torch.tensor(0.0, dtype=torch.float)  # Simplified for mock data
        
        return {
            'user_id': user_id_tensor,
            'age': age,
            'gender': gender,
            'location': location,
            'time_of_day': time_of_day,
            'day_of_week': day_of_week,
            'recency': recency
        }
    
    def _encode_dish_features(self, dish_data: Dict, dish_id: str, timestamp: datetime) -> Dict[str, torch.Tensor]:
        """Encode dish features."""
        # Basic features
        dish_id_tensor = torch.tensor(self.dish_vocab[dish_id], dtype=torch.long)
        store_id = torch.tensor(self.store_vocab[dish_data['store_id']], dtype=torch.long)
        
        # Category
        category = torch.tensor(self.category_vocab[dish_data['category']], dtype=torch.long)
        
        # Price (normalized)
        price = torch.tensor(dish_data['price'] / 100000.0, dtype=torch.float)  # Normalize to 0-1
        
        # Order times and rating
        order_times = torch.tensor(dish_data.get('order_times', 0) / 100.0, dtype=torch.float)
        rating = torch.tensor(dish_data.get('rating', 3.0) / 5.0, dtype=torch.float)
        
        # Location
        location = torch.tensor([
            dish_data['location_lat'],
            dish_data['location_lon']
        ], dtype=torch.float)
        
        # Time features
        time_of_day = torch.tensor(timestamp.hour / 24.0, dtype=torch.float)
        day_of_week = torch.tensor(timestamp.weekday(), dtype=torch.long)
        
        # Tags (simplified - use first few tags)
        tags = torch.zeros(10, dtype=torch.long)  # Max 10 tags
        tastes = torch.zeros(5, dtype=torch.long)  # Max 5 tastes
        
        # Parse tags from dish data
        try:
            food_tags = eval(dish_data.get('food_tags', '[]'))
            taste_tags = eval(dish_data.get('taste_tags', '[]'))
            cooking_tags = eval(dish_data.get('cooking_method_tags', '[]'))
            culture_tags = eval(dish_data.get('culture_tags', '[]'))
            
            # Combine all tags
            all_tags = food_tags + taste_tags + cooking_tags + culture_tags
            all_tastes = taste_tags
            
            # Fill tags tensor
            for i, tag_id in enumerate(all_tags[:10]):
                if tag_id in self.preprocessor.food_tag_map:
                    tag_name = self.preprocessor.food_tag_map[tag_id]
                    if tag_name in self.tag_vocab:
                        tags[i] = self.tag_vocab[tag_name]
            
            # Fill tastes tensor
            for i, taste_id in enumerate(all_tastes[:5]):
                if taste_id in self.preprocessor.taste_tag_map:
                    taste_name = self.preprocessor.taste_tag_map[taste_id]
                    if taste_name in self.taste_vocab:
                        tastes[i] = self.taste_vocab[taste_name]
        
        except:
            pass  # Use default zeros if parsing fails
        
        return {
            'dish_id': dish_id_tensor,
            'store_id': store_id,
            'tags': tags,
            'tastes': tastes,
            'category': category,
            'price': price,
            'order_times': order_times,
            'rating': rating,
            'location': location,
            'time_of_day': time_of_day,
            'day_of_week': day_of_week
        }
