# 本版修复（BUGFIX）0.14.0 → 0.14.1

## 标题

细步长 slider 的数值读数与提交值不一致（上游 issue [#352](https://github.com/omdsh-dev/dsh-genui/issues/352)）：读数写死两位小数取整，步长细于 0.01 时显示值与实际提交字段不符。

## 证据链

- 上游 `src/client/blocks/forms.tsx` 的 `SliderNode` 读数渲染为 `{Math.round(value * 100) / 100}`，而字段登记（mount/change 时 `answers.setField(id, String(v))`）与 action 载荷都保留数值原值；schema 允许细至 1e-9 的步长，两条路径必然分叉。
- 新增回归测试 `tests/genui-slider-readout.spec.tsx`（走真实 `repairGenuiSpec → GenuiBlock → submit` 组件路径）在未修复代码上 4/5 失败：
  - 初始值 `value=0.004, step=0.001`：读数显示 `0`（应为 `0.004`），提交字段为 `"0.004"`；
  - 拖动到 `0.006`：读数显示 `0.01`，提交字段为 `"0.006"`；
  - 负值 `-0.004`：读数显示 `0`；
  - `step=1e-9, value=3e-9`：读数显示 `0`。
  - 整数与两位小数用例在修复前即通过（基线行为，须保持不变）。
- 修复后上述测试 5/5 通过。

## 根因

读数格式化与数值真源脱钩：渲染层用固定的两位小数口径 `Math.round(value * 100) / 100` 截断，而提交路径不做任何取整。步长越细，显示与实际提交的偏差越大，且小数值被直接显示为 0，确认参数的用户无从核对真实提交值。

## 改动文件

- `src/client/blocks/forms.tsx`（唯一产品代码改动）：
  - 读数改为 `formatChartValue(value, Math.max(fractionDigits(node.step ?? 1), fractionDigits(value)))`，复用 `src/client/blocks/charts.tsx` 已有的精度格式化工具（图表家族同口径）：按步长精度显示，值本身携带更多小数位时以值为准，保证读数在数值上恒等于当前 range 值与提交字段。
  - 整数步长与两位小数步长的显示与旧版一致；极小值显示为普通十进制（如 `0.000000003`），不再被归零。
- `tests/genui-slider-readout.spec.tsx`：新增回归测试（issue 场景原文：初始值、拖动后与 submit 字段对齐、负值、1e-9 步长、整数/两位小数不回归）。
- `package.json`：version `0.14.0 → 0.14.1`，repository.url 指向本修复版仓库；其余字段未动。
- `README.md`：顶部追加 fork 说明，上游原文未删改。
- `LICENSE`：原样保留，未修改。

## 复验结果

- 复现/回归测试：`tests/genui-slider-readout.spec.tsx` 修复前 4 失败 1 通过 → 修复后 5/5 通过。
- 相关既有套件（slider/submit/debounce/teach）：`genui-v29`、`genui-submit-members`、`genui-debounce`、`genui-debounce-handler`、`genui-teach` 共 88 个测试，修复前后均全部通过。
- 全量测试（修复后）：`vitest run` 110 个测试文件、1463 个测试全部通过；`pnpm build`（tsc 类型检查 + tsdown 打包）通过。
- 基线对照：修复前全量运行曾被环境 ENOSPC（磁盘瞬时写满）中断，已执行完成的 623 个测试无一失败，`tsc` 干净；与本修复相关的套件已在修复前单独跑通（88/88），修复后同一口径全绿，无回归。未使用 git stash 对照的原因：修复后全量零失败，不存在需要归因的失败项。

## 边界

- 只修 form 家族 slider（issue #352 的范围）；`PlotBlock` 的参数 slider 读数存在同样的两位小数写法，但不属于表单提交路径、不在该 issue 范围内，本版未动。
- 未改 schema、步长语义、action/防抖与提交字段语义；仅读数显示口径变化。
- 验证在 Vitest/jsdom 下完成（与上游 issue 的复现口径一致），未做真实浏览器/宿主验收。
