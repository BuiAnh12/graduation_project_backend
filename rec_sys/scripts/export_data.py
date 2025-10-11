"""
Data export script for extracting data from MongoDB.

This script exports user interactions, user profiles, and dish information
from the MongoDB database for training the recommendation system.
"""

import os
import sys
import pandas as pd
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any
import argparse

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from pymongo import MongoClient
    import motor.motor_asyncio
except ImportError:
    print("Please install pymongo and motor: pip install pymongo motor")
    sys.exit(1)


class DataExporter:
    """Export data from MongoDB for recommendation system training."""
    
    def __init__(self, mongodb_uri: str):
        """
        Initialize data exporter.
        
        Args:
            mongodb_uri: MongoDB connection URI
        """
        self.client = MongoClient(mongodb_uri)
        self.db = self.client.get_default_database()
    
    def export_interactions(self) -> pd.DataFrame:
        """
        Export user-item interactions from orders and cart activities.
        
        Returns:
            DataFrame with interaction data
        """
        interactions = []
        
        # Export from orders
        orders = self.db.orders.find({}, {
            'userId': 1,
            'orderItems': 1,
            'createdAt': 1,
            'status': 1
        })
        
        for order in orders:
            if order.get('status') == 'completed':  # Only completed orders
                for item in order.get('orderItems', []):
                    interactions.append({
                        'user_id': order['userId'],
                        'dish_id': item.get('dishId'),
                        'store_id': item.get('storeId'),
                        'timestamp': order['createdAt'],
                        'event_type': 'order',
                        'rating': None
                    })
        
        # Export from cart activities (cart_add events)
        cart_activities = self.db.cart_activities.find({
            'action': 'add'
        }, {
            'userId': 1,
            'dishId': 1,
            'storeId': 1,
            'createdAt': 1
        })
        
        for activity in cart_activities:
            interactions.append({
                'user_id': activity['userId'],
                'dish_id': activity['dishId'],
                'store_id': activity['storeId'],
                'timestamp': activity['createdAt'],
                'event_type': 'cart_add',
                'rating': None
            })
        
        # Export from ratings
        ratings = self.db.ratings.find({}, {
            'userId': 1,
            'dishId': 1,
            'storeId': 1,
            'rating': 1,
            'createdAt': 1
        })
        
        for rating in ratings:
            interactions.append({
                'user_id': rating['userId'],
                'dish_id': rating['dishId'],
                'store_id': rating['storeId'],
                'timestamp': rating['createdAt'],
                'event_type': 'rating',
                'rating': rating['rating']
            })
        
        # Convert to DataFrame
        df = pd.DataFrame(interactions)
        
        # Remove duplicates and invalid entries
        df = df.dropna(subset=['user_id', 'dish_id', 'store_id'])
        df = df.drop_duplicates()
        
        # Convert timestamp to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        return df
    
    def export_users(self) -> pd.DataFrame:
        """
        Export user profiles.
        
        Returns:
            DataFrame with user data
        """
        users = []
        
        # Get users from accounts collection
        accounts = self.db.accounts.find({}, {
            '_id': 1,
            'email': 1,
            'dateOfBirth': 1,
            'gender': 1,
            'location': 1,
            'dislikeTaste': 1,
            'allergy': 1,
            'createdAt': 1
        })
        
        for account in accounts:
            # Calculate age from date of birth
            age = None
            if account.get('dateOfBirth'):
                try:
                    dob = pd.to_datetime(account['dateOfBirth'])
                    age = (datetime.now() - dob).days // 365
                except:
                    age = None
            
            # Extract location
            location = account.get('location', {})
            lat = location.get('lat', 0.0) if location else 0.0
            lon = location.get('lon', 0.0) if location else 0.0
            
            # Extract dislike and allergy lists
            dislike_taste = account.get('dislikeTaste', [])
            allergy = account.get('allergy', [])
            
            users.append({
                'user_id': str(account['_id']),
                'age': age,
                'gender': account.get('gender', 'unknown'),
                'location_lat': lat,
                'location_lon': lon,
                'dislike_taste': json.dumps(dislike_taste) if dislike_taste else json.dumps([]),
                'allergy': json.dumps(allergy) if allergy else json.dumps([])
            })
        
        return pd.DataFrame(users)
    
    def export_dishes(self) -> pd.DataFrame:
        """
        Export dish information.
        
        Returns:
            DataFrame with dish data
        """
        dishes = []
        
        # Get dishes from dishes collection
        dish_docs = self.db.dishes.find({}, {
            '_id': 1,
            'name': 1,
            'storeId': 1,
            'tags': 1,
            'taste': 1,
            'price': 1,
            'systemCategory': 1,
            'averageRating': 1,
            'orderTimes': 1,
            'location': 1
        })
        
        for dish in dish_docs:
            # Extract location
            location = dish.get('location', {})
            lat = location.get('lat', 0.0) if location else 0.0
            lon = location.get('lon', 0.0) if location else 0.0
            
            # Extract tags and taste
            tags = dish.get('tags', [])
            taste = dish.get('taste', [])
            
            dishes.append({
                'dish_id': str(dish['_id']),
                'store_id': str(dish['storeId']),
                'dish_tags': json.dumps(tags) if tags else json.dumps([]),
                'dish_taste': json.dumps(taste) if taste else json.dumps([]),
                'order_times': dish.get('orderTimes', 0),
                'price': dish.get('price', 0.0),
                'system_category': dish.get('systemCategory', 'unknown'),
                'location_lat': lat,
                'location_lon': lon,
                'average_rating': dish.get('averageRating', 3.0)
            })
        
        return pd.DataFrame(dishes)
    
    def export_stores(self) -> pd.DataFrame:
        """
        Export store information.
        
        Returns:
            DataFrame with store data
        """
        stores = []
        
        # Get stores from stores collection
        store_docs = self.db.stores.find({}, {
            '_id': 1,
            'name': 1,
            'location': 1,
            'systemCategory': 1
        })
        
        for store in store_docs:
            # Extract location
            location = store.get('location', {})
            lat = location.get('lat', 0.0) if location else 0.0
            lon = location.get('lon', 0.0) if location else 0.0
            
            stores.append({
                'store_id': str(store['_id']),
                'name': store.get('name', ''),
                'location_lat': lat,
                'location_lon': lon,
                'system_category': store.get('systemCategory', 'unknown')
            })
        
        return pd.DataFrame(stores)
    
    def export_all(self, output_dir: str) -> None:
        """
        Export all data to CSV files.
        
        Args:
            output_dir: Directory to save exported data
        """
        os.makedirs(output_dir, exist_ok=True)
        
        print("Exporting interactions...")
        interactions_df = self.export_interactions()
        interactions_df.to_csv(os.path.join(output_dir, 'interactions.csv'), index=False)
        print(f"Exported {len(interactions_df)} interactions")
        
        print("Exporting users...")
        users_df = self.export_users()
        users_df.to_csv(os.path.join(output_dir, 'users.csv'), index=False)
        print(f"Exported {len(users_df)} users")
        
        print("Exporting dishes...")
        dishes_df = self.export_dishes()
        dishes_df.to_csv(os.path.join(output_dir, 'dishes.csv'), index=False)
        print(f"Exported {len(dishes_df)} dishes")
        
        print("Exporting stores...")
        stores_df = self.export_stores()
        stores_df.to_csv(os.path.join(output_dir, 'stores.csv'), index=False)
        print(f"Exported {len(stores_df)} stores")
        
        # Create tags.csv from dish tags
        print("Creating tags.csv...")
        all_tags = set()
        for tags_json in dishes_df['dish_tags']:
            if tags_json:
                try:
                    tags = json.loads(tags_json)
                    all_tags.update(tags)
                except:
                    pass
        
        tags_df = pd.DataFrame({'tag': list(all_tags)})
        tags_df.to_csv(os.path.join(output_dir, 'tags.csv'), index=False)
        print(f"Exported {len(tags_df)} unique tags")
        
        print(f"\nData export completed! Files saved to {output_dir}")
        
        # Print summary statistics
        print("\n=== EXPORT SUMMARY ===")
        print(f"Interactions: {len(interactions_df)}")
        print(f"Users: {len(users_df)}")
        print(f"Dishes: {len(dishes_df)}")
        print(f"Stores: {len(stores_df)}")
        print(f"Tags: {len(tags_df)}")
        
        if len(interactions_df) > 0:
            print(f"Date range: {interactions_df['timestamp'].min()} to {interactions_df['timestamp'].max()}")
            print(f"Event types: {interactions_df['event_type'].value_counts().to_dict()}")


def main():
    """Main function for data export."""
    parser = argparse.ArgumentParser(description='Export data from MongoDB for recommendation system')
    parser.add_argument('--mongodb-uri', default='mongodb://localhost:27017/food_ordering', 
                       help='MongoDB connection URI')
    parser.add_argument('--output', default='data', 
                       help='Output directory for exported data')
    
    args = parser.parse_args()
    
    # Create data exporter
    exporter = DataExporter(args.mongodb_uri)
    
    # Export all data
    exporter.export_all(args.output)


if __name__ == "__main__":
    main()
