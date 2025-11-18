from google import genai
import os
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.abspath(__file__))
# Kết hợp nó với tên file .env
dotenv_path = os.path.join(base_dir, ".env")

load_dotenv(dotenv_path=dotenv_path)
# The client gets the API key from the environment variable `GEMINI_API_KEY`.
client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash", contents="Explain how AI works in a few words"
)
print(response.text)