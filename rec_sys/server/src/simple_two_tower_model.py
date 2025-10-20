import os
import sys
import numpy as np
import torch
import torch.nn as nn
import random

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set random seeds for reproducibility
torch.manual_seed(42)
np.random.seed(42)
random.seed(42)


class SimpleTwoTowerModel(nn.Module):
    """Simplified two-tower model for mock data training."""
    
    def __init__(self, user_vocab_size: int, dish_vocab_size: int, store_vocab_size: int,
                 tag_vocab_size: int, taste_vocab_size: int, category_vocab_size: int,
                 embedding_dim: int = 64):
        super().__init__()
        self.embedding_dim = embedding_dim
        
        # User tower
        self.user_embedding = nn.Embedding(user_vocab_size, embedding_dim)
        self.user_age = nn.Linear(1, embedding_dim // 4)
        self.user_gender = nn.Embedding(3, embedding_dim // 4)
        self.user_location = nn.Linear(2, embedding_dim // 4)
        self.user_time = nn.Linear(1, embedding_dim // 8)
        self.user_day = nn.Embedding(7, embedding_dim // 8)
        self.user_recency = nn.Linear(1, embedding_dim // 4)
        
        # Item tower
        self.dish_embedding = nn.Embedding(dish_vocab_size, embedding_dim)
        self.store_embedding = nn.Embedding(store_vocab_size, embedding_dim // 2)
        self.tag_embedding = nn.Embedding(tag_vocab_size, embedding_dim // 4)
        self.taste_embedding = nn.Embedding(taste_vocab_size, embedding_dim // 4)
        self.category_embedding = nn.Embedding(category_vocab_size, embedding_dim // 4)
        self.dish_price = nn.Linear(1, embedding_dim // 4)
        self.dish_order_times = nn.Linear(1, embedding_dim // 8)
        self.dish_rating = nn.Linear(1, embedding_dim // 8)
        self.dish_location = nn.Linear(2, embedding_dim // 4)
        self.dish_time = nn.Linear(1, embedding_dim // 8)
        self.dish_day = nn.Embedding(7, embedding_dim // 8)
        
        # Final projection layers
        user_input_dim = embedding_dim + embedding_dim // 4 + embedding_dim // 4 + embedding_dim // 4 + embedding_dim // 8 + embedding_dim // 8 + embedding_dim // 4
        item_input_dim = embedding_dim + embedding_dim // 2 + embedding_dim // 4 + embedding_dim // 4 + embedding_dim // 4 + embedding_dim // 4 + embedding_dim // 8 + embedding_dim // 8 + embedding_dim // 4 + embedding_dim // 8 + embedding_dim // 8
        
        self.user_projection = nn.Linear(user_input_dim, embedding_dim)
        self.item_projection = nn.Linear(item_input_dim, embedding_dim)
        
    def forward(self, user_features, item_features):
        # User tower
        user_emb = self.user_embedding(user_features['user_id'])
        user_age_emb = self.user_age(user_features['age'].unsqueeze(-1))
        user_gender_emb = self.user_gender(user_features['gender'])
        user_loc_emb = self.user_location(user_features['location'])
        user_time_emb = self.user_time(user_features['time_of_day'].unsqueeze(-1))
        user_day_emb = self.user_day(user_features['day_of_week'])
        user_rec_emb = self.user_recency(user_features['recency'].unsqueeze(-1))
        
        user_combined = torch.cat([
            user_emb, user_age_emb, user_gender_emb, user_loc_emb,
            user_time_emb, user_day_emb, user_rec_emb
        ], dim=-1)
        user_embedding = self.user_projection(user_combined)
        
        # Item tower
        item_emb = self.dish_embedding(item_features['dish_id'])
        store_emb = self.store_embedding(item_features['store_id'])
        
        # Handle tags (mean pooling)
        tag_emb = self.tag_embedding(item_features['tags'])
        tag_mask = (item_features['tags'] != 0).float().unsqueeze(-1)
        tag_emb = (tag_emb * tag_mask).sum(dim=1) / (tag_mask.sum(dim=1) + 1e-8)
        
        # Handle tastes (mean pooling)
        taste_emb = self.taste_embedding(item_features['tastes'])
        taste_mask = (item_features['tastes'] != 0).float().unsqueeze(-1)
        taste_emb = (taste_emb * taste_mask).sum(dim=1) / (taste_mask.sum(dim=1) + 1e-8)
        
        category_emb = self.category_embedding(item_features['category'])
        price_emb = self.dish_price(item_features['price'].unsqueeze(-1))
        order_times_emb = self.dish_order_times(item_features['order_times'].unsqueeze(-1))
        rating_emb = self.dish_rating(item_features['rating'].unsqueeze(-1))
        item_loc_emb = self.dish_location(item_features['location'])
        item_time_emb = self.dish_time(item_features['time_of_day'].unsqueeze(-1))
        item_day_emb = self.dish_day(item_features['day_of_week'])
        
        item_combined = torch.cat([
            item_emb, store_emb, tag_emb, taste_emb, category_emb,
            price_emb, order_times_emb, rating_emb, item_loc_emb,
            item_time_emb, item_day_emb
        ], dim=-1)
        item_embedding = self.item_projection(item_combined)
        
        # Normalize embeddings
        user_embedding = nn.functional.normalize(user_embedding, p=2, dim=-1)
        item_embedding = nn.functional.normalize(item_embedding, p=2, dim=-1)
        
        # Compute similarity scores
        scores = torch.sum(user_embedding * item_embedding, dim=-1)
        
        return user_embedding, item_embedding, scores
