"""
Dataset builder for recommendation system with negative sampling.

This module handles the creation of training/validation/test datasets
with proper time-based splits and negative sampling.
"""

import pandas as pd
import numpy as np
import pickle
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
import random
from sklearn.model_selection import train_test_split


class DatasetBuilder:
    """Builds datasets with negative sampling for recommendation training."""
    
    def __init__(
        self,
        interactions_df: pd.DataFrame,
        users_df: pd.DataFrame,
        dishes_df: pd.DataFrame,
        num_negatives: int = 4,
        test_size: float = 0.2,
        val_size: float = 0.1
    ):
        """
        Initialize dataset builder.
        
        Args:
            interactions_df: DataFrame with user-item interactions
            users_df: DataFrame with user information
            dishes_df: DataFrame with dish information
            num_negatives: Number of negative samples per positive
            test_size: Fraction of data for testing
            val_size: Fraction of data for validation
        """
        self.interactions_df = interactions_df.copy()
        self.users_df = users_df.copy()
        self.dishes_df = dishes_df.copy()
        self.num_negatives = num_negatives
        self.test_size = test_size
        self.val_size = val_size
        
        # Ensure timestamp column exists and is datetime
        if 'timestamp' not in self.interactions_df.columns:
            raise ValueError("interactions_df must contain 'timestamp' column")
        
        self.interactions_df['timestamp'] = pd.to_datetime(self.interactions_df['timestamp'])
        
        # Sort by timestamp for proper time-based splitting
        self.interactions_df = self.interactions_df.sort_values('timestamp').reset_index(drop=True)
        
        # Create user-item interaction history for negative sampling
        self._build_interaction_history()
    
    def _build_interaction_history(self) -> None:
        """Build user interaction history for negative sampling."""
        # Group interactions by user and timestamp
        self.user_interactions = {}
        for _, row in self.interactions_df.iterrows():
            user_id = row['user_id']
            if user_id not in self.user_interactions:
                self.user_interactions[user_id] = []
            
            self.user_interactions[user_id].append({
                'dish_id': row['dish_id'],
                'store_id': row['store_id'],
                'timestamp': row['timestamp'],
                'event_type': row.get('event_type', 'order'),
                'rating': row.get('rating', None)
            })
        
        # Sort each user's interactions by timestamp
        for user_id in self.user_interactions:
            self.user_interactions[user_id].sort(key=lambda x: x['timestamp'])
    
    def create_time_based_splits(self) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Create time-based train/val/test splits.
        
        Returns:
            Tuple of (train_df, val_df, test_df)
        """
        # Sort by timestamp
        df = self.interactions_df.sort_values('timestamp').reset_index(drop=True)
        
        # Calculate split indices
        n_total = len(df)
        n_test = int(n_total * self.test_size)
        n_val = int(n_total * self.val_size)
        n_train = n_total - n_test - n_val
        
        # Split by time
        train_df = df.iloc[:n_train].copy()
        val_df = df.iloc[n_train:n_train + n_val].copy()
        test_df = df.iloc[n_train + n_val:].copy()
        
        return train_df, val_df, test_df
    
    def sample_negatives(
        self, 
        user_id: str, 
        timestamp: datetime,
        exclude_dishes: Optional[List[str]] = None
    ) -> List[str]:
        """
        Sample negative dishes for a user at a given timestamp.
        
        Args:
            user_id: User ID
            timestamp: Timestamp for temporal consistency
            exclude_dishes: List of dishes to exclude from negatives
            
        Returns:
            List of negative dish IDs
        """
        if exclude_dishes is None:
            exclude_dishes = []
        
        # Get dishes the user has interacted with up to this timestamp
        user_history = self.user_interactions.get(user_id, [])
        interacted_dishes = set()
        
        for interaction in user_history:
            if interaction['timestamp'] <= timestamp:
                interacted_dishes.add(interaction['dish_id'])
        
        # Add explicitly excluded dishes
        interacted_dishes.update(exclude_dishes)
        
        # Get all available dishes
        all_dishes = set(self.dishes_df['dish_id'].unique())
        
        # Get negative candidates
        negative_candidates = list(all_dishes - interacted_dishes)
        
        # Sample negatives
        if len(negative_candidates) >= self.num_negatives:
            negatives = random.sample(negative_candidates, self.num_negatives)
        else:
            # If not enough candidates, sample with replacement
            negatives = random.choices(negative_candidates, k=self.num_negatives)
        
        return negatives
    
    def build_dataset(self, interactions_df: pd.DataFrame) -> List[Dict]:
        """
        Build dataset with positive and negative samples.
        
        Args:
            interactions_df: DataFrame of interactions to process
            
        Returns:
            List of training examples
        """
        dataset = []
        
        for _, row in interactions_df.iterrows():
            user_id = row['user_id']
            dish_id = row['dish_id']
            timestamp = row['timestamp']
            
            # Create positive example
            positive_example = {
                'user_id': user_id,
                'dish_id': dish_id,
                'store_id': row['store_id'],
                'timestamp': timestamp,
                'label': 1,
                'event_type': row.get('event_type', 'order'),
                'rating': row.get('rating', None)
            }
            dataset.append(positive_example)
            
            # Sample negatives
            negatives = self.sample_negatives(user_id, timestamp, [dish_id])
            
            for neg_dish_id in negatives:
                # Get store_id for negative dish
                neg_store_id = self.dishes_df[
                    self.dishes_df['dish_id'] == neg_dish_id
                ]['store_id'].iloc[0]
                
                negative_example = {
                    'user_id': user_id,
                    'dish_id': neg_dish_id,
                    'store_id': neg_store_id,
                    'timestamp': timestamp,
                    'label': 0,
                    'event_type': 'negative',
                    'rating': None
                }
                dataset.append(negative_example)
        
        return dataset
    
    def create_datasets(self) -> Dict[str, List[Dict]]:
        """
        Create train/val/test datasets with negative sampling.
        
        Returns:
            Dictionary containing train/val/test datasets
        """
        # Create time-based splits
        train_df, val_df, test_df = self.create_time_based_splits()
        
        # Build datasets
        train_dataset = self.build_dataset(train_df)
        val_dataset = self.build_dataset(val_df)
        test_dataset = self.build_dataset(test_df)
        
        return {
            'train': train_dataset,
            'val': val_dataset,
            'test': test_dataset
        }
    
    def save_datasets(self, datasets: Dict[str, List[Dict]], output_dir: str) -> None:
        """
        Save datasets to files.
        
        Args:
            datasets: Dictionary of datasets
            output_dir: Output directory path
        """
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        for split_name, dataset in datasets.items():
            filepath = os.path.join(output_dir, f'{split_name}.pkl')
            with open(filepath, 'wb') as f:
                pickle.dump(dataset, f)
            print(f"Saved {split_name} dataset with {len(dataset)} examples to {filepath}")
    
    def get_dataset_stats(self, datasets: Dict[str, List[Dict]]) -> Dict[str, Dict]:
        """
        Get statistics about the datasets.
        
        Args:
            datasets: Dictionary of datasets
            
        Returns:
            Dictionary containing dataset statistics
        """
        stats = {}
        
        for split_name, dataset in datasets.items():
            df = pd.DataFrame(dataset)
            
            stats[split_name] = {
                'total_examples': len(dataset),
                'positive_examples': len(df[df['label'] == 1]),
                'negative_examples': len(df[df['label'] == 0]),
                'unique_users': df['user_id'].nunique(),
                'unique_dishes': df['dish_id'].nunique(),
                'unique_stores': df['store_id'].nunique(),
                'date_range': {
                    'start': df['timestamp'].min(),
                    'end': df['timestamp'].max()
                }
            }
        
        return stats


def create_sample_data() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Create sample data for testing the dataset builder.
    
    Returns:
        Tuple of (interactions_df, users_df, dishes_df)
    """
    # Set random seed for reproducibility
    np.random.seed(42)
    random.seed(42)
    
    # Create sample users
    users_data = []
    for i in range(200):
        users_data.append({
            'user_id': f'user_{i}',
            'age': np.random.randint(18, 65),
            'gender': np.random.choice(['male', 'female', 'unknown']),
            'location_lat': np.random.uniform(10.0, 11.0),
            'location_lon': np.random.uniform(106.0, 107.0),
            'dislike_taste': json.dumps(np.random.choice(['spicy', 'sweet', 'sour'], 2, replace=False).tolist()),
            'allergy': json.dumps(np.random.choice(['nuts', 'dairy', 'gluten'], 1, replace=False).tolist())
        })
    
    users_df = pd.DataFrame(users_data)
    
    # Create sample dishes
    dishes_data = []
    stores = [f'store_{i}' for i in range(20)]
    categories = ['restaurant', 'cafe', 'fast_food', 'fine_dining']
    tags = ['spicy', 'sweet', 'sour', 'salty', 'vegetarian', 'vegan', 'gluten_free']
    tastes = ['asian', 'western', 'italian', 'chinese', 'japanese', 'korean']
    
    for i in range(300):
        dishes_data.append({
            'dish_id': f'dish_{i}',
            'store_id': np.random.choice(stores),
            'dish_tags': json.dumps(np.random.choice(tags, 3, replace=False).tolist()),
            'dish_taste': json.dumps(np.random.choice(tastes, 2, replace=False).tolist()),
            'order_times': np.random.randint(0, 100),
            'price': np.random.uniform(10, 100),
            'system_category': np.random.choice(categories),
            'location_lat': np.random.uniform(10.0, 11.0),
            'location_lon': np.random.uniform(106.0, 107.0),
            'average_rating': np.random.uniform(3.0, 5.0)
        })
    
    dishes_df = pd.DataFrame(dishes_data)
    
    # Create sample interactions
    interactions_data = []
    start_date = datetime(2023, 1, 1)
    
    for i in range(5000):
        user_id = f'user_{np.random.randint(0, 200)}'
        dish_id = f'dish_{np.random.randint(0, 300)}'
        store_id = dishes_df[dishes_df['dish_id'] == dish_id]['store_id'].iloc[0]
        
        # Create timestamp within the year
        days_offset = np.random.randint(0, 365)
        timestamp = start_date + timedelta(days=days_offset)
        
        interactions_data.append({
            'user_id': user_id,
            'dish_id': dish_id,
            'store_id': store_id,
            'timestamp': timestamp,
            'event_type': np.random.choice(['order', 'cart_add', 'rating']),
            'rating': np.random.uniform(1, 5) if np.random.random() > 0.7 else None
        })
    
    interactions_df = pd.DataFrame(interactions_data)
    
    return interactions_df, users_df, dishes_df


if __name__ == "__main__":
    # Create sample data and test dataset builder
    print("Creating sample data...")
    interactions_df, users_df, dishes_df = create_sample_data()
    
    print("Building datasets...")
    builder = DatasetBuilder(interactions_df, users_df, dishes_df)
    datasets = builder.create_datasets()
    
    print("Dataset statistics:")
    stats = builder.get_dataset_stats(datasets)
    for split_name, split_stats in stats.items():
        print(f"\n{split_name.upper()}:")
        for key, value in split_stats.items():
            print(f"  {key}: {value}")
    
    # Save datasets
    builder.save_datasets(datasets, 'data/dataset')
    print("\nDatasets saved to data/dataset/")
