import { readFileSync } from 'node:fs';

/** A real content stream: logo, report title, body text and a table border. */
export function reportPdf(font: 'standard' | 'embedded' | 'cmap') {
  const content = Buffer.from([
    'q 1 0.8 0 rg 10 170 16 16 re f Q',
    '0 0 0 RG 10 15 180 130 re S',
    font === 'cmap'
      ? 'BT /F1 18 Tf 10 150 Td <004E0043004D002D003000300035003100320035> Tj ET'
      : 'BT /F1 18 Tf 10 150 Td (NCM-005125) Tj ET',
    font === 'cmap'
      ? 'BT /F1 12 Tf 20 100 Td <0052006500710075006500730074> Tj ET'
      : 'BT /F1 12 Tf 20 100 Td (Request total: 123.45) Tj ET',
  ].join('\n'));
  const stream = (data: Buffer, extra = '') => Buffer.concat([
    Buffer.from(`<< /Length ${data.length} ${extra} >>\nstream\n`), data, Buffer.from('\nendstream'),
  ]);
  const objects: (string | Buffer)[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    stream(content),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  if (font !== 'standard') {
    const name = font === 'cmap' ? 'LiberationSans' : 'KantumruyPro-Regular';
    const data = readFileSync(font === 'cmap'
      ? 'node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf'
      : 'assets/fonts/KantumruyPro-Regular.ttf');
    objects[4] = font === 'embedded'
      ? `<< /Type /Font /Subtype /TrueType /BaseFont /KantumruyPro-Regular /FirstChar 32 /LastChar 122 /Widths [${Array(91).fill(600).join(' ')}] /Encoding /WinAnsiEncoding /FontDescriptor 6 0 R >>`
      : `<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /UniJIS-UCS2-H /DescendantFonts [8 0 R] >>`;
    objects.push(
      `<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [-100 -300 1200 1100] /ItalicAngle 0 /Ascent 900 /Descent -250 /CapHeight 700 /StemV 80 /FontFile2 7 0 R >>`,
      stream(data, `/Length1 ${data.length}`),
    );
    if (font === 'cmap') {
      // Japan1 ASCII CIDs start at 1; Liberation Sans ASCII glyphs start at 3.
      const mapping = Buffer.alloc(96 * 2);
      for (let cid = 1; cid <= 95; cid++) mapping.writeUInt16BE(cid + 2, cid * 2);
      objects.push(
        `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 0 >> /FontDescriptor 6 0 R /DW 600 /CIDToGIDMap 9 0 R >>`,
        stream(mapping),
      );
    }
  }
  const chunks = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  let position = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(position);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), Buffer.from(object), Buffer.from('\nendobj\n')]);
    chunks.push(chunk);
    position += chunk.length;
  });
  chunks.push(Buffer.from(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF\n`));
  return Array.from(Buffer.concat(chunks));
}
