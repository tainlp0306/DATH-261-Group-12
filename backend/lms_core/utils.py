from datetime import timedelta
from django.utils import timezone

def calculate_sm2(is_correct, repetitions, interval, ease_factor):
    """
    Thuật toán SuperMemo-2 cơ bản
    - is_correct: True (trả lời đúng) hoặc False (trả lời sai)
    """
    # Quy đổi điểm quality: đúng = 4 (nhớ tốt), sai = 0 (quên hoàn toàn)
    quality = 4 if is_correct else 0 

    if quality >= 3: # Nếu trả lời đúng
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = round(interval * ease_factor)
        repetitions += 1
    else: # Nếu trả lời sai
        repetitions = 0
        interval = 1
    
    # Tính toán lại hệ số độ khó (ease_factor)
    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if ease_factor < 1.3:
        ease_factor = 1.3
        
    next_review_date = timezone.now() + timedelta(days=interval)
        
    return repetitions, interval, ease_factor, next_review_date