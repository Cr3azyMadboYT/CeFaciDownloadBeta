export type SafeQrNode = { tag: 'svg' | 'g' | 'path' | 'rect'; attributes: Record<string, string>; children: SafeQrNode[] };

/** Reconstruct geometry only. No HTML injection, events, URLs, scripts or SVG foreign objects. */
export function safeQrGeometry(source: string): SafeQrNode | null {
  let svg = source;
  if (svg.startsWith('data:image/svg+xml;utf-8,')) svg = svg.slice('data:image/svg+xml;utf-8,'.length);
  if (svg.length > 250_000 || /<!|&|<\?|\b(?:script|foreignObject)\b/i.test(svg)) return null;
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') return null;
  let nodes = 0;
  function visit(element: Element, depth: number): SafeQrNode | null {
    if (++nodes > 500 || depth > 5 || !['svg', 'g', 'path', 'rect'].includes(element.localName)) return null;
    const attributes: Record<string, string> = {};
    for (const attribute of Array.from(element.attributes)) {
      const { name, value } = attribute;
      if (name === 'xmlns' && element.localName === 'svg') {
        if (value !== 'http://www.w3.org/2000/svg') return null;
        continue;
      }
      if (['fill', 'stroke'].includes(name)) {
        if (!/^(?:#[0-9a-f]{3,8}|black|white|none)$/i.test(value)) return null;
      } else if (name === 'd') {
        if (value.length > 200_000 || !/^[MmZzLlHhVvCcSsQqTtAaEe0-9+.,\s-]+$/.test(value)) return null;
      } else if (name === 'viewBox') {
        if (!/^\s*-?[\d.]+(?:[ ,]+-?[\d.]+){3}\s*$/.test(value)) return null;
      } else if (['width', 'height', 'x', 'y', 'rx', 'ry', 'stroke-width', 'opacity'].includes(name)) {
        if (!/^\d+(?:\.\d+)?$/.test(value) || Number(value) > 10_000) return null;
      } else return null;
      attributes[name === 'stroke-width' ? 'strokeWidth' : name] = value;
    }
    const children: SafeQrNode[] = [];
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 3 && !child.textContent?.trim()) continue;
      if (child.nodeType !== 1) return null;
      const safe = visit(child as Element, depth + 1);
      if (!safe) return null;
      children.push(safe);
    }
    return { tag: element.localName as SafeQrNode['tag'], attributes, children };
  }
  const root = visit(doc.documentElement, 0);
  if (!root) return null;
  if (!root.attributes.viewBox) {
    const width = Number(root.attributes.width), height = Number(root.attributes.height);
    if (!width || !height) return null;
    root.attributes.viewBox = `0 0 ${width} ${height}`;
  }
  root.attributes.width = '220'; root.attributes.height = '220';
  return root;
}
