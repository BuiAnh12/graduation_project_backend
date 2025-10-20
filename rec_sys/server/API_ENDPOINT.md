# 🍜 Dish Recognition & Recommendation API

This API provides:

* **Dish image tagging** using a pretrained image classification model (`nateraw/food`).
* **Dish recommendations** using your trained two-tower recommendation model.
* **Behavior scenario testing** (cold start, spice lover, budget user, etc.).

---

## ⚙️ 1. Setup

### Install dependencies

```bash
pip install fastapi uvicorn torch torchvision transformers pillow pandas numpy
```

### Run the API

User must stand at server to run this smoothly 
```bash
uvicorn server.main:app --reload --port 8000
```

Open docs:
👉 [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🧩 2. Endpoints

### 🔹 Health Check

**GET** `/`

```json
{"message": "Dish Recognition & Recommendation API is running 🚀"}
```

---

### 🔹 Tag Prediction (Image Upload)

**POST** `/tag/predict`
Content-Type: `multipart/form-data`

#### Example (curl)

```bash
curl -X POST "http://127.0.0.1:8000/tag/predict" \
  -F "image=@sample_image.jpg"
```

#### Response

```json
{
  "success": true,
  "predicted_label": "Pho",
  "confidence": 0.9865,
  "tags": ["Vietnamese", "noodle", "soup"]
}
```

---

### 🔹 Get Dish Recommendations

**POST** `/dish/recommend`

#### Example (existing user)

```json
{
  "user_id": "user_6",
  "top_k": 5
}
```

#### Example (cold start user)

```json
{
  "user_profile": {
    "age": 26,
    "gender": "male",
    "location": "Quận 1, TP.HCM",
    "preferences": {
      "cuisine": ["Việt Nam", "Nhật Bản"],
      "taste": ["cay nhẹ", "đậm đà"],
      "price_range": "budget"
    }
  },
  "top_k": 5
}
```

---

### 🔹 Find Similar Dishes

**POST** `/dish/similar`

```json
{
  "dish_profile": {
    "name": "Bánh Mì Pate Mới",
    "cuisine": "Việt Nam",
    "taste_profile": ["spicy-none", "umami-rich"],
    "price": 30000,
    "category": "món chính"
  },
  "top_k": 5
}
```

---

### 🔹 Run Behavior Scenario Test

**POST** `/behavior/test`

```json
{
  "behavior_name": "spice_lover"
}
```

Response includes recommendation list and alignment analysis.

---

## 🧪 3. Testing in Postman

**For image upload:**

1. Select method: `POST`
2. URL: `http://127.0.0.1:8000/tag/predict`
3. Body → `form-data`
4. Add key: `image` → type: *File* → choose your image

**For other endpoints:**

* Use raw JSON body.
* Select `application/json`.

---

## 🧾 4. Example Output

**Behavior test response**

```json
{
  "behavior": "spice_lover",
  "result": {
    "recommendations": [
      {"dish": "Bún Bò Huế", "score": 0.89},
      {"dish": "Curry Gà", "score": 0.87}
    ],
    "analysis": {
      "diversity_score": 72.0,
      "behavior_alignment": {"spice_lover": 85.0}
    }
  }
}
```

