# 玻璃引擎性能优化（2026-09-25）

本次修改集中在 `js/liquid-glass.js`，保留局部像素坐标、每元素独立滤镜、
内部透镜和拖动时的单路折射。页面、壁纸和已有布局数据不需要迁移。

## 修改与验证

- 内部像素的边缘权重为零时，跳过四次 SDF 采样及法线归一化。
  8 组卡片尺寸、圆角和材质参数的 RGBA 哈希与修改前逐字节一致。
- 贴图采用容量为 60 的 LRU 缓存，超限时只淘汰最久未访问的一张。
  色散参数不再进入贴图缓存键，因为它只改变 SVG 滤镜链。
- `refresh()` 将元素收集延迟到渲染帧；同一帧的连续调用只扫描一次。
  `lite()` 仍同步切换材质，按所有权登记表保护尚未收集的新元素，
  已脱离文档的滤镜仍会回收。

基线源文件来自提交 `6f8abdf36976205d8e911766b3b3401e18785188`。
`tests/fixtures/glass-performance-baseline.json` 保存优化前的贴图哈希和数学调用数。

| 测量 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 8 组贴图的 Math.hypot 调用次数 | 839,898 | 364,823 |
| 同帧连续 20 次 refresh 的页面扫描次数 | 20 | 1 |
| Node VM 纯贴图生成中位耗时，9 轮 | 360.2 ms | 177.6 ms |
| Chrome 153 贴图生成中位耗时，包含 Canvas / PNG，15 轮 | 123.4 ms | 121.4 ms |

Node 基准不含 PNG 编码、布局或 GPU 合成，也受 VM 环境影响。
浏览器整段贴图生成只见小幅耗时下降，不能据此宣称页面或拖动快了一倍。
本次明确降低了数学调用、重复扫描，以及缓存命中时的贴图生成次数。

## 复测

```powershell
node --test tests/*.test.js
$glassBaseline = Join-Path $env:TEMP 'liquid-glass-6f8abdf.js'
git show 6f8abdf36976205d8e911766b3b3401e18785188:js/liquid-glass.js | Set-Content -Encoding utf8 $glassBaseline
node tests/benchmarks/glass-map.bench.js $glassBaseline
```

19 项自动测试通过。浏览器运行 `tests/browser/glass-sampling.probe.js`，
三个预设各自的完整和精简滤镜共 6 组检查通过，覆盖中心、内部折射、
分离邻居和实际重叠。独立浏览器检查确认连续刷新只扫描一次，
新卡片在扫描前切换 lite 不会误删其他滤镜，恢复时回到三路色散。

这些结果来自本地 Chrome 153 测试环境，尚未验证用户已加载的 Edge 扩展及其拖动帧率。
