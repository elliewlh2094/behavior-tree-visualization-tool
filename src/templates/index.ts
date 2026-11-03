import { chaseTemplateJson } from './chase';

/** 一棵打包好的入門樹，使用者可以從登陸頁開啟。 */
export interface BTTemplate {
  /** 穩定的鍵，供 React 清單／選取使用。 */
  id: string;
  /** 顯示名稱；也決定載入後文件的檔名（`${name}.json`）。 */
  name: string;
  /** 範本卡片上的一行簡介。 */
  description: string;
  /** 序列化的 v2 BTDocument，透過標準的 deserialize 路徑載入。 */
  json: string;
}

// 只有 Chase 作為範本出貨：它已經以 SubTree 的形式內含 Patrol 樹，
// 所以另一張 Patrol 卡片是多餘的。
export const TEMPLATES: readonly BTTemplate[] = [
  {
    id: 'chase',
    name: 'Chase',
    description:
      'Pursue a visible target, otherwise fall back to a Patrol subtree — a Fallback priority tree with a SubTree reference.',
    json: chaseTemplateJson,
  },
];
