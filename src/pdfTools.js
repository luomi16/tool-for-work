import { PDFDocument } from 'pdf-lib';

export const pdfKinds = [
  { key: 'llc', label: 'Limited Liability Company Agreement', short: 'LLC 协议' },
  { key: 'ppm', label: 'Private Placement Memorandum', short: 'PPM' },
  { key: 'regd', label: 'Subscription Agreement_Reg. D', short: 'Reg. D 认购协议' },
  { key: 'regs', label: 'Subscription Agreement_Reg. S', short: 'Reg. S 认购协议' },
];

export function identifyPdf(name) {
  const match = /^CF\s+(\d+)\s+Fund\s+(.+)\.pdf$/i.exec(name.trim());
  if (!match) throw new Error(`无法识别文件名：${name}。请保留 CF 编号 Fund 的原始文件名。`);
  const title = match[2].replace(/[_\s]+/g, ' ').trim();
  const patterns = {
    llc: /^Limited Liability Company Agreement$/i,
    ppm: /^Private Placement Memorandum$/i,
    regd: /^Subscription Agreement Reg\.?\s*D$/i,
    regs: /^Subscription Agreement Reg\.?\s*S$/i,
  };
  const kind = Object.keys(patterns).find(key => patterns[key].test(title));
  if (!kind) throw new Error(`文件类型不匹配：${name}。请选择指定的四类 PDF。`);
  return { number: match[1], kind };
}

export async function readPdfFiles(files) {
  if (files.length !== 4) throw new Error('请一次选择四个 PDF：LLC、PPM、Reg. D 和 Reg. S。');
  if (files.reduce((sum, file) => sum + file.size, 0) > 160 * 1024 * 1024) throw new Error('四个文件总大小须小于 160 MB。');
  const items = {};
  let number;
  for (const file of files) {
    const identity = identifyPdf(file.name);
    if (number !== undefined && number !== identity.number) throw new Error('四个文件的基金编号不一致，请选择同一基金的文件。');
    number = identity.number;
    if (items[identity.kind]) throw new Error(`重复的文件类型：${file.name}。每类只能选择一份。`);
    let doc;
    const bytes = new Uint8Array(await file.arrayBuffer());
    try { doc = await PDFDocument.load(bytes, { updateMetadata: false }); }
    catch { throw new Error(`无法读取 ${file.name}，请检查文件是否损坏或受密码保护。`); }
    if (!doc.getPageCount()) throw new Error(`${file.name} 没有可用页面。`);
    items[identity.kind] = { file, bytes, doc, pages: doc.getPageCount() };
  }
  return { number, items };
}

export function validatePdfSet(set) {
  const { items } = set;
  const count = items.llc.pages + items.ppm.pages;
  if (count !== 100) throw new Error(`LLC + PPM 实际共 ${count} 页，与要求的 100 页不符。请核对原文件；工具不会删页或补白页。`);
  if (items.regd.pages < 8) throw new Error('Reg. D 不足 8 页，无法保留预期的第 8 页签名页。');
  if (items.regs.pages < 9) throw new Error('Reg. S 不足 9 页，无法保留预期的第 9 页签名页。');
}

export async function buildPdfPackage(set) {
  validatePdfSet(set);
  const { number, items } = set;
  // Work on copies so the two renamed subscription files remain byte-for-byte original.
  const docs = {};
  for (const { key } of pdfKinds) {
    const doc = await PDFDocument.load(items[key].bytes, { updateMetadata: false });
    const form = doc.getForm();
    if (form.hasXFA()) throw new Error(`${items[key].file.name} 使用 XFA 表单，暂不支持合并。`);
    if (form.getFields().length) {
      try { form.flatten(); }
      catch { throw new Error(`${items[key].file.name} 的表单外观无法保留，请先将该文件另存为普通 PDF。`); }
    }
    docs[key] = doc;
  }
  async function merge(keys) {
    const dest = await PDFDocument.create();
    for (const key of keys) {
      const pages = await dest.copyPages(docs[key], docs[key].getPageIndices());
      pages.forEach(page => dest.addPage(page));
    }
    return dest.save();
  }
  return [
    { name: `oper_agr_${number}.pdf`, bytes: await merge(['llc', 'ppm']), pages: 100 },
    { name: `${number}_sign_doc_regs.pdf`, bytes: await merge(['regs', 'llc', 'ppm']), pages: items.regs.pages + 100, signaturePage: 9 },
    { name: `${number}_sign_doc_regd.pdf`, bytes: await merge(['regd', 'llc', 'ppm']), pages: items.regd.pages + 100, signaturePage: 8 },
    { name: `subagree_${number}us.pdf`, bytes: items.regd.bytes, pages: items.regd.pages },
    { name: `subagree_${number}nonus.pdf`, bytes: items.regs.bytes, pages: items.regs.pages },
  ];
}
