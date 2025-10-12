"""
Training script for the two-tower recommendation model.

This module handles the training loop, loss computation, and model checkpointing.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import pandas as pd
import numpy as np
import json
import os
from typing import Dict, List, Tuple, Any
from datetime import datetime
import pickle
from tqdm import tqdm

from ..models.two_tower import TwoTowerModel
from ..preprocessing.encoders import FeatureEncoder


class RecommendationDataset(Dataset):
    """PyTorch Dataset for recommendation training."""
    
    def __init__(
        self, 
        data: List[Dict],
        users_df: pd.DataFrame,
        dishes_df: pd.DataFrame,
        encoder: FeatureEncoder
    ):
        """
        Initialize dataset.
        
        Args:
            data: List of training examples
            users_df: DataFrame with user information
            dishes_df: DataFrame with dish information
            encoder: Fitted FeatureEncoder
        """
        self.data = data
        self.users_df = users_df
        self.dishes_df = dishes_df
        self.encoder = encoder
        
        # Create lookup dictionaries for faster access
        self.users_lookup = users_df.set_index('user_id').to_dict('index')
        self.dishes_lookup = dishes_df.set_index('dish_id').to_dict('index')
    
    def __len__(self) -> int:
        return len(self.data)
    
    def __getitem__(self, idx: int) -> Tuple[Dict[str, torch.Tensor], Dict[str, torch.Tensor], torch.Tensor]:
        """
        Get training example.
        
        Args:
            idx: Index of the example
            
        Returns:
            Tuple of (user_features, item_features, label)
        """
        example = self.data[idx]
        
        # Get user and item data
        user_id = example['user_id']
        dish_id = example['dish_id']
        
        user_data = self.users_lookup[user_id]
        item_data = self.dishes_lookup[dish_id]
        
        # Add context features
        timestamp = pd.to_datetime(example['timestamp'])
        context_data = {
            'time_of_day': timestamp.hour / 24.0,
            'day_of_week': timestamp.weekday()
        }
        
        # Encode features
        user_features = self.encoder.encode_user_features(user_data, context_data)
        item_features = self.encoder.encode_item_features(item_data, context_data)
        
        # Convert to tensors
        user_tensors = {k: torch.tensor(v, dtype=torch.long if k in ['user_id', 'gender', 'day_of_week'] else torch.float) 
                       for k, v in user_features.items()}
        item_tensors = {k: torch.tensor(v, dtype=torch.long if k in ['dish_id', 'store_id', 'category', 'tags', 'tastes', 'day_of_week'] else torch.float) 
                       for k, v in item_features.items()}
        
        label = torch.tensor(example['label'], dtype=torch.float)
        
        return user_tensors, item_tensors, label


class Trainer:
    """Trainer class for the two-tower model."""
    
    def __init__(
        self,
        model: TwoTowerModel,
        train_loader: DataLoader,
        val_loader: DataLoader,
        learning_rate: float = 0.001,
        device: str = 'cpu'
    ):
        """
        Initialize trainer.
        
        Args:
            model: Two-tower model
            train_loader: Training data loader
            val_loader: Validation data loader
            learning_rate: Learning rate for optimizer
            device: Device to run training on
        """
        self.model = model.to(device)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.device = device
        
        # Loss and optimizer
        self.criterion = nn.BCEWithLogitsLoss()
        self.optimizer = optim.Adam(model.parameters(), lr=learning_rate)
        
        # Training history
        self.train_losses = []
        self.val_losses = []
        self.best_val_loss = float('inf')
        
    def train_epoch(self) -> float:
        """Train for one epoch."""
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
    
    def validate(self) -> float:
        """Validate the model."""
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
    
    def train(self, num_epochs: int, save_dir: str) -> None:
        """
        Train the model.
        
        Args:
            num_epochs: Number of epochs to train
            save_dir: Directory to save checkpoints
        """
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
            
            # Save regular checkpoint
            if (epoch + 1) % 10 == 0:
                self.save_checkpoint(save_dir, epoch, is_best=False)
        
        # Save final model
        self.save_checkpoint(save_dir, num_epochs - 1, is_best=False, is_final=True)
    
    def save_checkpoint(self, save_dir: str, epoch: int, is_best: bool = False, is_final: bool = False) -> None:
        """
        Save model checkpoint.
        
        Args:
            save_dir: Directory to save checkpoint
            epoch: Current epoch
            is_best: Whether this is the best model
            is_final: Whether this is the final model
        """
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
        elif is_final:
            filepath = os.path.join(save_dir, 'final_model.pth')
        else:
            filepath = os.path.join(save_dir, f'checkpoint_epoch_{epoch}.pth')
        
        torch.save(checkpoint, filepath)
        print(f"Checkpoint saved to {filepath}")


def load_datasets(data_dir: str) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """
    Load train/val/test datasets.
    
    Args:
        data_dir: Directory containing dataset files
        
    Returns:
        Tuple of (train_data, val_data, test_data)
    """
    with open(os.path.join(data_dir, 'train.pkl'), 'rb') as f:
        train_data = pickle.load(f)
    
    with open(os.path.join(data_dir, 'val.pkl'), 'rb') as f:
        val_data = pickle.load(f)
    
    with open(os.path.join(data_dir, 'test.pkl'), 'rb') as f:
        test_data = pickle.load(f)
    
    return train_data, val_data, test_data


def main():
    """Main training function."""
    # Configuration
    config = {
        'data_dir': 'data/dataset',
        'clean_data_dir': 'data/clean',
        'output_dir': 'runs',
        'batch_size': 32,
        'learning_rate': 0.001,
        'num_epochs': 50,
        'embedding_dim': 64,
        'device': 'cuda' if torch.cuda.is_available() else 'cpu'
    }
    
    print(f"Using device: {config['device']}")
    
    # Load datasets
    print("Loading datasets...")
    train_data, val_data, test_data = load_datasets(config['data_dir'])
    
    # Load clean data
    users_df = pd.read_parquet(os.path.join(config['clean_data_dir'], 'users.parquet'))
    dishes_df = pd.read_parquet(os.path.join(config['clean_data_dir'], 'dishes.parquet'))
    
    # Load encoder
    print("Loading encoder...")
    encoder = FeatureEncoder.load('encoders.pkl')
    
    # Create datasets
    print("Creating PyTorch datasets...")
    train_dataset = RecommendationDataset(train_data, users_df, dishes_df, encoder)
    val_dataset = RecommendationDataset(val_data, users_df, dishes_df, encoder)
    
    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=config['batch_size'], shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=config['batch_size'], shuffle=False)
    
    # Create model
    print("Creating model...")
    vocab_sizes = encoder.get_vocab_sizes()
    model = TwoTowerModel(
        user_vocab_size=vocab_sizes['user'],
        dish_vocab_size=vocab_sizes['dish'],
        store_vocab_size=vocab_sizes['store'],
        tag_vocab_size=vocab_sizes['tag'],
        taste_vocab_size=vocab_sizes['taste'],
        category_vocab_size=vocab_sizes['category'],
        embedding_dim=config['embedding_dim']
    )
    
    # Create trainer
    trainer = Trainer(
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
        save_dir=config['output_dir']
    )
    
    print("Training completed!")


if __name__ == "__main__":
    main()
