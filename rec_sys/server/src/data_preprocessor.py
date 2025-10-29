import ast
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
        # Initialize tag maps here if needed elsewhere, otherwise load in preprocess
        # self.food_tag_map = {}
        # self.taste_tag_map = {}
        # self.cooking_tag_map = {}
        # self.culture_tag_map = {}
        # self.food_name_to_id = {}
        # self.taste_name_to_id = {}
        # self.cooking_name_to_id = {}
        # self.culture_name_to_id = {}


    def load_data(self) -> Dict[str, pd.DataFrame]:
        """Load mock data from CSV files."""
        data = {}
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
                 # --- Add check for empty dataframes ---
                if data[key].empty:
                     print(f"Warning: Loaded empty DataFrame for {key} from {file_path}")
                 # --- Optional: Fill NaNs immediately ---
                 # data[key].fillna('', inplace=True) # Example: fill with empty string
                 # Or handle NaNs more specifically later
            except FileNotFoundError:
                print(f"Error: Could not find the file at {file_path}")
                raise # Re-raise the error to stop execution if a critical file is missing
            except pd.errors.EmptyDataError:
                 print(f"Warning: File at {file_path} is empty.")
                 data[key] = pd.DataFrame() # Assign an empty DataFrame

        print("Loaded mock data:")
        for key, df in data.items():
            print(f"  - {key.capitalize()}: {len(df)}")

        return data

    # --- Helper for safe parsing ---
    def _safe_literal_eval(self, x, default_value=None):
        if pd.isna(x) or not isinstance(x, str):
            return default_value if default_value is not None else {} # Or [] depending on context
        try:
            # Replace potential problematic NaN representations if necessary
            # x = x.replace('nan', 'None') # Be cautious with simple replaces
            return ast.literal_eval(x)
        except (ValueError, SyntaxError, TypeError) as e:
            # print(f"Warning: Could not parse '{x}'. Error: {e}. Returning default.") # Optional logging
            return default_value if default_value is not None else {} # Or []

    def preprocess_data(self, data: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
        """Preprocess mock data for training."""
        if 'interactions' not in data or data['interactions'].empty:
             print("Warning: No interaction data found or loaded. Preprocessing might fail.")
             # Handle missing interactions gracefully, maybe return data as is or raise error
             return data

        # Convert timestamp to datetime, handling potential errors
        data['interactions']['timestamp'] = pd.to_datetime(data['interactions']['timestamp'], errors='coerce')
        # Drop rows where timestamp conversion failed (optional, but recommended)
        original_len = len(data['interactions'])
        data['interactions'].dropna(subset=['timestamp'], inplace=True)
        if len(data['interactions']) < original_len:
            print(f"Warning: Dropped {original_len - len(data['interactions'])} interactions due to invalid timestamps.")


        # Safely parse preference dictionaries
        if 'users' in data and not data['users'].empty:
             data['users']['preferences'] = data['users']['preferences'].apply(
                  lambda x: self._safe_literal_eval(x, default_value={})
             )
             # --- REMOVED random location generation ---


        # Safely parse context dictionaries
        data['interactions']['context'] = data['interactions']['context'].apply(
            lambda x: self._safe_literal_eval(x, default_value={})
        )

        # Handle missing columns/data in dishes
        if 'dishes' in data and not data['dishes'].empty:
            # --- REMOVED random location and order_times generation ---

            # --- Handle potentially missing 'category' ---
            if 'category' not in data['dishes'].columns:
                print("Warning: 'category' column missing in dishes. Adding with default value.")
                data['dishes']['category'] = 'unknown_category' # Add a default category
            else:
                 # Fill NaN categories AFTER loading, before creating vocab
                 data['dishes']['category'] = data['dishes']['category'].fillna('unknown_category')

            # Ensure necessary columns for encoding exist, fill if missing
            if 'price' not in data['dishes'].columns:
                 print("Warning: 'price' column missing. Filling with 0.")
                 data['dishes']['price'] = 0
            else:
                 data['dishes']['price'] = data['dishes']['price'].fillna(0)

            if 'rating' not in data['dishes'].columns:
                 print("Warning: 'rating' column missing. Filling with 3.0.")
                 data['dishes']['rating'] = data['dishes']['rating'].fillna(3.0)
            else:
                  data['dishes']['rating'].fillna(3.0, inplace=True) # Fill NaN ratings

            # Ensure tag columns exist, fill NaNs with empty string representation of list '[]'
            for tag_col in ['food_tags', 'taste_tags', 'cooking_method_tags', 'culture_tags']:
                 if tag_col not in data['dishes'].columns:
                      print(f"Warning: '{tag_col}' column missing. Adding empty list representation.")
                      data['dishes'][tag_col] = '[]'
                 else:
                      data['dishes'][tag_col] = data['dishes'][tag_col].fillna('[]')

        # Create tag mappings (only if tag dataframes were loaded successfully)
        # self._create_tag_mappings(data)

        return data

    def _create_tag_mappings(self, data: Dict[str, pd.DataFrame]):
        """Create mappings for tags."""
        # Check if tag data exists before creating maps
        if 'food_tags' in data and not data['food_tags'].empty:
            self.food_tag_map = dict(zip(data['food_tags']['id'], data['food_tags']['name']))
            self.food_name_to_id = {v: k for k, v in self.food_tag_map.items()}
        else: print("Warning: Food tag data missing or empty.")

        if 'taste_tags' in data and not data['taste_tags'].empty:
            self.taste_tag_map = dict(zip(data['taste_tags']['id'], data['taste_tags']['name']))
            self.taste_name_to_id = {v: k for k, v in self.taste_tag_map.items()}
        else: print("Warning: Taste tag data missing or empty.")

        if 'cooking_method_tags' in data and not data['cooking_method_tags'].empty:
            self.cooking_tag_map = dict(zip(data['cooking_method_tags']['id'], data['cooking_method_tags']['name']))
            self.cooking_name_to_id = {v: k for k, v in self.cooking_tag_map.items()}
        else: print("Warning: Cooking method tag data missing or empty.")

        if 'culture_tags' in data and not data['culture_tags'].empty:
            self.culture_tag_map = dict(zip(data['culture_tags']['id'], data['culture_tags']['name']))
            self.culture_name_to_id = {v: k for k, v in self.culture_tag_map.items()}
        else: print("Warning: Culture tag data missing or empty.")