import os
import sys
import json
import torch
import numpy as np
import pandas as pd
import torch.optim as optim
import torch.nn as nn
from torch.utils.data import DataLoader
from sklearn.model_selection import train_test_split
from tqdm import tqdm
from typing import Dict, Any

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.data_preprocessor import DataPreprocessor
from src.dataset import FoodRecommendationDataset
from src.simple_two_tower_model import SimpleTwoTowerModel

# --- Configuration ---
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
MODEL_SAVE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models')
BATCH_SIZE = 32
LEARNING_RATE = 0.001
NUM_EPOCHS = 10
EMBEDDING_DIM = 64

class Trainer:
    """
    Manages the training lifecycle: Forward pass, Backward pass, and Validation.
    """
    
    def __init__(self, model, train_loader, val_loader, learning_rate=0.001, device='cpu'):
        self.model = model.to(device)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.device = device
        
        # Loss Function: BCEWithLogitsLoss includes Sigmoid layer internally
        # This is more numerically stable than Sigmoid + BCELoss
        self.criterion = nn.BCEWithLogitsLoss()
        
        self.optimizer = optim.Adam(model.parameters(), lr=learning_rate)
        
        self.train_losses = []
        self.val_losses = []
        self.best_val_loss = float('inf')
    
    def train_epoch(self):
        self.model.train()
        total_loss = 0.0
        num_batches = 0
        
        loop = tqdm(self.train_loader, desc="Training", leave=False)
        
        for user_features, item_features, labels in loop:
            # Move dictionaries of tensors to device
            user_features = {k: v.to(self.device) for k, v in user_features.items()}
            item_features = {k: v.to(self.device) for k, v in item_features.items()}
            labels = labels.to(self.device)
            
            # 1. Zero gradients
            self.optimizer.zero_grad()
            
            # 2. Forward pass
            _, _, scores = self.model(user_features, item_features)
            
            # 3. Compute loss
            loss = self.criterion(scores, labels)
            
            # 4. Backward pass
            loss.backward()
            self.optimizer.step()
            
            total_loss += loss.item()
            num_batches += 1
            
            # Update progress bar
            loop.set_postfix(loss=loss.item())
        
        return total_loss / num_batches if num_batches > 0 else 0.0
    
    def validate(self):
        self.model.eval()
        total_loss = 0.0
        num_batches = 0
        
        with torch.no_grad():
            for user_features, item_features, labels in self.val_loader:
                user_features = {k: v.to(self.device) for k, v in user_features.items()}
                item_features = {k: v.to(self.device) for k, v in item_features.items()}
                labels = labels.to(self.device)
                
                _, _, scores = self.model(user_features, item_features)
                loss = self.criterion(scores, labels)
                
                total_loss += loss.item()
                num_batches += 1
        
        return total_loss / num_batches if num_batches > 0 else 0.0

    def fit(self, num_epochs, save_dir):
        print(f"Starting training on device: {self.device}")
        os.makedirs(save_dir, exist_ok=True)
        
        for epoch in range(num_epochs):
            # Train
            train_loss = self.train_epoch()
            self.train_losses.append(train_loss)
            
            # Validate
            val_loss = self.validate()
            self.val_losses.append(val_loss)
            
            print(f"Epoch {epoch + 1}/{num_epochs} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}")
            
            # Save Best Model
            if val_loss < self.best_val_loss:
                self.best_val_loss = val_loss
                self.save_checkpoint(save_dir, "best_model.pth")
                print(f"  >>> New best model saved!")

    def save_checkpoint(self, save_dir, filename):
        filepath = os.path.join(save_dir, filename)
        checkpoint = {
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'best_val_loss': self.best_val_loss
        }
        torch.save(checkpoint, filepath)

def save_model_info(save_dir, dataset, embedding_dim):
    """
    Saves metadata about the model architecture (vocab sizes) to JSON.
    The Inference Server needs this to reconstruct the model.
    """
    info = {
        'embedding_dim': embedding_dim,
        'vocab_sizes': {
            'user': dataset.user_vocab_size,
            'dish': dataset.dish_vocab_size,
            'store': dataset.store_vocab_size,
            'category': dataset.category_vocab_size,
            'tag': dataset.tag_vocab_size
        }
    }
    path = os.path.join(save_dir, 'model_info.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(info, f, indent=4)
    print(f"Model configuration saved to {path}")

def main():
    # 1. Preprocess Data
    print("--- 1. Loading and Preprocessing Data ---")
    preprocessor = DataPreprocessor(DATA_DIR)
    data = preprocessor.load_data()
    data = preprocessor.preprocess_data(data)
    
    interactions_df = data['interactions']
    
    # 2. Split Interaction Data (Train / Validation)
    # We split interactions, but keep Users/Dishes global so vocabularies are consistent
    train_df, val_df = train_test_split(interactions_df, test_size=0.2, random_state=42)
    print(f"Data Split: {len(train_df)} Train interactions, {len(val_df)} Validation interactions.")

    # 3. Create Datasets
    print("--- 2. Initializing Datasets ---")
    # Note: We pass the FULL users/dishes DFs to both datasets to ensure they share the same Vocabulary mapping
    train_dataset = FoodRecommendationDataset(train_df, data['users'], data['dishes'])
    val_dataset = FoodRecommendationDataset(val_df, data['users'], data['dishes'])
    
    # 4. Create DataLoaders
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    # 5. Initialize Model
    print("--- 3. Initializing Model ---")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    model = SimpleTwoTowerModel(
        user_vocab_size=train_dataset.user_vocab_size,
        dish_vocab_size=train_dataset.dish_vocab_size,
        store_vocab_size=train_dataset.store_vocab_size,
        tag_vocab_size=train_dataset.tag_vocab_size,
        category_vocab_size=train_dataset.category_vocab_size,
        embedding_dim=EMBEDDING_DIM
    )
    
    # 6. Train
    print("--- 4. Starting Training Loop ---")
    trainer = Trainer(model, train_loader, val_loader, learning_rate=LEARNING_RATE, device=device)
    trainer.fit(NUM_EPOCHS, MODEL_SAVE_DIR)
    
    # 7. Save Metadata for Inference
    save_model_info(MODEL_SAVE_DIR, train_dataset, EMBEDDING_DIM)
    print("\nTraining Complete. Model and Info saved.")

if __name__ == "__main__":
    main()