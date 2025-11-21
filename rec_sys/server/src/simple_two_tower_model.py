import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict

class SimpleTwoTowerModel(nn.Module):
    def __init__(self, user_vocab_size, dish_vocab_size, store_vocab_size, tag_vocab_size, category_vocab_size, embedding_dim=64):
        super().__init__()
        self.embedding_dim = embedding_dim

        # --- 1. User Tower ---
        self.user_embedding = nn.Embedding(user_vocab_size, embedding_dim)
        self.user_age = nn.Linear(1, embedding_dim // 4)
        self.user_gender = nn.Embedding(3, embedding_dim // 4)
        self.user_time = nn.Linear(1, embedding_dim // 8)
        self.user_day = nn.Embedding(7, embedding_dim // 8)

        # --- 2. Item Tower ---
        self.dish_embedding = nn.Embedding(dish_vocab_size, embedding_dim)
        self.store_embedding = nn.Embedding(store_vocab_size, embedding_dim // 2)
        self.category_embedding = nn.Embedding(category_vocab_size, embedding_dim // 4)
        self.dish_price = nn.Linear(1, embedding_dim // 4)
        self.dish_rating = nn.Linear(1, embedding_dim // 8)
        self.dish_time = nn.Linear(1, embedding_dim // 8)
        self.dish_day = nn.Embedding(7, embedding_dim // 8)

        # Both Users (Preferences) and Dishes (Attributes) use this layer
        self.tag_embedding = nn.Embedding(tag_vocab_size, embedding_dim // 2)

        # --- 4. Dimensions Calculation ---
        # User: ID + Age + Gender + Time + Day + Likes + Dislikes + Allergies
        user_input_dim = (
            embedding_dim + 
            (embedding_dim // 4) + 
            (embedding_dim // 4) + 
            (embedding_dim // 8) + 
            (embedding_dim // 8) +
            (embedding_dim // 2) +  # Like
            (embedding_dim // 2) +  # Dislike
            (embedding_dim // 2)    # Allergy
        )

        # Item: ID + Store + Tags + Category + Price + Rating + Time + Day
        item_input_dim = (
            embedding_dim + 
            (embedding_dim // 2) + 
            (embedding_dim // 2) + # Dish Tags
            (embedding_dim // 4) + 
            (embedding_dim // 4) + 
            (embedding_dim // 8) + 
            (embedding_dim // 8) + 
            (embedding_dim // 8)
        )

        self.user_projection = nn.Linear(user_input_dim, embedding_dim)
        self.item_projection = nn.Linear(item_input_dim, embedding_dim)

    def _mean_pooling(self, indices, embedding_layer):
        """Helper to average tag vectors, ignoring padding (0)."""
        emb = embedding_layer(indices) # (Batch, 10, Dim)
        mask = (indices != 0).float().unsqueeze(-1) # (Batch, 10, 1)
        # Sum valid vectors and divide by count (avoid div by zero)
        return (emb * mask).sum(dim=1) / (mask.sum(dim=1) + 1e-8)

    def forward_user(self, user_features: Dict[str, torch.Tensor]) -> torch.Tensor:
        # Standard features
        u_emb = self.user_embedding(user_features['user_id'])
        age_emb = self.user_age(user_features['age'].unsqueeze(-1))
        gender_emb = self.user_gender(user_features['gender'])
        time_emb = self.user_time(user_features['time_of_day'].unsqueeze(-1))
        day_emb = self.user_day(user_features['day_of_week'])

        # Preference Tags (Shared Embedding)
        liked_vec = self._mean_pooling(user_features['liked_tags'], self.tag_embedding)
        disliked_vec = self._mean_pooling(user_features['disliked_tags'], self.tag_embedding)
        allergy_vec = self._mean_pooling(user_features['allergy_tags'], self.tag_embedding)

        # Concatenate All
        combined = torch.cat([
            u_emb, age_emb, gender_emb, time_emb, day_emb,
            liked_vec, disliked_vec, allergy_vec
        ], dim=-1)

        return F.normalize(self.user_projection(combined), p=2, dim=-1)

    def forward_item(self, item_features: Dict[str, torch.Tensor]) -> torch.Tensor:
        d_emb = self.dish_embedding(item_features['dish_id'])
        s_emb = self.store_embedding(item_features['store_id'])
        c_emb = self.category_embedding(item_features['category'])
        
        # Dish Tags (Shared Embedding)
        tag_vec = self._mean_pooling(item_features['tags'], self.tag_embedding)
        
        price_emb = self.dish_price(item_features['price'].unsqueeze(-1))
        rating_emb = self.dish_rating(item_features['rating'].unsqueeze(-1))
        time_emb = self.dish_time(item_features['time_of_day'].unsqueeze(-1))
        day_emb = self.dish_day(item_features['day_of_week'])

        combined = torch.cat([
            d_emb, s_emb, tag_vec, c_emb, 
            price_emb, rating_emb, time_emb, day_emb
        ], dim=-1)

        return F.normalize(self.item_projection(combined), p=2, dim=-1)

    def forward(self, user_features, item_features):
        u_vec = self.forward_user(user_features)
        i_vec = self.forward_item(item_features)
        return u_vec, i_vec, torch.sum(u_vec * i_vec, dim=-1)