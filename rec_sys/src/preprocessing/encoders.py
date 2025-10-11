"""
Feature encoders for the recommendation system.

This module handles the encoding and transformation of raw features
into model-ready tensors with proper normalization and categorical mappings.
"""

import pickle
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional
from sklearn.preprocessing import StandardScaler, LabelEncoder
from datetime import datetime, timedelta
import json


class FeatureEncoder:
    """Main encoder class for handling all feature transformations."""
    
    def __init__(self):
        # Categorical encoders
        self.user_encoder = LabelEncoder()
        self.dish_encoder = LabelEncoder()
        self.store_encoder = LabelEncoder()
        self.tag_encoder = LabelEncoder()
        self.taste_encoder = LabelEncoder()
        self.category_encoder = LabelEncoder()
        
        # Numeric scalers
        self.age_scaler = StandardScaler()
        self.price_scaler = StandardScaler()
        self.order_times_scaler = StandardScaler()
        self.rating_scaler = StandardScaler()
        self.location_scaler = StandardScaler()
        self.time_scaler = StandardScaler()
        self.recency_scaler = StandardScaler()
        
        # Vocabulary mappings
        self.vocab_sizes = {}
        self.is_fitted = False
        
    def fit(self, data: Dict[str, pd.DataFrame]) -> None:
        """
        Fit encoders on the training data.
        
        Args:
            data: Dictionary containing DataFrames for users, dishes, interactions
        """
        users_df = data['users']
        dishes_df = data['dishes']
        interactions_df = data['interactions']
        
        # Fit categorical encoders
        self.user_encoder.fit(users_df['user_id'].unique())
        self.dish_encoder.fit(dishes_df['dish_id'].unique())
        self.store_encoder.fit(dishes_df['store_id'].unique())
        
        # Fit tag and taste encoders
        all_tags = []
        all_tastes = []
        for tags in dishes_df['dish_tags'].dropna():
            if isinstance(tags, str):
                all_tags.extend(json.loads(tags))
            elif isinstance(tags, list):
                all_tags.extend(tags)
        
        for tastes in dishes_df['dish_taste'].dropna():
            if isinstance(tastes, str):
                all_tastes.extend(json.loads(tastes))
            elif isinstance(tastes, list):
                all_tastes.extend(tastes)
        
        self.tag_encoder.fit(list(set(all_tags)))
        self.taste_encoder.fit(list(set(all_tastes)))
        self.category_encoder.fit(dishes_df['system_category'].unique())
        
        # Fit numeric scalers
        self.age_scaler.fit(users_df['age'].values.reshape(-1, 1))
        self.price_scaler.fit(dishes_df['price'].values.reshape(-1, 1))
        self.order_times_scaler.fit(dishes_df['order_times'].values.reshape(-1, 1))
        self.rating_scaler.fit(dishes_df['average_rating'].values.reshape(-1, 1))
        
        # Location scaling (lat, lon)
        location_data = np.column_stack([
            dishes_df['location_lat'].values,
            dishes_df['location_lon'].values
        ])
        self.location_scaler.fit(location_data)
        
        # Time features
        time_features = self._extract_time_features(interactions_df)
        self.time_scaler.fit(time_features['time_of_day'].values.reshape(-1, 1))
        
        # Recency features
        recency_features = self._compute_recency_features(interactions_df)
        self.recency_scaler.fit(recency_features.values.reshape(-1, 1))
        
        # Store vocabulary sizes
        self.vocab_sizes = {
            'user': len(self.user_encoder.classes_),
            'dish': len(self.dish_encoder.classes_),
            'store': len(self.store_encoder.classes_),
            'tag': len(self.tag_encoder.classes_),
            'taste': len(self.taste_encoder.classes_),
            'category': len(self.category_encoder.classes_)
        }
        
        self.is_fitted = True
    
    def _extract_time_features(self, interactions_df: pd.DataFrame) -> pd.DataFrame:
        """Extract time-based features from interactions."""
        interactions_df = interactions_df.copy()
        interactions_df['timestamp'] = pd.to_datetime(interactions_df['timestamp'])
        
        interactions_df['time_of_day'] = interactions_df['timestamp'].dt.hour / 24.0
        interactions_df['day_of_week'] = interactions_df['timestamp'].dt.dayofweek
        
        return interactions_df
    
    def _compute_recency_features(self, interactions_df: pd.DataFrame) -> pd.Series:
        """Compute recency features for users."""
        interactions_df = interactions_df.copy()
        interactions_df['timestamp'] = pd.to_datetime(interactions_df['timestamp'])
        
        # Compute days since last interaction for each user
        user_last_interaction = interactions_df.groupby('user_id')['timestamp'].max()
        max_timestamp = interactions_df['timestamp'].max()
        
        recency = (max_timestamp - user_last_interaction).dt.days
        return recency
    
    def encode_user_features(
        self, 
        user_data: Dict[str, Any],
        context_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, np.ndarray]:
        """
        Encode user features for model input.
        
        Args:
            user_data: User information dictionary
            context_data: Optional context information (time, etc.)
            
        Returns:
            Dictionary of encoded user features
        """
        if not self.is_fitted:
            raise ValueError("Encoder must be fitted before encoding")
        
        # Default context if not provided
        if context_data is None:
            now = datetime.now()
            context_data = {
                'time_of_day': now.hour / 24.0,
                'day_of_week': now.weekday()
            }
        
        # Encode categorical features
        user_id = self.user_encoder.transform([user_data['user_id']])[0]
        gender = self._encode_gender(user_data.get('gender', 'unknown'))
        
        # Encode numeric features
        age = self.age_scaler.transform([[user_data.get('age', 25)]])[0, 0]
        
        # Location features
        location = np.array([
            user_data.get('location_lat', 0.0),
            user_data.get('location_lon', 0.0)
        ]).reshape(1, -1)
        location = self.location_scaler.transform(location)[0]
        
        # Time features
        time_of_day = self.time_scaler.transform([[context_data['time_of_day']]])[0, 0]
        day_of_week = context_data['day_of_week']
        
        # Recency (compute from user's last interaction)
        recency = self._compute_user_recency(user_data.get('user_id'), context_data)
        
        return {
            'user_id': np.array([user_id]),
            'age': np.array([age]),
            'gender': np.array([gender]),
            'location': location,
            'time_of_day': np.array([time_of_day]),
            'day_of_week': np.array([day_of_week]),
            'recency': np.array([recency])
        }
    
    def encode_item_features(
        self,
        item_data: Dict[str, Any],
        context_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, np.ndarray]:
        """
        Encode item features for model input.
        
        Args:
            item_data: Item information dictionary
            context_data: Optional context information
            
        Returns:
            Dictionary of encoded item features
        """
        if not self.is_fitted:
            raise ValueError("Encoder must be fitted before encoding")
        
        # Default context if not provided
        if context_data is None:
            now = datetime.now()
            context_data = {
                'time_of_day': now.hour / 24.0,
                'day_of_week': now.weekday()
            }
        
        # Encode categorical features
        dish_id = self.dish_encoder.transform([item_data['dish_id']])[0]
        store_id = self.store_encoder.transform([item_data['store_id']])[0]
        category = self.category_encoder.transform([item_data['system_category']])[0]
        
        # Encode tags and tastes (multi-hot)
        tags = self._encode_multi_hot(item_data.get('dish_tags', []), self.tag_encoder)
        tastes = self._encode_multi_hot(item_data.get('dish_taste', []), self.taste_encoder)
        
        # Encode numeric features
        price = self.price_scaler.transform([[item_data.get('price', 0)]])[0, 0]
        order_times = self.order_times_scaler.transform([[item_data.get('order_times', 0)]])[0, 0]
        rating = self.rating_scaler.transform([[item_data.get('average_rating', 3.0)]])[0, 0]
        
        # Location features
        location = np.array([
            item_data.get('location_lat', 0.0),
            item_data.get('location_lon', 0.0)
        ]).reshape(1, -1)
        location = self.location_scaler.transform(location)[0]
        
        # Time features
        time_of_day = self.time_scaler.transform([[context_data['time_of_day']]])[0, 0]
        day_of_week = context_data['day_of_week']
        
        return {
            'dish_id': np.array([dish_id]),
            'store_id': np.array([store_id]),
            'tags': tags,
            'tastes': tastes,
            'category': np.array([category]),
            'price': np.array([price]),
            'order_times': np.array([order_times]),
            'rating': np.array([rating]),
            'location': location,
            'time_of_day': np.array([time_of_day]),
            'day_of_week': np.array([day_of_week])
        }
    
    def _encode_gender(self, gender: str) -> int:
        """Encode gender to integer."""
        gender_map = {'male': 1, 'female': 2, 'unknown': 0}
        return gender_map.get(gender.lower(), 0)
    
    def _encode_multi_hot(self, items: List[str], encoder: LabelEncoder, max_length: int = 10) -> np.ndarray:
        """Encode list of items to multi-hot vector."""
        if not items:
            return np.zeros(max_length, dtype=np.int64)
        
        # Handle string representation of lists
        if isinstance(items, str):
            try:
                items = json.loads(items)
            except:
                items = [items]
        
        # Encode items
        encoded = []
        for item in items[:max_length]:
            try:
                encoded.append(encoder.transform([item])[0])
            except ValueError:
                # Skip unknown items
                continue
        
        # Pad to max_length
        while len(encoded) < max_length:
            encoded.append(0)
        
        return np.array(encoded[:max_length])
    
    def _compute_user_recency(self, user_id: str, context_data: Dict[str, Any]) -> float:
        """Compute recency score for user."""
        # This would typically query the database for user's last interaction
        # For now, return a default value
        return 0.0
    
    def save(self, filepath: str) -> None:
        """Save encoder to file."""
        with open(filepath, 'wb') as f:
            pickle.dump(self, f)
    
    @classmethod
    def load(cls, filepath: str) -> 'FeatureEncoder':
        """Load encoder from file."""
        with open(filepath, 'rb') as f:
            return pickle.load(f)
    
    def get_vocab_sizes(self) -> Dict[str, int]:
        """Get vocabulary sizes for model initialization."""
        return self.vocab_sizes.copy()


def create_feature_spec(encoder: FeatureEncoder) -> Dict[str, Any]:
    """
    Create feature specification document.
    
    Args:
        encoder: Fitted FeatureEncoder
        
    Returns:
        Dictionary containing feature specifications
    """
    return {
        'vocab_sizes': encoder.get_vocab_sizes(),
        'embedding_dim': 64,
        'max_tags': 10,
        'max_tastes': 5,
        'user_features': {
            'user_id': 'categorical',
            'age': 'numeric',
            'gender': 'categorical',
            'location': 'numeric_pair',
            'time_of_day': 'numeric',
            'day_of_week': 'categorical',
            'recency': 'numeric'
        },
        'item_features': {
            'dish_id': 'categorical',
            'store_id': 'categorical',
            'tags': 'multi_hot',
            'tastes': 'multi_hot',
            'category': 'categorical',
            'price': 'numeric',
            'order_times': 'numeric',
            'rating': 'numeric',
            'location': 'numeric_pair',
            'time_of_day': 'numeric',
            'day_of_week': 'categorical'
        }
    }
