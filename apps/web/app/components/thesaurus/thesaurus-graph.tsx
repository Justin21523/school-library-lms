'use client';

/**
 * ThesaurusGraph（Web）
 *
 * 你希望 thesaurus 不只「文字列表」，而是能：
 * - 看見樹狀/關係（視覺化）
 * - 點選節點快速切換（更像館員在「治理」而不是在「看 JSON」）
 *
 * 取捨（v1.1 的可演進版本）：
 * - 不引入外部圖形套件（避免 bundle 變重、也避免 force layout 難以重現/除錯）
 * - 改用後端提供的 `thesaurus/graph`（depth-limited）輸出：
 *   - 前端只做 deterministic layout（依 BFS layer 分欄、每欄垂直排列）
 *   - polyhierarchy（多重上位）時線會交錯，但仍可用於「治理/除錯/快速導航」
 *
 * 未來若你想要更漂亮/可拖曳的圖（D3/Cytoscape），
 * 可以保留此元件 API，將實作替換即可（後端輸出形狀不必改）。
 */

import type { ThesaurusGraphResult } from '../../lib/api';

type NodePos = { x: number; y: number; level: number };

export function ThesaurusGraph({
  graph,
  rootTermId,
  selectedTermId,
  onSelectTerm,
}: {
  graph: ThesaurusGraphResult;
  // rootTermId：圖的起點（通常是目前選取的 term）
  rootTermId: string;
  // selectedTermId：用於在圖上高亮目前選取節點（可跟 root 不同：例如點圖上的其他節點預覽）
  selectedTermId?: string | null;
  // onSelectTerm：點節點時回呼（讓外層決定要不要切換 selected/root）
  onSelectTerm?: (termId: string) => void;
}) {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  // 1) 建立 id → node map（方便 label/狀態存取）
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // 2) 依 direction 建 adjacency（我們希望「root 往右」展開）
  // - DB 的 broader relation 形狀：from=narrower, to=broader
  // - 若要看 narrower（往下位）：我們希望 parent→child，因此要反轉：to(broader) → from(narrower)
  // - 若要看 broader（往上位）：我們希望 child→parent，直接用：from(narrower) → to(broader)
  const nextById = new Map<string, string[]>();
  for (const e of edges) {
    const from = graph.direction === 'narrower' ? e.to_term_id : e.from_term_id;
    const to = graph.direction === 'narrower' ? e.from_term_id : e.to_term_id;
    if (!from || !to) continue;
    const arr = nextById.get(from);
    if (arr) arr.push(to);
    else nextById.set(from, [to]);
  }

  // 3) BFS：rootTermId 往外算 level（最短距離）
  const levelById = new Map<string, number>();
  const queue: string[] = [];
  levelById.set(rootTermId, 0);
  queue.push(rootTermId);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const level = levelById.get(id) ?? 0;
    const next = nextById.get(id) ?? [];
    for (const nid of next) {
      if (levelById.has(nid)) continue;
      levelById.set(nid, level + 1);
      queue.push(nid);
    }
  }

  // 4) 把 nodes 分桶到 level（未連到 root 的 node 仍顯示在最後一欄，避免「API 回了但 UI 消失」）
  const maxConnectedLevel = Math.max(0, ...Array.from(levelById.values()));
  const levels: Array<{ level: number; ids: string[] }> = [];
  const idsByLevel = new Map<number, string[]>();
  for (const n of nodes) {
    const level = levelById.get(n.id) ?? maxConnectedLevel + 1;
    const arr = idsByLevel.get(level);
    if (arr) arr.push(n.id);
    else idsByLevel.set(level, [n.id]);
  }

  const sortedLevels = Array.from(idsByLevel.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, ids]) => ({
      level,
      // 讓 layout 穩定可預期：同一欄依 label 排序
      ids: ids.sort((a, b) => {
        const la = nodeById.get(a)?.preferred_label ?? a;
        const lb = nodeById.get(b)?.preferred_label ?? b;
        return la.localeCompare(lb);
      }),
    }));
  levels.push(...sortedLevels);

  // 5) 計算每個 node 的 (x,y)
  const margin = 16;
  const nodeW = 190;
  const nodeH = 44;
  const colGap = 72;
  const rowGap = 14;

  const maxRows = Math.max(1, ...levels.map((l) => l.ids.length));
  const maxColHeight = maxRows * nodeH + (maxRows - 1) * rowGap;

  const posById = new Map<string, NodePos>();
  for (const col of levels) {
    const colIndex = col.level < 0 ? 0 : col.level;
    const x = margin + colIndex * (nodeW + colGap);
    const colHeight = col.ids.length * nodeH + Math.max(0, col.ids.length - 1) * rowGap;
    const startY = margin + Math.max(0, Math.floor((maxColHeight - colHeight) / 2));

    col.ids.forEach((id, rowIndex) => {
      const y = startY + rowIndex * (nodeH + rowGap);
      posById.set(id, { x, y, level: col.level });
    });
  }

  const maxLevel = Math.max(0, ...levels.map((l) => l.level));
  const svgW = margin * 2 + (maxLevel + 1) * nodeW + maxLevel * colGap;
  const svgH = margin * 2 + maxColHeight;

  // 6) helpers：文字縮短（避免 SVG text 溢出）
  function shortLabel(value: string) {
    const trimmed = (value ?? '').trim();
    if (trimmed.length <= 14) return trimmed;
    return `${trimmed.slice(0, 13)}…`;
  }

  // 7) edges：畫線（只畫在 posById 找得到的）
  const orientedEdges = edges
    .map((e) => {
      const from = graph.direction === 'narrower' ? e.to_term_id : e.from_term_id;
      const to = graph.direction === 'narrower' ? e.from_term_id : e.to_term_id;
      return { relation_id: e.relation_id, from, to };
    })
    .filter((e) => posById.has(e.from) && posById.has(e.to));

  return (
    <div className="callout" style={{ overflowX: 'auto' }}>
      <div className="muted" style={{ marginBottom: 8 }}>
        graph：direction=<code>{graph.direction}</code> · depth=<code>{graph.depth}</code> · nodes=
        <code>{graph.nodes.length}</code> · edges=<code>{graph.edges.length}</code>
        {graph.truncated ? <span> ·（已截斷）</span> : null}
      </div>

      <svg width={svgW} height={svgH} role="img" aria-label="Thesaurus graph">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.35)" />
          </marker>
        </defs>

        {/* edges：先畫線，避免蓋住 node */}
        {orientedEdges.map((e) => {
          const fromPos = posById.get(e.from)!;
          const toPos = posById.get(e.to)!;

          const x1 = fromPos.x + nodeW;
          const y1 = fromPos.y + nodeH / 2;
          const x2 = toPos.x;
          const y2 = toPos.y + nodeH / 2;

          // 用 cubic curve 讓線看起來比較柔和（也比較不會完全重疊）
          const dx = Math.max(40, Math.floor((x2 - x1) / 2));
          const c1x = x1 + dx;
          const c2x = x2 - dx;
          const d = `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;

          return (
            <path
              key={e.relation_id}
              d={d}
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1.2}
              markerEnd="url(#arrow)"
            />
          );
        })}

        {/* nodes */}
        {nodes.map((n) => {
          const p = posById.get(n.id);
          if (!p) return null;

          const isRoot = n.id === rootTermId;
          const isSelected = Boolean(selectedTermId && n.id === selectedTermId);
          const isInactive = n.status === 'inactive';

          const fill = isSelected ? 'rgba(123,177,255,0.18)' : 'rgba(255,255,255,0.04)';
          const stroke = isRoot ? 'rgba(123,177,255,0.8)' : isSelected ? 'rgba(123,177,255,0.6)' : 'rgba(255,255,255,0.16)';

          return (
            <g
              key={n.id}
              transform={`translate(${p.x}, ${p.y})`}
              onClick={() => onSelectTerm?.(n.id)}
              style={{ cursor: onSelectTerm ? 'pointer' : 'default' }}
            >
              <title>
                {n.preferred_label}（{n.vocabulary_code} / {n.status}）
              </title>
              <rect x={0} y={0} width={nodeW} height={nodeH} rx={10} ry={10} fill={fill} stroke={stroke} />

              {/* label */}
              <text
                x={12}
                y={18}
                fill={isInactive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)'}
                fontSize={13}
              >
                {shortLabel(n.preferred_label)}
              </text>

              {/* meta：vocab/status */}
              <text x={12} y={34} fill="rgba(255,255,255,0.55)" fontSize={11}>
                {n.vocabulary_code} · {n.status}
              </text>

              {/* root badge */}
              {isRoot ? (
                <text x={nodeW - 12} y={18} fill="rgba(123,177,255,0.95)" fontSize={12} textAnchor="end">
                  ROOT
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

