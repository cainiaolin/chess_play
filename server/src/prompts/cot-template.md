# 思维链输出格式规范

你必须严格按照以下五段式结构进行思考并输出。这是强制要求，违反格式将导致你的走法被拒绝。

---

## 输出模板

你的回答必须且只能包含一个 JSON 代码块（用 ```json 包裹），结构如下：

```json
{
  "step1_threats": {
    "my_king_in_check": false,
    "my_threatened_pieces": [
      {"piece": "马", "position": {"x": 7, "y": 0}, "attacked_by": "车", "value_lost": 4.0}
    ],
    "opponent_threats": "简述对方正在威胁什么（如：对方车正捉我方无根马）"
  },
  "step2_opportunities": {
    "immediate_captures": [
      {"my_piece": "车", "from": {"x": 0, "y": 0}, "target": {"x": 0, "y": 4}, "capture": "卒", "net_gain": 1.0, "safe": true}
    ],
    "check_opportunities": "是否有将军或杀棋机会，若无写'无'",
    "tactical_patterns": "识别到的战术机会（牵制/双击/闪击等），若无写'无'"
  },
  "step3_candidates": [
    {"from": {"x": 1, "y": 7}, "to": {"x": 1, "y": 5}, "description": "炮二平五，中炮直击中卒", "expected_gain": 0.5}
  ],
  "step4_evaluation": {
    "best_candidate_index": 0,
    "reasoning": "详细推理：为何选择这步？考虑了哪些风险？对方最强应着是什么？我如何应对？",
    "safety_check": {
      "leaves_king_in_check": false,
      "gives_up_undefended_piece": false,
      "missed_free_capture": false
    }
  },
  "step5_decision": {
    "from": {"x": 1, "y": 7},
    "to": {"x": 4, "y": 7},
    "move_type": "横向",
    "coord_check": "炮(1,7)→(4,7): dx=3,dy=0 → 直线移动(横向), 起止间无子, 合法"
  }
}
```

---

## 各字段说明

### step1_threats（威胁识别）
先看清自身处境，这是思考的起点：
- `my_king_in_check`：我方将帅是否正被将军（若是，必须应将，这是最高优先级）
- `my_threatened_pieces`：我方所有被攻击且可能丢失的棋子，列出棋子、位置、被谁攻击、潜在损失价值
- `opponent_threats`：用一句话概括对方的主要意图

### step2_opportunities（机会识别）
扫描棋盘上所有可利用的机会：
- `immediate_captures`：所有可以直接吃子的走法，标注净收益和是否安全（吃后不被反吃）
- `check_opportunities`：将军、杀棋机会
- `tactical_patterns`：识别到的中局战术（牵制/双击/闪击/引离等）

### step3_candidates（候选走法）
列出 2-5 个最有价值的候选走法，至少包含：
- 最优的进攻/吃子走法
- 必要的防守走法（若有威胁）
- 符合开局/中局/残局原则的发展性走法
每个候选标注 `expected_gain`（预期收益估值）

### step4_evaluation（深度评估）
这是最关键的一步，必须认真推理：
- `best_candidate_index`：从 candidates 中选出的最优走法索引（从 0 开始）
- `reasoning`：完整推理链——为何选这步？对方最强应着是什么？我能应对吗？有没有更好的选择被忽略？
- `safety_check`：三个安全自检项必须全部填 false：
  - `leaves_king_in_check`：这步是否让我方继续被将军？
  - `gives_up_undefended_piece`：这步是否送出无根子（无补偿）？
  - `missed_free_capture`：这步是否错过了白吃子的机会？

### step5_decision（最终决策）
从评估中得出最终走法，坐标必须是合法且与候选一致。
- `move_type`：移动类型，"横向"（只变 x）、"纵向"（只变 y）或"斜向"（x、y 都变）
- `coord_check`：**必须显式写出坐标核对**。横向→`from.y==to.y`；纵向→`from.x==to.x`。核对不通过的走法禁止输出。

---

## 强制规则

1. **必须输出完整五段**，任何一段缺失或为空都视为失败。
2. **所有坐标必须合法**：x ∈ [0,8]，y ∈ [0,9]，from 位置必须有己方棋子，to 位置不能是己方棋子。
3. **走法必须符合该棋子的移动规则**（马的日字、炮的隔子、象的田字、士的斜线、兵的方向等）。
4. **坐标移动硬约束**（违反即为非法走法）：
   - 车移动：必须 `from.x==to.x`（纵向）或 `from.y==to.y`（横向），二者居其一。
   - 炮移动：同车，且吃子时起止间恰好 1 个棋子。
   - 兵卒移动：未过河只能纵向进一格；过河后可纵向进一格或横向一格。
   - 马象士：斜向，按各自规则。
5. **coord_check 必须按 from 位置棋子的类型做对应验证**（填入实际数字，机械写"纵向/横向"不算）：
   - **马**：必须 `(|dx|,|dy|)` 为 `(1,2)` 或 `(2,1)`，否则不是日字！例 `马(7,0)→(6,2): |dx|=1,|dy|=2 → 日字合法`。若算出 `(0,2)` 则是纵向，**马不能走纵向，非法**。
   - **车**：`dx=0`(纵向) 或 `dy=0`(横向)，且起止间无子。
   - **炮**：同车；吃子时起止间恰好 1 子。
   - **兵/卒**：未过河只能 `|dy|=1 且 dx=0`（朝敌方方向）；过河后可 `|dy|=1 且 dx=0` 或 `dy=0 且 |dx|=1`。
   - **相/象**：`|dx|=2 且 |dy|=2`（田字），中心无子，不过河。
   - **仕/士**：`|dx|=1 且 |dy|=1`，九宫内。
   - **帅/将**：`(|dx|=1,dy=0)` 或 `(dx=0,|dy|=1)`，九宫内。
   若 coord_check 算出的结果不符合该棋子类型，**说明坐标错了，必须重新选走法**。
6. **safety_check 三项必须全部为 false**，若任一为 true 必须重新选择走法。
7. **decision 的走法必须等于 evaluation 选出的 best_candidate**。
8. **JSON 必须严格合法**：无注释、无尾逗号、字符串用双引号。
9. **只输出 JSON 代码块**，不要输出任何 JSON 之外的解释文字。
