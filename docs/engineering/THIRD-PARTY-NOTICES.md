# 第三方资源与许可

本项目原创源码与文档采用根目录 [Apache License 2.0](../../LICENSE)。第三方资源及依赖保留各自的版权和许可，不因根目录许可证而重新授权。

## BodyParts3D 人体模型

- 文件：`3d-muscles/` 和 `public/models/bodyparts3d/` 中的 BodyParts3D 派生几何与对应来源元数据。
- 来源：[BodyParts3D](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D)，版本和 revision 见 [资产交付记录](../../3d-muscles/ASSET-DELIVERY.md)。
- 许可：[CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/)。这些几何资源不适用本项目的 Apache-2.0 源码许可。
- 署名：BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan.
- 修改：保留训练相关肌肉和皮肤，处理敏感区域、重命名与肌群映射、减面及 Draco GLB 导出；修改细节见 manifest、source map 和导出脚本。

## Draco 解码器

- 文件：`public/draco/draco_decoder.js`、`draco_wasm_wrapper.js`、`draco_decoder.wasm`。
- 来源：[Google Draco](https://github.com/google/draco)，用于加载压缩人体模型。
- Copyright 2016 The Draco Authors.
- 许可：[Apache License 2.0](../../public/draco/LICENSE)，随解码器一同保留。

## npm 依赖

依赖版本由 `package-lock.json` 固定，各依赖以其安装包所附许可证和版权声明为准；根目录的 Apache-2.0 不替换第三方包的条款。


## DeepSeek Harness 设置页品牌标识

`src/features/automation/DshMark.tsx` 的鲸鱼路径复用 [官方 FishLogo.tsx](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/client/ui-primitives/src/FishLogo.tsx)，保留路径与比例，使用主题文字色。标识仅用于说明本应用原生集成 DSH，不代表官方背书；参见[品牌使用规范](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/BRAND_GUIDELINES.md)。

上游许可证全文：

```text
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
