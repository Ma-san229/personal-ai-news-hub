# knowledge-agent（取り込んだ資産）

mametech-news の `feat/skeleton`（89c8a57）から取り込みました。同じ所有者の自作で、本文は変更していません。

- `prompts/`: プロンプトの正本。コードやActionsに本文を埋めない。
- `schemas/`: 出力の契約。検証に失敗したら1回だけ再生成する。

X収集（morning-collect）とバズ計算（daily-buzz）は、Cloudflare D1が前提のため未使用です。使う時は段階5で設計し直します。
