# 策略配置与回测架构说明

## 目标

在 `analysis.html / analysis.js` 中提供可配置策略与可视化回测，覆盖：

- 策略参数配置（指标/突破/组合）
- 回测执行参数（周期、仓位、止损止盈、交易成本）
- 异步回测与进度反馈
- 结果输出（收益曲线、关键指标、交易明细）

## 模块划分

1. 策略定义层（`STRATEGY_PRESETS`）
- `hybrid`：MA + MACD + RSI 组合策略
- `ma_cross`：双均线交叉
- `macd_cross`：MACD 金叉死叉
- `rsi_reversion`：RSI 均值回归
- `price_breakout`：价格突破/跌破策略

2. 执行参数层（`EXECUTION_CONFIG_FIELDS`）
- `timeframe`：日/周/月
- `positionSizePct`：单次仓位
- `maxHoldBars`：最大持仓周期
- `stopLossPct / takeProfitPct`：风控阈值
- `feeBps / slippageBps`：交易成本

3. 数据处理层
- `resampleBarsByTimeframe`：日线聚合为周/月
- `computeIndicatorSeries`：指标计算（MA/MACD/RSI）
- `buildStrategySeries`：策略判定序列（含突破窗口）

4. 回测引擎层
- `runBacktest`：异步执行交易仿真
- 支持买卖信号、风险离场、成本扣减、权益曲线与指标统计
- 通过 `yieldToUi` + 进度回调避免长任务阻塞页面

5. 展示层
- `renderStrategyControls`：策略与执行参数表单渲染
- `renderBacktest`：关键指标、曲线、持仓分析、交易表格
- `buildBacktestCurveSvg`：策略净值 vs 基准净值

## 兼容性策略

- 仍使用原有存储键：`analysis_strategy_config_v1`
- `sanitizeStrategyConfig` 对旧结构自动补齐 `execution` 默认参数
- 保留原有 `analysis` 页面入口与导出流程

## 可扩展方向

- 多策略并行对比（同标的同区间）
- 组合仓位（多资产/多头寸）
- 更真实撮合模型（下一根开盘成交、分笔滑点）
- 参数网格搜索与结果排序
