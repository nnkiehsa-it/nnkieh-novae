# Contributing / 貢獻

## 繁體中文

感謝你參與 Novae。送出 issue 或 pull request 前，請閱讀完整的[繁中貢獻指南](https://tavricccc.github.io/novae-website/docs/contributing.html)，其中包含環境建立、測試、安全回報、文件同步與 review 要求。

新增或調整前端頁面、共用元件與視覺 primitive 時，另請遵守本 repo 的 [`ui-design-system.md`](ui-design-system.md)。

- 一般前端／重構：`npm run verify:local`
- 後端 action、權限、RPC、migration、Worker、Queue 或 Durable Object：`npm run verify:integration`
- 大型變更／合併前：`npm run verify:all`

Windows 直接執行 npm 指令；整合驗證會透過 WSL 的 Docker 啟動隔離 PostgreSQL，並在 Windows 啟動 Worker、Firebase Auth Emulator 與測試程式。新增 action 或權限時必須同步補成功與拒絕案例；PR CI 與後端部署都會執行完整本地後端驗證。

## English

Thank you for contributing to Novae. Before opening an issue or pull request, read the complete [English contributing guide](https://tavricccc.github.io/novae-website/docs/en/contributing.html) for setup, verification, security reporting, documentation synchronization, and review expectations.

When adding or changing frontend pages, reusable components, or visual primitives, also follow this repository's [`ui-design-system.md`](ui-design-system.md).

- Frontend and ordinary refactors: `npm run verify:local`
- Backend actions, permissions, RPCs, migrations, Workers, Queues, or Durable Objects: `npm run verify:integration`
- Large changes and pre-merge handoff: `npm run verify:all`

On Windows, run the npm command normally. Integration verification uses Docker through WSL for isolated PostgreSQL and starts the Worker, Firebase Auth Emulator, and tests on Windows. New actions and permissions require asserted success and denial cases. PR CI and backend deployment run the full local backend suite.

All participation is subject to the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are submitted under the repository's [MIT License](LICENSE).
