# Food Recommendation System - Integration Guide

This guide explains how to integrate the recommendation system with your existing Node.js backend.

## Overview

The recommendation system provides three main prediction goals:

1. **Global personalized recommendations** - Top K dishes for home page slider
2. **Next dish prediction** - Top 1 dish after adding to cart (same store)
3. **Cart suggestions** - Top K dishes while reviewing cart (same store)

## Architecture

```
Node.js Backend (Express) ←→ Python Recommendation Service ←→ Redis/FAISS
```

## Setup Steps

### 1. Environment Setup

```bash
cd rec_sys
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

### 2. Data Export

```bash
# Export data from your MongoDB
python scripts/export_data.py --mongodb-uri mongodb://localhost:27017/food_ordering --output data
```

### 3. Data Preprocessing

```bash
# Clean and preprocess data
python src/preprocessing/preprocess.py --input data --output data/clean
```

### 4. Model Training

```bash
# Train the recommendation model
python src/training/train.py
```

### 5. Export Embeddings

```bash
# Export item embeddings and build indices
python scripts/export_embeddings.py
```

### 6. Start Recommendation Service

```bash
# Start the Python API server
python src/serving/recommendation_service.py
```

## API Integration

### Node.js Integration

Add these routes to your existing Express server:

```javascript
// routes/recommendation.routes.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const RECOMMENDATION_API_URL = 'http://localhost:8000';

// Get home slider recommendations
router.get('/home-slider/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { k = 10 } = req.query;
    
    const response = await axios.post(`${RECOMMENDATION_API_URL}/recommend/home-slider`, {
      user_id: userId,
      k: parseInt(k)
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get next dish recommendation
router.post('/next-dish', async (req, res) => {
  try {
    const { userId, cartItemId, storeId } = req.body;
    
    const response = await axios.post(`${RECOMMENDATION_API_URL}/recommend/next-dish`, {
      user_id: userId,
      cart_item_id: cartItemId,
      store_id: storeId
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cart suggestions
router.post('/cart-suggestions', async (req, res) => {
  try {
    const { userId, cartItems, storeId, k = 5 } = req.body;
    
    const response = await axios.post(`${RECOMMENDATION_API_URL}/recommend/cart-suggestions`, {
      user_id: userId,
      cart_items: cartItems,
      store_id: storeId,
      k: parseInt(k)
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Add to your main server.js:

```javascript
// Add this to your existing server.js
const recommendationRoute = require('./routes/recommendation.routes');
app.use('/api/v1/recommendation', recommendationRoute);
```

## Frontend Integration

### React/Next.js Example

```javascript
// components/RecommendationSlider.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const RecommendationSlider = ({ userId }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await axios.get(`/api/v1/recommendation/home-slider/${userId}?k=10`);
        setRecommendations(response.data.recommendations);
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchRecommendations();
    }
  }, [userId]);

  if (loading) return <div>Loading recommendations...</div>;

  return (
    <div className="recommendation-slider">
      <h3>Recommended for You</h3>
      <div className="slider">
        {recommendations.map((item, index) => (
          <div key={index} className="recommendation-item">
            <h4>{item.name}</h4>
            <p>Price: ${item.price}</p>
            <p>Score: {item.score.toFixed(3)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendationSlider;
```

### Cart Integration

```javascript
// components/CartSuggestions.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CartSuggestions = ({ userId, cartItems, storeId }) => {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (cartItems.length > 0) {
        try {
          const response = await axios.post('/api/v1/recommendation/cart-suggestions', {
            userId,
            cartItems,
            storeId,
            k: 5
          });
          setSuggestions(response.data.recommendations);
        } catch (error) {
          console.error('Failed to fetch suggestions:', error);
        }
      }
    };

    fetchSuggestions();
  }, [userId, cartItems, storeId]);

  return (
    <div className="cart-suggestions">
      <h4>You might also like:</h4>
      {suggestions.map((item, index) => (
        <div key={index} className="suggestion-item">
          <span>{item.name}</span>
          <span>${item.price}</span>
        </div>
      ))}
    </div>
  );
};

export default CartSuggestions;
```

## Database Schema Updates

### Add recommendation tracking to your MongoDB:

```javascript
// models/recommendation_logs.model.js
const mongoose = require('mongoose');

const recommendationLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  recommendationType: {
    type: String,
    enum: ['home_slider', 'next_dish', 'cart_suggestions'],
    required: true
  },
  candidates: [{
    dishId: String,
    score: Number,
    position: Number
  }],
  selectedDishId: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RecommendationLog', recommendationLogSchema);
```

## Monitoring and Analytics

### Track recommendation performance:

```javascript
// utils/recommendationAnalytics.js
const RecommendationLog = require('../models/recommendation_logs.model');

const trackRecommendation = async (userId, sessionId, type, candidates, selectedDishId) => {
  try {
    await RecommendationLog.create({
      userId,
      sessionId,
      recommendationType: type,
      candidates,
      selectedDishId,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to track recommendation:', error);
  }
};

const getRecommendationMetrics = async (startDate, endDate) => {
  const logs = await RecommendationLog.find({
    timestamp: { $gte: startDate, $lte: endDate }
  });
  
  const metrics = {
    totalRecommendations: logs.length,
    clickThroughRate: logs.filter(log => log.selectedDishId).length / logs.length,
    averagePosition: logs.reduce((sum, log) => {
      const selected = log.candidates.find(c => c.dishId === log.selectedDishId);
      return sum + (selected ? selected.position : 0);
    }, 0) / logs.length
  };
  
  return metrics;
};

module.exports = { trackRecommendation, getRecommendationMetrics };
```

## Deployment

### Docker Setup

```dockerfile
# Dockerfile.recommendation
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "src/serving/recommendation_service.py"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  recommendation-service:
    build:
      context: ./rec_sys
      dockerfile: Dockerfile.recommendation
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

## Testing

### Test the recommendation system:

```bash
# Test the setup
python test_setup.py

# Test API endpoints
curl -X POST http://localhost:8000/recommend/home-slider \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_1", "k": 10}'
```

## Performance Optimization

1. **Caching**: Use Redis to cache user embeddings
2. **Batch Processing**: Process recommendations in batches
3. **Async Processing**: Use async/await for non-blocking operations
4. **Monitoring**: Track API response times and error rates

## Troubleshooting

### Common Issues:

1. **Model not found**: Ensure the model is trained and saved correctly
2. **Encoder errors**: Check that the encoder is fitted on the same data
3. **Memory issues**: Reduce batch size or use smaller embedding dimensions
4. **API timeouts**: Increase timeout values or optimize model inference

### Debug Commands:

```bash
# Check if all components are working
python -c "from src.models.two_tower import TwoTowerModel; print('Model OK')"
python -c "from src.preprocessing.encoders import FeatureEncoder; print('Encoder OK')"
python -c "import torch; print(f'PyTorch version: {torch.__version__}')"
```

## Next Steps

1. **A/B Testing**: Implement A/B testing for different recommendation strategies
2. **Real-time Updates**: Update recommendations based on real-time user behavior
3. **Cold Start**: Implement fallback strategies for new users/items
4. **Feedback Loop**: Use user feedback to improve recommendations
5. **Scalability**: Consider distributed training and serving for larger datasets
