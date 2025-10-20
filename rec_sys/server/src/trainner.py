import os
import sys
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from tqdm import tqdm
import random

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set random seeds for reproducibility
torch.manual_seed(42)
np.random.seed(42)
random.seed(42)


class Trainer:
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

