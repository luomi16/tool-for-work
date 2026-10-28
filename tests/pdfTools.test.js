import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees } from 'pdf-lib';
import { identifyPdf, readPdfFiles, validatePdfSet, buildPdfPackage } from '../src/pdfTools.js';

const titles = ['Limited Liability Company Agreement', 'Private Placement Memorandum', 'Subscription Agreement_Reg. D', 'Subscription Agreement_Reg. S'];
async function makeFiles(number = '624', counts = [40, 60, 12, 13]) {
  const files = [];
  for (let kind = 0; kind < 4; kind++) {
    const doc = await PDFDocument.create();
    for (let page = 0; page < counts[kind]; page++) {
      const p = doc.addPage([601 + kind, 800 + page]);
      p.drawText(`Source ${kind}, page ${page + 1}`);
      if (kind === 0 && page === 0) p.setRotation(degrees(90));
    }
    if (kind === 2 && counts[kind]) {
      const field = doc.getForm().createTextField('investor');
      field.setText('Investor Alice');
      field.addToPage(doc.getPage(0), { x: 10, y: 10, width: 150, height: 20 });
    }
    files.push(new File([await doc.save()], `CF ${number} Fund ${titles[kind]}.pdf`, { type: 'application/pdf' }));
  }
  return files;
}

test('recognizes original file names and preserves numeric identifier including leading zeroes', () => {
  assert.deepEqual(identifyPdf('CF 00624 Fund Subscription Agreement_Reg. D.pdf'), { number: '00624', kind: 'regd' });
  assert.deepEqual(identifyPdf('cf 624 fund Subscription Agreement_Reg.S.PDF'), { number: '624', kind: 'regs' });
  assert.throws(() => identifyPdf('624-random.pdf'), /无法识别/);
  assert.throws(() => identifyPdf('CF 624 Fund other.pdf'), /文件类型/);
});

test('generates all five PDFs in exact order, preserves page properties and original renamed bytes', async () => {
  const original = await makeFiles();
  const set = await readPdfFiles([original[3], original[1], original[0], original[2]]);
  const output = await buildPdfPackage(set);
  assert.deepEqual(output.map(file => file.name), ['oper_agr_624.pdf', '624_sign_doc_regs.pdf', '624_sign_doc_regd.pdf', 'subagree_624us.pdf', 'subagree_624nonus.pdf']);
  const expected = [
    [[0, 40], [1, 60]],
    [[3, 13], [0, 40], [1, 60]],
    [[2, 12], [0, 40], [1, 60]],
  ];
  for (let index = 0; index < 3; index++) {
    const doc = await PDFDocument.load(output[index].bytes);
    assert.equal(doc.getPageCount(), output[index].pages);
    assert.equal(doc.getForm().getFields().length, 0);
    let position = 0;
    for (const [kind, count] of expected[index]) {
      for (let page = 0; page < count; page++) {
        const actual = doc.getPage(position++);
        assert.equal(actual.getWidth(), 601 + kind);
        assert.equal(actual.getHeight(), 800 + page);
        assert.equal(actual.getRotation().angle, kind === 0 && page === 0 ? 90 : 0);
      }
    }
  }
  assert.equal(output[1].signaturePage, 9);
  assert.equal(output[2].signaturePage, 8);
  assert.deepEqual(output[3].bytes, new Uint8Array(await original[2].arrayBuffer()));
  assert.deepEqual(output[4].bytes, new Uint8Array(await original[3].arrayBuffer()));
  assert.equal((await PDFDocument.load(output[3].bytes)).getForm().getFields().length, 1);
});

test('rejects missing, duplicate, inconsistent, corrupt and oversize input files', async () => {
  const files = await makeFiles();
  await assert.rejects(readPdfFiles(files.slice(1)), /四个/);
  await assert.rejects(readPdfFiles([files[0], files[0], files[2], files[3]]), /重复/);
  const other = new File([await files[3].arrayBuffer()], 'CF 999 Fund Subscription Agreement_Reg. S.pdf');
  await assert.rejects(readPdfFiles([files[0], files[1], files[2], other]), /编号不一致/);
  const corrupt = new File(['not a PDF'], files[0].name);
  await assert.rejects(readPdfFiles([corrupt, ...files.slice(1)]), /无法读取/);
  await assert.rejects(readPdfFiles(Array.from({ length: 4 }, () => ({ size: 50 * 1024 * 1024 }))), /160 MB/);
});

test('does not silently pad or truncate page counts or relocate signature pages', async () => {
  const mismatch = await readPdfFiles(await makeFiles('624', [40, 59, 12, 13]));
  assert.throws(() => validatePdfSet(mismatch), /99 页/);
  await assert.rejects(buildPdfPackage(mismatch), /99 页/);
  const shortD = await readPdfFiles(await makeFiles('624', [40, 60, 7, 13]));
  assert.throws(() => validatePdfSet(shortD), /Reg. D 不足 8 页/);
  const shortS = await readPdfFiles(await makeFiles('624', [40, 60, 12, 8]));
  assert.throws(() => validatePdfSet(shortS), /Reg. S 不足 9 页/);
});
