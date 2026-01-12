/** Build gridTemplateRows: all rows are 1fr except spacerRow which is smaller */
export function buildGridTemplateRows(
  numRows: number,
  spacerRow?: number
): string {
  const rows: string[] = [];
  for (let i = 1; i <= numRows; i++) {
    rows.push(i === spacerRow ? '0.15fr' : '1fr');
  }
  return rows.join(' ');
}
