# 预警引擎架构（Phase 3）

## 1. 目标

- 在现有实时行情与技术指标链路上新增规则化预警。
- 通知以工作流方式呈现，不使用打断式弹窗。
- 支持规则冷却、低功耗监控和历史可追溯。

## 2. 组件划分

### 2.1 数据层

- `cards`：原有卡片数据（股票/HN/Quote）。
- `alertEngine`：新增全局预警状态。
  - `enabled`：总开关
  - `silentMode`：静默模式开关
  - `lowPowerMode`：低功耗监控开关
  - `soundEnabled / vibrationEnabled`：可选反馈
  - `rules[]`：规则集合
  - `history[]`：历史触发记录
  - `totalTriggered`：累计触发计数

### 2.2 规则模型

每条规则统一结构：

```js
{
  id,
  cardId,
  type,        // price | change | ma_breakout | macd_cross | rsi_zone
  enabled,
  cooldownMs,
  params,
  lastTriggeredAt,
  createdAt
}
```

### 2.3 触发引擎

- 入口：`refreshStockCardData()` 每次刷新后。
- 输入：刷新前后 `quote` 与 `technicals` 快照。
- 处理：
  1. 过滤目标卡片对应启用规则
  2. 执行类型化匹配（价格/涨跌幅/MA/MACD/RSI）
  3. 应用冷却时间去重
  4. 写入历史、更新统计
- 输出：工作通知流（历史列表）+ 可选声音/震动。

### 2.4 管理界面

工作通知中心包含：

- 规则配置表单
- 规则列表（启停/删除）
- 历史记录
- 统计看板
- 一键启用/禁用

## 3. 持久化策略

- 本地：`localStorage`
  - `stock_dashboard_cards_v1`
  - `stock_dashboard_alert_engine_v1`
- 远端：`POST /api/state` 同步 `{ cards, alerts }`
- 兼容策略：
  - 旧状态（仅 cards）自动补齐 alerts 默认结构
  - 规则会在加载时做归一化和无效引用清理

## 4. 隐蔽性设计

- 默认静默，不弹窗。
- 通知以“工作通知中心”内流式记录展现。
- 支持声音/震动可选反馈。
- 低功耗模式下延长规则扫描间隔，降低监控负载。
