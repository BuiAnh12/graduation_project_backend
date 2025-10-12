"""
Setup script for the food recommendation system.

This script handles the complete setup process from data export to model training.
"""

import os
import sys
import subprocess
import argparse
from typing import List, Dict, Any


class RecommendationSystemSetup:
    """Setup class for the recommendation system."""
    
    def __init__(self, base_dir: str = "."):
        """
        Initialize setup.
        
        Args:
            base_dir: Base directory for the project
        """
        self.base_dir = base_dir
        self.rec_sys_dir = os.path.join(base_dir, "rec_sys")
        
    def run_command(self, command: str, cwd: str = None) -> bool:
        """
        Run a shell command.
        
        Args:
            command: Command to run
            cwd: Working directory
            
        Returns:
            True if successful, False otherwise
        """
        try:
            result = subprocess.run(
                command, 
                shell=True, 
                cwd=cwd or self.rec_sys_dir,
                check=True, 
                capture_output=True, 
                text=True
            )
            print(f"✓ {command}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"✗ {command}")
            print(f"Error: {e.stderr}")
            return False
    
    def setup_environment(self) -> bool:
        """Set up Python environment and install dependencies."""
        print("Setting up Python environment...")
        
        # Create virtual environment
        if not os.path.exists(os.path.join(self.rec_sys_dir, "venv")):
            if not self.run_command("python -m venv venv"):
                return False
        
        # Install requirements
        if not self.run_command("venv\\Scripts\\pip install -r requirements.txt"):
            return False
        
        print("✓ Environment setup completed")
        return True
    
    def export_data(self, mongodb_uri: str) -> bool:
        """Export data from MongoDB."""
        print("Exporting data from MongoDB...")
        
        command = f"venv\\Scripts\\python scripts\\export_data.py --mongodb-uri {mongodb_uri} --output data"
        if not self.run_command(command):
            return False
        
        print("✓ Data export completed")
        return True
    
    def preprocess_data(self) -> bool:
        """Preprocess raw data."""
        print("Preprocessing data...")
        
        command = "venv\\Scripts\\python src\\preprocessing\\preprocess.py --input data --output data\\clean"
        if not self.run_command(command):
            return False
        
        print("✓ Data preprocessing completed")
        return True
    
    def train_model(self, num_epochs: int = 50) -> bool:
        """Train the recommendation model."""
        print("Training recommendation model...")
        
        command = f"venv\\Scripts\\python src\\training\\train.py"
        if not self.run_command(command):
            return False
        
        print("✓ Model training completed")
        return True
    
    def export_embeddings(self) -> bool:
        """Export item embeddings and build indices."""
        print("Exporting item embeddings...")
        
        command = "venv\\Scripts\\python scripts\\export_embeddings.py"
        if not self.run_command(command):
            return False
        
        print("✓ Embedding export completed")
        return True
    
    def start_api_server(self) -> bool:
        """Start the recommendation API server."""
        print("Starting recommendation API server...")
        
        command = "venv\\Scripts\\python src\\serving\\recommendation_service.py"
        if not self.run_command(command):
            return False
        
        print("✓ API server started")
        return True
    
    def run_full_setup(self, mongodb_uri: str, num_epochs: int = 50) -> bool:
        """
        Run the complete setup process.
        
        Args:
            mongodb_uri: MongoDB connection URI
            num_epochs: Number of training epochs
            
        Returns:
            True if successful, False otherwise
        """
        print("=== FOOD RECOMMENDATION SYSTEM SETUP ===")
        print()
        
        steps = [
            ("Setting up environment", lambda: self.setup_environment()),
            ("Exporting data from MongoDB", lambda: self.export_data(mongodb_uri)),
            ("Preprocessing data", lambda: self.preprocess_data()),
            ("Training model", lambda: self.train_model(num_epochs)),
            ("Exporting embeddings", lambda: self.export_embeddings()),
        ]
        
        for step_name, step_func in steps:
            print(f"\n{step_name}...")
            if not step_func():
                print(f"✗ Setup failed at: {step_name}")
                return False
        
        print("\n=== SETUP COMPLETED SUCCESSFULLY ===")
        print("\nNext steps:")
        print("1. Start the API server: python setup.py --start-api")
        print("2. Test the API endpoints using the provided examples")
        print("3. Integrate with your frontend application")
        
        return True


def main():
    """Main setup function."""
    parser = argparse.ArgumentParser(description='Setup food recommendation system')
    parser.add_argument('--mongodb-uri', default='mongodb://localhost:27017/food_ordering',
                       help='MongoDB connection URI')
    parser.add_argument('--epochs', type=int, default=50,
                       help='Number of training epochs')
    parser.add_argument('--start-api', action='store_true',
                       help='Start the API server')
    parser.add_argument('--full-setup', action='store_true',
                       help='Run full setup process')
    
    args = parser.parse_args()
    
    setup = RecommendationSystemSetup()
    
    if args.start_api:
        setup.start_api_server()
    elif args.full_setup:
        setup.run_full_setup(args.mongodb_uri, args.epochs)
    else:
        print("Use --full-setup to run the complete setup process")
        print("Use --start-api to start the API server")


if __name__ == "__main__":
    main()
