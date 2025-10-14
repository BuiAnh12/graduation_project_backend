"""
Training script for recommendation system using mock data.

This script demonstrates how to train the two-tower recommendation model
using the generated mock data with proper data preprocessing and evaluation.
"""

import os
import sys
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import json
from typing import Dict, List, Tuple, Any
from datetime import datetime
import pickle
from tqdm import tqdm
import random

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set random seeds for reproducibility
torch.manual_seed(42)
np.random.seed(42)
random.seed(42)

class MockDataPreprocessor:
    """Preprocessor specifically designed for mock data format."""
    
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        
    def load_mock_data(self) -> Dict[str, pd.DataFrame]:
        """Load mock data from CSV files."""
        data = {}
        
        # Load core data
        data['users'] = pd.read_csv(os.path.join(self.data_dir, 'users.csv'))
        data['dishes'] = pd.read_csv(os.path.join(self.data_dir, 'dishes.csv'))
        data['interactions'] = pd.read_csv(os.path.join(self.data_dir, 'interactions.csv'))
        data['stores'] = pd.read_csv(os.path.join(self.data_dir, 'stores.csv'))
        
        # Load tag data
        data['food_tags'] = pd.read_csv(os.path.join(self.data_dir, 'food_tags.csv'))
        data['taste_tags'] = pd.read_csv(os.path.join(self.data_dir, 'taste_tags.csv'))
        data['cooking_method_tags'] = pd.read_csv(os.path.join(self.data_dir, 'cooking_method_tags.csv'))
        data['culture_tags'] = pd.read_csv(os.path.join(self.data_dir, 'culture_tags.csv'))
        
        print(f"Loaded mock data:")
        print(f"  - Users: {len(data['users'])}")
        print(f"  - Dishes: {len(data['dishes'])}")
        print(f"  - Interactions: {len(data['interactions'])}")
        print(f"  - Stores: {len(data['stores'])}")
        
        return data
    
    def preprocess_mock_data(self, data: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
        """Preprocess mock data for training."""
        # Convert timestamp to datetime
        data['interactions']['timestamp'] = pd.to_datetime(data['interactions']['timestamp'])
        
        # Parse preference dictionaries
        data['users']['preferences'] = data['users']['preferences'].apply(
            lambda x: eval(x) if isinstance(x, str) else x
        )
        
        # Parse context dictionaries
        data['interactions']['context'] = data['interactions']['context'].apply(
            lambda x: eval(x) if isinstance(x, str) else x
        )
        
        # Create location features for users and dishes
        # Mock location data (Ho Chi Minh City coordinates)
        data['users']['location_lat'] = np.random.uniform(10.7, 10.8, len(data['users']))
        data['users']['location_lon'] = np.random.uniform(106.6, 106.7, len(data['users']))
        
        data['dishes']['location_lat'] = np.random.uniform(10.7, 10.8, len(data['dishes']))
        data['dishes']['location_lon'] = np.random.uniform(106.6, 106.7, len(data['dishes']))
        
        # Add missing columns for compatibility
        data['dishes']['order_times'] = np.random.randint(0, 100, len(data['dishes']))
        data['dishes']['system_category'] = data['dishes']['category']
        
        # Create tag mappings
        self._create_tag_mappings(data)
        
        return data
    
    def _create_tag_mappings(self, data: Dict[str, pd.DataFrame]):
        """Create mappings for tags."""
        # Create tag ID to name mappings
        self.food_tag_map = dict(zip(data['food_tags']['id'], data['food_tags']['name']))
        self.taste_tag_map = dict(zip(data['taste_tags']['id'], data['taste_tags']['name']))
        self.cooking_tag_map = dict(zip(data['cooking_method_tags']['id'], data['cooking_method_tags']['name']))
        self.culture_tag_map = dict(zip(data['culture_tags']['id'], data['culture_tags']['name']))
        
        # Create name to ID mappings
        self.food_name_to_id = {v: k for k, v in self.food_tag_map.items()}
        self.taste_name_to_id = {v: k for k, v in self.taste_tag_map.items()}
        self.cooking_name_to_id = {v: k for k, v in self.cooking_tag_map.items()}
        self.culture_name_to_id = {v: k for k, v in self.culture_tag_map.items()}


class MockDataset(Dataset):
    """PyTorch Dataset for mock data."""
    
    def __init__(self, interactions_df: pd.DataFrame, users_df: pd.DataFrame, 
                 dishes_df: pd.DataFrame, preprocessor: MockDataPreprocessor):
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


class MockTrainer:
    """Trainer for mock data."""
    
    def __init__(self, model, train_loader, val_loader, learning_rate=0.001, device='cpu'):
        self.model = model.to(device)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.device = device
        self.criterion = nn.BCEWithLogitsLoss()
        self.optimizer = optim.Adam(model.parameters(), lr=learning_rate)
        
        self.train_losses = []
        self.val_losses = []
        self.best_val_loss = float('inf')
    
    def train_epoch(self):
        self.model.train()
        total_loss = 0.0
        num_batches = 0
        
        for user_features, item_features, labels in tqdm(self.train_loader, desc="Training"):
            # Move to device
            user_features = {k: v.to(self.device) for k, v in user_features.items()}
            item_features = {k: v.to(self.device) for k, v in item_features.items()}
            labels = labels.to(self.device)
            
            # Zero gradients
            self.optimizer.zero_grad()
            
            # Forward pass
            _, _, scores = self.model(user_features, item_features)
            
            # Compute loss
            loss = self.criterion(scores, labels)
            
            # Backward pass
            loss.backward()
            self.optimizer.step()
            
            total_loss += loss.item()
            num_batches += 1
        
        return total_loss / num_batches
    
    def validate(self):
        self.model.eval()
        total_loss = 0.0
        num_batches = 0
        
        with torch.no_grad():
            for user_features, item_features, labels in tqdm(self.val_loader, desc="Validation"):
                # Move to device
                user_features = {k: v.to(self.device) for k, v in user_features.items()}
                item_features = {k: v.to(self.device) for k, v in item_features.items()}
                labels = labels.to(self.device)
                
                # Forward pass
                _, _, scores = self.model(user_features, item_features)
                
                # Compute loss
                loss = self.criterion(scores, labels)
                
                total_loss += loss.item()
                num_batches += 1
        
        return total_loss / num_batches
    
    def train(self, num_epochs, save_dir):
        os.makedirs(save_dir, exist_ok=True)
        
        for epoch in range(num_epochs):
            print(f"\nEpoch {epoch + 1}/{num_epochs}")
            
            # Train
            train_loss = self.train_epoch()
            self.train_losses.append(train_loss)
            
            # Validate
            val_loss = self.validate()
            self.val_losses.append(val_loss)
            
            print(f"Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}")
            
            # Save best model
            if val_loss < self.best_val_loss:
                self.best_val_loss = val_loss
                self.save_checkpoint(save_dir, epoch, is_best=True)
                print(f"New best model saved! Val Loss: {val_loss:.4f}")
    
    def save_checkpoint(self, save_dir, epoch, is_best=False):
        checkpoint = {
            'epoch': epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'train_losses': self.train_losses,
            'val_losses': self.val_losses,
            'best_val_loss': self.best_val_loss
        }
        
        if is_best:
            filepath = os.path.join(save_dir, 'best_model.pth')
        else:
            filepath = os.path.join(save_dir, f'checkpoint_epoch_{epoch}.pth')
        
        torch.save(checkpoint, filepath)
        print(f"Checkpoint saved to {filepath}")


def create_negative_samples(interactions_df, users_df, dishes_df, num_negatives=4):
    """Create negative samples for training."""
    negative_samples = []
    
    for _, row in interactions_df.iterrows():
        user_id = row['user_id']
        dish_id = row['dish_id']
        timestamp = row['timestamp']
        
        # Get dishes this user hasn't interacted with
        user_interactions = interactions_df[interactions_df['user_id'] == user_id]['dish_id'].unique()
        all_dishes = dishes_df['id'].unique()
        negative_candidates = [d for d in all_dishes if d not in user_interactions and d != dish_id]
        
        # Sample negatives
        if len(negative_candidates) >= num_negatives:
            negatives = np.random.choice(negative_candidates, num_negatives, replace=False)
        else:
            negatives = np.random.choice(negative_candidates, num_negatives, replace=True)
        
        for neg_dish_id in negatives:
            neg_dish = dishes_df[dishes_df['id'] == neg_dish_id].iloc[0]
            
            negative_samples.append({
                'user_id': user_id,
                'dish_id': neg_dish_id,
                'interaction_type': 'negative',
                'timestamp': timestamp,
                'context': row['context']
            })
    
    return pd.DataFrame(negative_samples)


def main():
    """Main training function."""
    print("Starting mock data training...")
    
    # Configuration
    config = {
        'data_dir': 'data',
        'batch_size': 16,
        'learning_rate': 0.001,
        'num_epochs': 20,
        'embedding_dim': 64,
        'device': 'cuda' if torch.cuda.is_available() else 'cpu'
    }
    
    print(f"Using device: {config['device']}")
    
    # Load and preprocess data
    print("Loading and preprocessing mock data...")
    preprocessor = MockDataPreprocessor(config['data_dir'])
    data = preprocessor.load_mock_data()
    data = preprocessor.preprocess_mock_data(data)
    
    # Create negative samples
    print("Creating negative samples...")
    negative_samples = create_negative_samples(
        data['interactions'], data['users'], data['dishes'], num_negatives=4
    )
    
    # Combine positive and negative samples
    all_interactions = pd.concat([data['interactions'], negative_samples], ignore_index=True)
    all_interactions = all_interactions.sample(frac=1).reset_index(drop=True)  # Shuffle
    
    # Split data
    train_size = int(0.8 * len(all_interactions))
    val_size = int(0.1 * len(all_interactions))
    
    train_interactions = all_interactions[:train_size]
    val_interactions = all_interactions[train_size:train_size + val_size]
    test_interactions = all_interactions[train_size + val_size:]
    
    print(f"Data split:")
    print(f"  - Train: {len(train_interactions)} interactions")
    print(f"  - Validation: {len(val_interactions)} interactions")
    print(f"  - Test: {len(test_interactions)} interactions")
    
    # Create datasets
    train_dataset = MockDataset(train_interactions, data['users'], data['dishes'], preprocessor)
    val_dataset = MockDataset(val_interactions, data['users'], data['dishes'], preprocessor)
    
    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=config['batch_size'], shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=config['batch_size'], shuffle=False)
    
    # Create model
    print("Creating model...")
    model = SimpleTwoTowerModel(
        user_vocab_size=train_dataset.user_vocab_size,
        dish_vocab_size=train_dataset.dish_vocab_size,
        store_vocab_size=train_dataset.store_vocab_size,
        tag_vocab_size=train_dataset.tag_vocab_size,
        taste_vocab_size=train_dataset.taste_vocab_size,
        category_vocab_size=train_dataset.category_vocab_size,
        embedding_dim=config['embedding_dim']
    )
    
    print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    # Create trainer
    trainer = MockTrainer(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        learning_rate=config['learning_rate'],
        device=config['device']
    )
    
    # Train model
    print("Starting training...")
    trainer.train(
        num_epochs=config['num_epochs'],
        save_dir='runs/mock_training'
    )
    
    print("Training completed!")
    
    # Save model info
    model_info = {
        'vocab_sizes': {
            'user': train_dataset.user_vocab_size,
            'dish': train_dataset.dish_vocab_size,
            'store': train_dataset.store_vocab_size,
            'tag': train_dataset.tag_vocab_size,
            'taste': train_dataset.taste_vocab_size,
            'category': train_dataset.category_vocab_size
        },
        'embedding_dim': config['embedding_dim'],
        'user_vocab': train_dataset.user_vocab,
        'dish_vocab': train_dataset.dish_vocab,
        'store_vocab': train_dataset.store_vocab,
        'category_vocab': train_dataset.category_vocab,
        'tag_vocab': train_dataset.tag_vocab,
        'taste_vocab': train_dataset.taste_vocab
    }
    
    with open('runs/mock_training/model_info.json', 'w') as f:
        json.dump(model_info, f, indent=2)
    
    print("Model info saved to runs/mock_training/model_info.json")


if __name__ == "__main__":
    main()
