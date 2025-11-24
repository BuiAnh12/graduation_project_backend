from dotenv import load_dotenv
load_dotenv()

import os
import json
import pandas as pd
from typing import List, Dict, Any, Set
from google import genai
from google.genai import types


class LLMService:
    """
    Dịch vụ tương tác với Gemini API (sử dụng SDK mới 'google-genai'), 
    với logic lọc tag hiệu quả.
    """
    
    BASE_DATA_PATH = "server/src/data/exported_data/"
    TAG_FILES = {
        "taste": "taste_tags.csv",
        "method": "cooking_method_tags.csv",
        "ingredient": "food_tags.csv",
        "culture": "culture_tags.csv"
    }

    def __init__(self, model_name: str = 'gemini-2.5-flash'):
        try:
            # --- SỬA LỖI KHỞI TẠO ---
            # SDK mới sử dụng Client().
            # Nó sẽ tự động đọc API key từ biến môi trường GEMINI_API_KEY.
            self.client = genai.Client()
            self.model_name = model_name # Lưu lại tên model để sử dụng
            
            print(f"Đã khởi tạo LLMService (SDK mới) thành công với model: {self.model_name}")
        except Exception as e:
            print(f"FATAL: Không thể khởi tạo genai.Client() hoặc kết nối tới model.")
            print("Hãy chắc chắn GEMINI_API_KEY đã được set và bạn có kết nối mạng.")
            print(f"Lỗi chi tiết: {e}")
            self.client = None
        
        # --- PHẦN TẢI TAG (Giữ nguyên) ---
        self.taste_tags_set_norm: Set[str] = self._load_tags_to_norm_set(self.TAG_FILES["taste"])
        self.method_tags_set_norm: Set[str] = self._load_tags_to_norm_set(self.TAG_FILES["method"])
        self.ingredient_tags_set_norm: Set[str] = self._load_tags_to_norm_set(self.TAG_FILES["ingredient"])
        self.culture_tags_set_norm: Set[str] = self._load_tags_to_norm_set(self.TAG_FILES["culture"])
        
        print(f"Đã tải {len(self.taste_tags_set_norm)} taste tags.")
        print(f"Đã tải {len(self.method_tags_set_norm)} method tags.")
        print(f"Đã tải {len(self.ingredient_tags_set_norm)} ingredient tags.")
        print(f"Đã tải {len(self.culture_tags_set_norm)} culture tags.")
        # ------------------------------------

    def _load_tags_to_norm_set(self, filename: str) -> Set[str]:
        """
        Hàm private để tải file CSV (Giữ nguyên).
        """
        try:
            file_path = os.path.join(self.BASE_DATA_PATH, filename)
            df = pd.read_csv(file_path)
            return {str(name).lower().strip() for name in df['name']}
        except FileNotFoundError:
            print(f"CẢNH BÁO: Không tìm thấy file tag: {file_path}. Trả về set rỗng.")
            return set()
        except Exception as e:
            print(f"Lỗi khi tải file {filename}: {e}. Trả về set rỗng.")
            return set()

    def _build_tagging_prompt(self, name: str, description: str) -> str:
        """
        Hàm xây dựng prompt (Giữ nguyên).
        """
        return f"""
        Bạn là một chuyên gia ẩm thực. Nhiệm vụ của bạn là phân tích tên và mô tả 
        của một món ăn và trích xuất các thẻ có liên quan.

        Chỉ tập trung vào các thông tin sau:
        1.  **taste_tags**: Hương vị (ví dụ: cay, ngọt, chua, béo ngậy).
        2.  **method_tags**: Cách chế biến (ví dụ: nướng, chiên, xào, hấp).
        3.  **ingredient_tags**: Thành phần chính (ví dụ: 'thịt gà', 'thịt bò', 'cá basa', 'tôm', 'đậu hũ').
        4.  **culture_tags**: Nguồn gốc ẩm thực (ví dụ: 'Việt Nam', 'Thái Lan', 'Nhật Bản').

        ĐỊNH DẠNG ĐẦU RA:
        Chỉ trả về một đối tượng JSON hợp lệ. KHÔNG trả về bất cứ văn bản nào khác.
        JSON phải có 4 key: `taste_tags`, `method_tags`, `ingredient_tags`, và `culture_tags`.
        Mỗi key phải là một danh sách (list) các chuỗi (string). Nếu không tìm thấy, 
        trả về một danh sách rỗng.

        DỮ LIỆU ĐẦU VÀO:
        - Tên món ăn: "{name}"
        - Mô tả: "{description}"

        JSON ĐẦU RA:
        """

    def _filter_llm_tags(self, llm_output: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Hàm lọc tag (Giữ nguyên).
        """
        
        def filter_list(llm_tags: List[str], allow_set: Set[str]) -> List[str]:
            if not isinstance(llm_tags, list):
                return [] 
                
            final_tags = []
            for tag in llm_tags:
                norm_tag = str(tag).lower().strip()
                if norm_tag in allow_set:
                    final_tags.append(tag) 
            return final_tags

        taste_candidates = llm_output.get("taste_tags", [])
        method_candidates = llm_output.get("method_tags", [])
        ingredient_candidates = llm_output.get("ingredient_tags", [])
        culture_candidates = llm_output.get("culture_tags", [])

        final_output = {
            "taste_tags": filter_list(taste_candidates, self.taste_tags_set_norm),
            "method_tags": filter_list(method_candidates, self.method_tags_set_norm),
            "ingredient_tags": filter_list(ingredient_candidates, self.ingredient_tags_set_norm),
            "culture_tags": filter_list(culture_candidates, self.culture_tags_set_norm)
        }
        
        return final_output


    async def extract_tags(self, name: str, description: str) -> Dict[str, List[str]]:
        """
        Chức năng 1: Gán thẻ (Cập nhật logic gọi API).
        """
        error_payload = {
            "taste_tags": [], "method_tags": [], "ingredient_tags": [], "culture_tags": []
        }
        
        # --- SỬA LỖI KIỂM TRA ---
        if not self.client:
            print("Lỗi: Client chưa được khởi tạo")
            return error_payload

        prompt = self._build_tagging_prompt(name, description)
        
        try:
            # --- SỬA LỖI GỌI API ---
            # SDK mới gọi 'generate_content_async' trên client
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_budget=0
        )
    )
            )
            print(response) # In ra để debug
            
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:-3].strip()
            elif raw_text.startswith("`"):
                raw_text = raw_text[1:-1].strip()

            llm_output_dict = json.loads(raw_text)
            
            filtered_output = self._filter_llm_tags(llm_output_dict)
            
            return filtered_output
            
        except Exception as e:
            print(f"Lỗi khi trích xuất thẻ: {e}")
            return error_payload

    async def optimize_description(self, name: str, description: str) -> Dict[str, str]:
        """
        Chức năng 2: Tối ưu mô tả (Cập nhật logic gọi API).
        """
        
        # --- SỬA LỖI KIỂM TRA ---
        if not self.client:
            return {"error": "Client not initialized"}

        # Xây dựng prompt cho chức năng 2 (cần hàm _build_optimize_prompt)
        prompt = self._build_optimize_prompt(name, description)
        
        try:
            # --- SỬA LỖI GỌI API ---
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_budget=0
        )
    )
            )
            print(response) # In ra để debug
            
            return {
                "original_name": name,
                "original_description": description,
                "new_description": response.text.strip()
            }

        except Exception as e:
            print(f"Lỗi khi tối ưu mô tả: {e}")
            return {
                "original_name": name,
                "original_description": description,
                "new_description": f"Lỗi khi tạo mô tả: {e}"
            }

    def _build_optimize_prompt(self, name: str, description: str) -> str:
        base_text = description if description else name
        
        return f"""
        Bạn là một hệ thống backend chuyên tạo nội dung ẩm thực (Copywriter API). 
        Nhiệm vụ của bạn là nhận vào thông tin món ăn và trả về duy nhất đoạn văn mô tả đã được viết lại hấp dẫn.

        DỮ LIỆU ĐẦU VÀO:
        - Món ăn: "{name}"
        - Thông tin gốc: "{base_text}"

        YÊU CẦU NỘI DUNG:
        - Sử dụng từ ngữ kích thích vị giác (mùi thơm, vị đậm đà, kết cấu giòn/mềm...).
        - Văn phong chuyên nghiệp, mời gọi, phù hợp cho menu ứng dụng đặt món.
        - Giữ độ dài vừa phải (khoảng 2-3 câu).

        YÊU CẦU ĐỊNH DẠNG (QUAN TRỌNG):
        - Trả về kết quả trực tiếp (Raw String).
        - TUYỆT ĐỐI KHÔNG thêm lời dẫn như: "Đây là mô tả...", "Dưới đây là...", "Chắc chắn rồi...".
        - TUYỆT ĐỐI KHÔNG để nội dung trong dấu ngoặc kép "".
        - Nếu không thể viết lại, hãy trả về chính xác thông tin gốc.

        OUTPUT:
        """