---
name: generate-operator-logic
description: Use when the user provides a description of an Arknights operator's damage calculation logic and wants you to generate or adjust their Python code script. This skill enforces the strict rules for damage calculation, class inheritance, and variable naming conventions required by the engine.
---

# 🎯 Objective

You are an expert Arknights DPS calculation developer. Your task is to generate or adjust the Python logic script for an individual operator based on the user's natural language description, adhering strictly to the architecture of the `CupCalculation` backend.

# 📐 Code Architecture Rules

## 1. Class and File Naming

- 继承：干员类必须继承自对应的职业基类，从 `backend.function.logic.professions` 导入。
- 命名：类名格式为 `Id中文名`，例如 `class Aa00乌尔比安(Crusher):`。

## 2. Constructor (`__init__`)

必须重写 `__init__` 方法：

```python
def __init__(self, data: dict):
    super().__init__(data)
    # 必须提取信赖属性并加到基础面板上（如攻击力）
    self.trust_atk = self.raw_data.get("confidence_atk", 0)
    self.final_base_atk = self.base_atk + self.trust_atk
    
    # 必须调用天赋应用方法
    self.apply_talents()
```

## 3. Talents (`apply_talents`)

在这里处理天赋带来的静态增益：

- 对于击杀叠加、攻击叠加类的天赋，**一律按满层（最大收益）计算**。
- 将天赋提供的属性直接加到 `self.final_base_atk`、`self.attack_speed`、`self.base_def` 等属性上。
- 生存向、无DPS收益的天赋（如回血、加生命上限），只写注释说明，不修改属性。

## 4. Damage Calculation (`calculate_skill_damage`)

必须重写该方法以处理各个技能的伤害，格式如下：

```python
def calculate_skill_damage(self, enemy, skill_index: int, target_count: int = 1) -> dict:
    actual_atk_interval = self.attack_interval * 100 / self.attack_speed
    
    if skill_index == 0:  # 1技能
        # ... logic ...
    elif skill_index == 1: # 2技能
        # ... logic ...
    elif skill_index == 2: # 3技能
        # ... logic ...
        
    return super().calculate_skill_damage(enemy, skill_index, target_count)
```

# ⚠️ CRITICAL ENGINE RULES (MUST FOLLOW)

1. **单目标原则（最重要）**：无论干员是群攻职业，还是技能描述说明“对周围所有敌人造成伤害”、“额外攻击2个目标”，`calculate_skill_damage` 返回的 `total_damage` 和 `dps` **必须严格是对单个敌人造成的伤害！** 绝对不允许将最终伤害乘以目标数。
2. **底层公式调用**：计算最终物理/法术伤害时，**必须且只能**调用 `formulas.py` 中的方法：
   - `from backend.function.logic.formulas import calculate_physical_damage, calculate_arts_damage`
   - 物理：`calculate_physical_damage(atk_val, enemy.current_def)`
   - 法术：`calculate_arts_damage(atk_val, enemy.current_res)`
3. **先计算面板，后计算倍率**：如果技能描述为“攻击力+X%，造成相当于攻击力Y%的伤害”，必须先计算自身面板加成（`self.final_base_atk * (1 + X%)`），再将该结果乘以技能倍率 `Y%`，最后投入到底层公式中计算减伤。
4. **返回值格式**：
   - 瞬发技能：计算出单次 `total_damage`，`dps = total_damage / actual_atk_interval`。
   - 持续性技能：`total_damage` 为技能持续期间的普攻或连击总伤害，`dps = total_damage / duration`。
   - 永续技能：`total_damage = 0.0`，`dps` 按照强化后的单次普攻伤害除以攻击间隔计算。

# 📄 Reference Example

当你生成代码时，可以参考库中已有的 `aa00_乌尔比安.py` 的结构作为蓝本。不要引入不存在的基类方法，不要覆盖不需要修改的方法。
