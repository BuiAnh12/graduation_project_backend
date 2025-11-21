import ast
import os
import sys
import random
from typing import Dict, Any

import pandas as pd
import numpy as np
import torch

# Add parent directory to path to allow importing local modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set random seeds to ensure results are reproducible
torch.manual_seed(42)
np.random.seed(42)
random.seed(42)


class DataPreprocessor:
    """
    A preprocessor specifically designed to handle the mock data format
    for the food recommendation system.
    """

    def __init__(self, data_dir: str):
        self.data_dir = data_dir

    def load_data(self) -> Dict[str, pd.DataFrame]:
        """
        Loads all required CSV files from the data directory into a dictionary of DataFrames.
        """
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

        print(f"Loading data from: {self.data_dir}...")

        for key, filename in files_to_load.items():
            file_path = os.path.join(self.data_dir, filename)
            
            try:
                df = pd.read_csv(file_path)
                
                # Check for empty files immediately
                if df.empty:
                    print(f"Warning: {filename} was loaded but contains no data.")
                    data[key] = pd.DataFrame()
                else:
                    data[key] = df

            except FileNotFoundError:
                print(f"Critical Error: The file '{filename}' was not found at {file_path}")
                raise  # Stop execution if a file is missing
            except pd.errors.EmptyDataError:
                print(f"Warning: The file '{filename}' is completely empty.")
                data[key] = pd.DataFrame()

        # Print a summary of loaded data
        print("Data loading complete:")
        for key, df in data.items():
            print(f"  - {key.capitalize()}: {len(df)} rows")

        return data

    def _safe_literal_eval(self, x: Any, default_value: Any = None) -> Any:
        """
        Safely parses a string containing a Python literal (like a dict or list).
        Returns a default value if parsing fails or input is not a string.
        """
        if default_value is None:
            default_value = {}

        if pd.isna(x) or not isinstance(x, str):
            return default_value

        try:
            return ast.literal_eval(x)
        except (ValueError, SyntaxError, TypeError):
            # If data is corrupted or malformed, return the default
            return default_value

    def preprocess_data(self, data: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
        """
        Cleans and prepares the raw data for model training.
        Handles timestamps, missing values, and string parsing.
        """
        
        # 1. Handle Interactions
        if 'interactions' not in data or data['interactions'].empty:
            print("Warning: Interaction data is missing. Preprocessing cannot proceed normally.")
            return data

        # Convert timestamps and remove invalid rows
        initial_count = len(data['interactions'])
        data['interactions']['timestamp'] = pd.to_datetime(data['interactions']['timestamp'], errors='coerce')
        data['interactions'].dropna(subset=['timestamp'], inplace=True)
        
        dropped_count = initial_count - len(data['interactions'])
        if dropped_count > 0:
            print(f"Cleaned Interactions: Dropped {dropped_count} rows due to invalid timestamps.")

        # Parse 'context' column from string to dictionary
        data['interactions']['context'] = data['interactions']['context'].apply(
            lambda x: self._safe_literal_eval(x, default_value={})
        )

        # 2. Handle Users
        if 'users' in data and not data['users'].empty:
            # Convert the new CSV columns from string "['A', 'B']" to Python Lists ['A', 'B']
            # If column is missing (old CSV), fill with empty list
            for col in ['liked_tags', 'disliked_tags', 'allergy_tags']:
                if col in data['users'].columns:
                    data['users'][col] = data['users'][col].apply(
                        lambda x: self._safe_literal_eval(x, default_value=[])
                    )
                else:
                    print(f"Warning: '{col}' missing in users.csv. Filling with empty lists.")
                    data['users'][col] = [[] for _ in range(len(data['users']))]

        # 3. Handle Dishes
        if 'dishes' in data and not data['dishes'].empty:
            # Define default values for essential columns
            defaults = {
                'price': 0,
                'rating': 3.0,
                'category': 'unknown_category'
            }

            # Fill missing numerical/categorical values
            for col, default_val in defaults.items():
                if col not in data['dishes'].columns:
                    print(f"Warning: '{col}' column missing in dishes. Creating it with default: {default_val}")
                    data['dishes'][col] = default_val
                else:
                    data['dishes'][col] = data['dishes'][col].fillna(default_val)

            # Fill missing tag columns with an empty list string representation
            tag_cols = ['food_tags', 'taste_tags', 'cooking_method_tags', 'culture_tags']
            for tag_col in tag_cols:
                if tag_col not in data['dishes'].columns:
                    data['dishes'][tag_col] = '[]'
                else:
                    data['dishes'][tag_col] = data['dishes'][tag_col].fillna('[]')

        return data