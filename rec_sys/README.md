# Food Ordering Recommendation System

A two-tower recommendation system for food ordering with three main prediction goals:

1. **Global personalized recommendations** - Top K dishes for home page slider
2. **Next dish prediction** - Top 1 dish after adding to cart (same store)
3. **Cart suggestions** - Top K dishes while reviewing cart (same store)

## Architecture

- **Two-tower model** with user and item embeddings
- **Positive signals**: finalized orders, cart additions, ratings ≥ 3
- **Negative sampling**: uniform random sampling
- **Retrieval**: Redis vector store or Faiss for larger datasets

## Setup

### 1. Environment Setup

```bash
# Create virtual environment
python -m venv venv

# Activate environment (Windows)
venv\Scripts\activate

# Activate environment (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Variables

Create `.env` file in the root directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/food_ordering
REDIS_URL=redis://localhost:6379

# Model settings
EMBEDDING_DIM=64
BATCH_SIZE=32
LEARNING_RATE=0.001

# API settings
API_HOST=0.0.0.0
API_PORT=8000
```

### 3. Data Export

```bash
# Export data from MongoDB
python scripts/export_data.py --output data/

# Clean and preprocess
python src/preprocessing/preprocess.py --input data/ --output data/clean/
```

### 4. Training

```bash
# Train the model
python src/training/train.py --data data/clean/ --output runs/
```

### 5. Serving

```bash
# Start recommendation API
python src/serving/recommendation_service.py
```

## Project Structure

```
rec_sys/
├── data/                    # Raw and processed data
│   ├── clean/              # Cleaned parquet files
│   └── dataset/            # Training datasets
├── src/
│   ├── preprocessing/       # Data preprocessing
│   ├── models/             # Model implementations
│   ├── training/           # Training scripts
│   └── serving/            # API serving
├── notebooks/              # Jupyter notebooks
├── scripts/                # Utility scripts
└── runs/                   # Training outputs
```

## Features

### User Tower Features
- user_id, age, gender
- location (lat, lon)
- dislike_taste, allergy lists
- recency of order history

### Item Tower Features
- dish_id, store_id
- dish_tags, dish_taste
- order_times, price
- system_category, location
- average_rating

### Context Features
- time_of_day, day_of_week
- personalized recency windows

## API Endpoints

- `GET /recommend/home-slider?user_id=...&k=...` - Global recommendations
- `GET /recommend/next-dish?user_id=...&cart_item_id=...&store_id=...` - Next dish
- `GET /recommend/cart-suggestions?user_id=...&cart_items=...&store_id=...` - Cart suggestions

## Development

```bash
# Run tests
pytest tests/

# Format code
black src/

# Lint code
flake8 src/
```
