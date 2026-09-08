import re

with open('backend/main.py', 'r', encoding='utf-8') as f:
    app = f.read()

# Locate the tick method
old_tick = '''    def tick(self, dt):
        if self.is_paused or self.is_suspended:
            return

        if self.phase == 'sedentary':'''

new_tick = '''    def tick(self, dt):
        if self.is_paused or self.is_suspended:
            return
            
        # --- 休眠防误报与自动重置 ---
        if dt > 300:
            # 电脑可能休眠了超过 5 分钟，默认用户已休息，自动回满所有状态
            self.eye_care_left = self.eye_care_total
            self.sedentary_left = self.sedentary_duration
            self.phase = 'sedentary'
            return
        elif dt > 10:
            # 休眠或严重卡顿 10秒~5分钟，直接忽略这部分时间，防止倒计时突跳
            return

        if self.phase == 'sedentary':'''

app = app.replace(old_tick, new_tick)

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(app)

print("Patched backend/main.py")
