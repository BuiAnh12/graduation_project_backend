import os
import sys
import pandas as pd
import numpy as np
import torch
from typing import Dict
import random

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set random seeds for reproducibility
torch.manual_seed(42)
np.random.seed(42)
random.seed(42)


class DataPreprocessor:
    """Preprocessor specifically designed for mock data format."""
    
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        
    def load_data(self) -> Dict[str, pd.DataFrame]:
        """Load mock data from CSV files."""
        data = {}
        
        # Define files to load to avoid repetition
        files_to_load = {
            'users': 'users.csv',
            'dishes': 'dishes.csv',
            'interactions': 'interaction.csv',
            'stores': 'stores.csv',
            'food_tags': 'food_tags.csv',
            'taste_tags': 'taste_tags.csv',
            'cooking_method_tags': 'cooking_method_tags.csv',
            'culture_tags': 'culture_tags.csv'
        }

        # Loop through the files and load them
        for key, filename in files_to_load.items():
            # os.path.join is the correct way to build file paths
            file_path = os.path.join(self.data_dir, filename)
            try:
                data[key] = pd.read_csv(file_path)
            except FileNotFoundError:
                print(f"Error: Could not find the file at {file_path}")
                # You might want to exit or handle the error more gracefully here
                return None # Or raise an exception

        print("Loaded mock data:")
        for key, df in data.items():
            print(f"  - {key.capitalize()}: {len(df)}")
            
        return data
    
    def preprocess_data(self, data: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
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

