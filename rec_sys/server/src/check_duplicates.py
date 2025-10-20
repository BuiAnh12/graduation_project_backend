import pandas as pd
import os

# --- Cấu hình ---
# !!! QUAN TRỌNG: Đảm bảo đường dẫn này chính xác so với vị trí bạn chạy file
# Nếu bạn chạy từ thư mục 'backend', đường dẫn này là đúng.
FILE_PATH = os.path.join('exported_data', 'dishes.csv')
ID_COLUMN = 'id'
# ------------------

try:
    print(f"Đang tải dữ liệu từ: {FILE_PATH}")
    df = pd.read_csv(FILE_PATH)

    print(f"Đang tìm các dòng trùng lặp trong cột: '{ID_COLUMN}'...")
    # keep=False sẽ lấy TẤT CẢ các dòng có ID bị trùng
    duplicates = df[df.duplicated(subset=[ID_COLUMN], keep=False)]

    if not duplicates.empty:
        print("\n--- ĐÃ TÌM THẤY CÁC DÒNG TRÙNG LẶP ---")
        print("Các dòng dưới đây có cùng ID. Kết quả đã được sắp xếp để bạn dễ dàng nhìn thấy các cặp trùng nhau:")
        # Sắp xếp kết quả theo cột ID để nhóm các dòng trùng lặp lại với nhau
        print(duplicates.sort_values(by=ID_COLUMN))
    else:
        print("\n--- KHÔNG TÌM THẤY DÒNG NÀO TRÙNG LẶP ---")
        print("Tệp có vẻ không có lỗi trùng lặp ID.")

except FileNotFoundError:
    print(f"\n--- LỖI ---")
    print(f"Không tìm thấy tệp tại '{FILE_PATH}'.")
    print("Hãy đảm bảo bạn đang chạy script này từ thư mục 'backend', hoặc điều chỉnh lại biến FILE_PATH.")
except KeyError:
    print(f"\n--- LỖI ---")
    print(f"Tệp không có cột nào tên là '{ID_COLUMN}'. Vui lòng kiểm tra lại tên cột.")