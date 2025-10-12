"""
Two-tower recommendation model implementation.

This module implements a dual-encoder architecture for food recommendation
with separate user and item towers that produce normalized embeddings.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Tuple, Optional
import numpy as np


class UserTower(nn.Module):
    """User tower for encoding user features into embeddings."""
    
    def __init__(
        self,
        user_vocab_size: int,
        embedding_dim: int = 64,
        hidden_dims: list = [128, 64],
        dropout: float = 0.2
    ):
        super().__init__()
        self.embedding_dim = embedding_dim
        
        # User ID embedding
        self.user_embedding = nn.Embedding(user_vocab_size, embedding_dim)
        
        # Feature dimensions (age, gender, location, etc.)
        self.age_embedding = nn.Linear(1, embedding_dim // 4)
        self.gender_embedding = nn.Embedding(3, embedding_dim // 4)  # 0: unknown, 1: male, 2: female
        
        # Location embeddings (lat, lon)
        self.location_embedding = nn.Linear(2, embedding_dim // 4)
        
        # Context features (time, day)
        self.time_embedding = nn.Linear(1, embedding_dim // 8)
        self.day_embedding = nn.Embedding(7, embedding_dim // 8)
        
        # Recency features
        self.recency_embedding = nn.Linear(1, embedding_dim // 4)
        
        # MLP layers
        layers = []
        input_dim = embedding_dim + embedding_dim // 4 + embedding_dim // 4 + embedding_dim // 4 + embedding_dim // 8 + embedding_dim // 8 + embedding_dim // 4
        
        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(input_dim, hidden_dim),
                nn.ReLU(),
                nn.Dropout(dropout)
            ])
            input_dim = hidden_dim
        
        # Final embedding layer
        layers.append(nn.Linear(input_dim, embedding_dim))
        self.mlp = nn.Sequential(*layers)
        
    def forward(self, user_features: Dict[str, torch.Tensor]) -> torch.Tensor:
        """
        Encode user features into normalized embedding.
        
        Args:
            user_features: Dictionary containing user features
                - user_id: [batch_size]
                - age: [batch_size, 1]
                - gender: [batch_size]
                - location: [batch_size, 2] (lat, lon)
                - time_of_day: [batch_size, 1]
                - day_of_week: [batch_size]
                - recency: [batch_size, 1]
        
        Returns:
            Normalized user embeddings [batch_size, embedding_dim]
        """
        # User ID embedding
        user_emb = self.user_embedding(user_features['user_id'])
        
        # Age embedding
        age_emb = self.age_embedding(user_features['age'])
        
        # Gender embedding
        gender_emb = self.gender_embedding(user_features['gender'])
        
        # Location embedding
        location_emb = self.location_embedding(user_features['location'])
        
        # Time features
        time_emb = self.time_embedding(user_features['time_of_day'])
        day_emb = self.day_embedding(user_features['day_of_week'])
        
        # Recency embedding
        recency_emb = self.recency_embedding(user_features['recency'])
        
        # Concatenate all features
        combined = torch.cat([
            user_emb, age_emb, gender_emb, location_emb,
            time_emb, day_emb, recency_emb
        ], dim=-1)
        
        # Pass through MLP
        embedding = self.mlp(combined)
        
        # L2 normalize
        return F.normalize(embedding, p=2, dim=-1)


class ItemTower(nn.Module):
    """Item tower for encoding dish features into embeddings."""
    
    def __init__(
        self,
        dish_vocab_size: int,
        store_vocab_size: int,
        tag_vocab_size: int,
        taste_vocab_size: int,
        category_vocab_size: int,
        embedding_dim: int = 64,
        hidden_dims: list = [128, 64],
        dropout: float = 0.2,
        max_tags: int = 10,
        max_tastes: int = 5
    ):
        super().__init__()
        self.embedding_dim = embedding_dim
        self.max_tags = max_tags
        self.max_tastes = max_tastes
        
        # Dish and store embeddings
        self.dish_embedding = nn.Embedding(dish_vocab_size, embedding_dim)
        self.store_embedding = nn.Embedding(store_vocab_size, embedding_dim // 2)
        
        # Tag and taste embeddings (for multi-hot encoding)
        self.tag_embedding = nn.Embedding(tag_vocab_size, embedding_dim // 4)
        self.taste_embedding = nn.Embedding(taste_vocab_size, embedding_dim // 4)
        self.category_embedding = nn.Embedding(category_vocab_size, embedding_dim // 4)
        
        # Numeric features
        self.price_embedding = nn.Linear(1, embedding_dim // 4)
        self.order_times_embedding = nn.Linear(1, embedding_dim // 8)
        self.rating_embedding = nn.Linear(1, embedding_dim // 8)
        
        # Location embedding
        self.location_embedding = nn.Linear(2, embedding_dim // 4)
        
        # Context features
        self.time_embedding = nn.Linear(1, embedding_dim // 8)
        self.day_embedding = nn.Embedding(7, embedding_dim // 8)
        
        # MLP layers
        layers = []
        input_dim = (embedding_dim + embedding_dim // 2 + 
                    embedding_dim // 4 + embedding_dim // 4 + embedding_dim // 4 +
                    embedding_dim // 4 + embedding_dim // 8 + embedding_dim // 8 +
                    embedding_dim // 4 + embedding_dim // 8 + embedding_dim // 8)
        
        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(input_dim, hidden_dim),
                nn.ReLU(),
                nn.Dropout(dropout)
            ])
            input_dim = hidden_dim
        
        # Final embedding layer
        layers.append(nn.Linear(input_dim, embedding_dim))
        self.mlp = nn.Sequential(*layers)
        
    def forward(self, item_features: Dict[str, torch.Tensor]) -> torch.Tensor:
        """
        Encode item features into normalized embedding.
        
        Args:
            item_features: Dictionary containing item features
                - dish_id: [batch_size]
                - store_id: [batch_size]
                - tags: [batch_size, max_tags] (padded)
                - tastes: [batch_size, max_tastes] (padded)
                - category: [batch_size]
                - price: [batch_size, 1]
                - order_times: [batch_size, 1]
                - rating: [batch_size, 1]
                - location: [batch_size, 2]
                - time_of_day: [batch_size, 1]
                - day_of_week: [batch_size]
        
        Returns:
            Normalized item embeddings [batch_size, embedding_dim]
        """
        # Basic embeddings
        dish_emb = self.dish_embedding(item_features['dish_id'])
        store_emb = self.store_embedding(item_features['store_id'])
        
        # Multi-hot tag embeddings (mean pooling)
        tag_emb = self.tag_embedding(item_features['tags'])  # [batch, max_tags, dim//4]
        tag_mask = (item_features['tags'] != 0).float().unsqueeze(-1)  # [batch, max_tags, 1]
        tag_emb = (tag_emb * tag_mask).sum(dim=1) / (tag_mask.sum(dim=1) + 1e-8)
        
        # Multi-hot taste embeddings
        taste_emb = self.taste_embedding(item_features['tastes'])
        taste_mask = (item_features['tastes'] != 0).float().unsqueeze(-1)
        taste_emb = (taste_emb * taste_mask).sum(dim=1) / (taste_mask.sum(dim=1) + 1e-8)
        
        # Category embedding
        category_emb = self.category_embedding(item_features['category'])
        
        # Numeric features
        price_emb = self.price_embedding(item_features['price'])
        order_times_emb = self.order_times_embedding(item_features['order_times'])
        rating_emb = self.rating_embedding(item_features['rating'])
        
        # Location embedding
        location_emb = self.location_embedding(item_features['location'])
        
        # Context features
        time_emb = self.time_embedding(item_features['time_of_day'])
        day_emb = self.day_embedding(item_features['day_of_week'])
        
        # Concatenate all features
        combined = torch.cat([
            dish_emb, store_emb, tag_emb, taste_emb, category_emb,
            price_emb, order_times_emb, rating_emb, location_emb,
            time_emb, day_emb
        ], dim=-1)
        
        # Pass through MLP
        embedding = self.mlp(combined)
        
        # L2 normalize
        return F.normalize(embedding, p=2, dim=-1)


class TwoTowerModel(nn.Module):
    """Two-tower recommendation model."""
    
    def __init__(
        self,
        user_vocab_size: int,
        dish_vocab_size: int,
        store_vocab_size: int,
        tag_vocab_size: int,
        taste_vocab_size: int,
        category_vocab_size: int,
        embedding_dim: int = 64,
        hidden_dims: list = [128, 64],
        dropout: float = 0.2
    ):
        super().__init__()
        self.embedding_dim = embedding_dim
        
        # Initialize towers
        self.user_tower = UserTower(
            user_vocab_size=user_vocab_size,
            embedding_dim=embedding_dim,
            hidden_dims=hidden_dims,
            dropout=dropout
        )
        
        self.item_tower = ItemTower(
            dish_vocab_size=dish_vocab_size,
            store_vocab_size=store_vocab_size,
            tag_vocab_size=tag_vocab_size,
            taste_vocab_size=taste_vocab_size,
            category_vocab_size=category_vocab_size,
            embedding_dim=embedding_dim,
            hidden_dims=hidden_dims,
            dropout=dropout
        )
        
    def forward(
        self, 
        user_features: Dict[str, torch.Tensor],
        item_features: Dict[str, torch.Tensor]
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Forward pass through both towers.
        
        Args:
            user_features: User feature dictionary
            item_features: Item feature dictionary
            
        Returns:
            Tuple of (user_embeddings, item_embeddings, scores)
        """
        user_emb = self.user_tower(user_features)
        item_emb = self.item_tower(item_features)
        
        # Compute similarity scores (dot product of normalized embeddings)
        scores = torch.sum(user_emb * item_emb, dim=-1)
        
        return user_emb, item_emb, scores
    
    def embed_user(self, user_features: Dict[str, torch.Tensor]) -> torch.Tensor:
        """Get user embeddings only."""
        return self.user_tower(user_features)
    
    def embed_item(self, item_features: Dict[str, torch.Tensor]) -> torch.Tensor:
        """Get item embeddings only."""
        return self.item_tower(item_features)
    
    def score(self, user_emb: torch.Tensor, item_emb: torch.Tensor) -> torch.Tensor:
        """Compute similarity scores between user and item embeddings."""
        return torch.sum(user_emb * item_emb, dim=-1)
