"""
Data preprocessing script for the recommendation system.

This script cleans and transforms raw data into ML-ready formats.
"""

import os
import sys
import pandas as pd
import numpy as np
import json
import argparse
from typing import Dict, List, Any
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from preprocessing.encoders import FeatureEncoder
from preprocessing.dataset_builder import DatasetBuilder


class DataPreprocessor:
    """Preprocess raw data for recommendation system training."""
    
    def __init__(self, input_dir: str, output_dir: str):
        """
        Initialize preprocessor.
        
        Args:
            input_dir: Directory containing raw CSV files
            output_dir: Directory to save processed data
        """
        self.input_dir = input_dir
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def load_raw_data(self) -> Dict[str, pd.DataFrame]:
        """
        Load raw data from CSV files.
        
        Returns:
            Dictionary containing DataFrames
        """
        data = {}
        
        # Load interactions
        interactions_path = os.path.join(self.input_dir, 'interactions.csv')
        if os.path.exists(interactions_path):
            data['interactions'] = pd.read_csv(interactions_path)
            print(f"Loaded {len(data['interactions'])} interactions")
        else:
            raise FileNotFoundError(f"Interactions file not found: {interactions_path}")
        
        # Load users
        users_path = os.path.join(self.input_dir, 'users.csv')
        if os.path.exists(users_path):
            data['users'] = pd.read_csv(users_path)
            print(f"Loaded {len(data['users'])} users")
        else:
            raise FileNotFoundError(f"Users file not found: {users_path}")
        
        # Load dishes
        dishes_path = os.path.join(self.input_dir, 'dishes.csv')
        if os.path.exists(dishes_path):
            data['dishes'] = pd.read_csv(dishes_path)
            print(f"Loaded {len(data['dishes'])} dishes")
        else:
            raise FileNotFoundError(f"Dishes file not found: {dishes_path}")
        
        # Load stores (optional)
        stores_path = os.path.join(self.input_dir, 'stores.csv')
        if os.path.exists(stores_path):
            data['stores'] = pd.read_csv(stores_path)
            print(f"Loaded {len(data['stores'])} stores")
        
        return data
    
    def clean_interactions(self, interactions_df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean interactions data.
        
        Args:
            interactions_df: Raw interactions DataFrame
            
        Returns:
            Cleaned interactions DataFrame
        """
        df = interactions_df.copy()
        
        # Remove rows with missing essential fields
        df = df.dropna(subset=['user_id', 'dish_id', 'store_id', 'timestamp'])
        
        # Convert timestamp to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Remove future timestamps
        now = datetime.now()
        df = df[df['timestamp'] <= now]
        
        # Remove very old interactions (older than 2 years)
        cutoff_date = now - pd.Timedelta(days=730)
        df = df[df['timestamp'] >= cutoff_date]
        
        # Clean event types
        valid_events = ['order', 'cart_add', 'rating']
        df = df[df['event_type'].isin(valid_events)]
        
        # Clean ratings (keep only valid ratings 1-5)
        df['rating'] = pd.to_numeric(df['rating'], errors='coerce')
        df = df[(df['rating'].isna()) | ((df['rating'] >= 1) & (df['rating'] <= 5))]
        
        print(f"Cleaned interactions: {len(df)} rows")
        return df
    
    def clean_users(self, users_df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean users data.
        
        Args:
            users_df: Raw users DataFrame
            
        Returns:
            Cleaned users DataFrame
        """
        df = users_df.copy()
        
        # Clean age
        df['age'] = pd.to_numeric(df['age'], errors='coerce')
        df['age'] = df['age'].fillna(df['age'].median())
        df['age'] = df['age'].clip(18, 100)  # Reasonable age range
        
        # Clean gender
        valid_genders = ['male', 'female', 'unknown']
        df['gender'] = df['gender'].fillna('unknown')
        df['gender'] = df['gender'].apply(lambda x: x if x in valid_genders else 'unknown')
        
        # Clean location
        df['location_lat'] = pd.to_numeric(df['location_lat'], errors='coerce')
        df['location_lon'] = pd.to_numeric(df['location_lon'], errors='coerce')
        
        # Fill missing locations with default (Ho Chi Minh City)
        df['location_lat'] = df['location_lat'].fillna(10.8231)
        df['location_lon'] = df['location_lon'].fillna(106.6297)
        
        # Clean dislike_taste and allergy (ensure they are valid JSON)
        for col in ['dislike_taste', 'allergy']:
            df[col] = df[col].fillna('[]')
            df[col] = df[col].apply(lambda x: json.dumps([]) if pd.isna(x) else x)
        
        print(f"Cleaned users: {len(df)} rows")
        return df
    
    def clean_dishes(self, dishes_df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean dishes data.
        
        Args:
            dishes_df: Raw dishes DataFrame
            
        Returns:
            Cleaned dishes DataFrame
        """
        df = dishes_df.copy()
        
        # Clean price
        df['price'] = pd.to_numeric(df['price'], errors='coerce')
        df['price'] = df['price'].fillna(df['price'].median())
        df['price'] = df['price'].clip(0, 1000)  # Reasonable price range
        
        # Clean order_times
        df['order_times'] = pd.to_numeric(df['order_times'], errors='coerce')
        df['order_times'] = df['order_times'].fillna(0)
        df['order_times'] = df['order_times'].clip(0, 10000)
        
        # Clean average_rating
        df['average_rating'] = pd.to_numeric(df['average_rating'], errors='coerce')
        df['average_rating'] = df['average_rating'].fillna(3.0)
        df['average_rating'] = df['average_rating'].clip(1.0, 5.0)
        
        # Clean location
        df['location_lat'] = pd.to_numeric(df['location_lat'], errors='coerce')
        df['location_lon'] = pd.to_numeric(df['location_lon'], errors='coerce')
        
        # Fill missing locations with default
        df['location_lat'] = df['location_lat'].fillna(10.8231)
        df['location_lon'] = df['location_lon'].fillna(106.6297)
        
        # Clean tags and taste (ensure valid JSON)
        for col in ['dish_tags', 'dish_taste']:
            df[col] = df[col].fillna('[]')
            df[col] = df[col].apply(lambda x: json.dumps([]) if pd.isna(x) else x)
        
        # Clean system_category
        df['system_category'] = df['system_category'].fillna('unknown')
        
        print(f"Cleaned dishes: {len(df)} rows")
        return df
    
    def preprocess_all(self) -> None:
        """
        Preprocess all data and save to parquet files.
        """
        print("Loading raw data...")
        data = self.load_raw_data()
        
        print("Cleaning data...")
        # Clean each dataset
        interactions_df = self.clean_interactions(data['interactions'])
        users_df = self.clean_users(data['users'])
        dishes_df = self.clean_dishes(data['dishes'])
        
        # Save cleaned data as parquet files
        interactions_df.to_parquet(os.path.join(self.output_dir, 'interactions.parquet'), index=False)
        users_df.to_parquet(os.path.join(self.output_dir, 'users.parquet'), index=False)
        dishes_df.to_parquet(os.path.join(self.output_dir, 'dishes.parquet'), index=False)
        
        print(f"Saved cleaned data to {self.output_dir}")
        
        # Create and fit encoder
        print("Creating and fitting encoder...")
        encoder = FeatureEncoder()
        encoder.fit({
            'users': users_df,
            'dishes': dishes_df,
            'interactions': interactions_df
        })
        
        # Save encoder
        encoder.save('encoders.pkl')
        print("Saved encoder to encoders.pkl")
        
        # Create datasets with negative sampling
        print("Creating datasets with negative sampling...")
        builder = DatasetBuilder(interactions_df, users_df, dishes_df)
        datasets = builder.create_datasets()
        
        # Save datasets
        dataset_dir = os.path.join(self.output_dir, 'dataset')
        builder.save_datasets(datasets, dataset_dir)
        
        # Print statistics
        stats = builder.get_dataset_stats(datasets)
        print("\n=== DATASET STATISTICS ===")
        for split_name, split_stats in stats.items():
            print(f"\n{split_name.upper()}:")
            for key, value in split_stats.items():
                print(f"  {key}: {value}")
        
        print(f"\nPreprocessing completed! Files saved to {self.output_dir}")


def main():
    """Main preprocessing function."""
    parser = argparse.ArgumentParser(description='Preprocess data for recommendation system')
    parser.add_argument('--input', default='data', 
                       help='Input directory containing raw CSV files')
    parser.add_argument('--output', default='data/clean', 
                       help='Output directory for processed data')
    
    args = parser.parse_args()
    
    # Create preprocessor
    preprocessor = DataPreprocessor(args.input, args.output)
    
    # Run preprocessing
    preprocessor.preprocess_all()


if __name__ == "__main__":
    main()
