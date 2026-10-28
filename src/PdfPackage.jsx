import React, { useEffect, useRef, useState } from 'react';
import { zipSync } from 'fflate';
import { pdfKinds, readPdfFiles, validatePdfSet, buildPdfPackage } from './pdfTools';

export default function PdfPackage() {
  const [set, setSet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const operation = useRef(0);
  useEffect(() => () => { operation.current++; }, []);
  useEffect(() => () => { if (result) { result.files.forEach(file => URL.revokeObjectURL(file.url)); URL.revokeObjectURL(result.zip); } }, [result]);
  useEffect(() => () => { if (set) Object.values(set.items).forEach(item => URL.revokeObjectURL(item.url)); }, [set]);

  async function upload(files) {
    if (!files.length || busy) return;
    const token = ++operation.current;
    setBusy(true); setError(''); setResult(null); setSet(null);
    try {
      const parsed = await readPdfFiles(Array.from(files));
      if (token !== operation.current) return;
      Object.values(parsed.items).forEach(item => { item.url = URL.createObjectURL(item.file); });
      setSet(parsed);
      try { validatePdfSet(parsed); } catch (e) { setError(e.message); }
    } catch (e) { if (token === operation.current) setError(e.message); }
    finally { if (token === operation.current) setBusy(false); }
  }
  let validation = '';
  if (set) { try { validatePdfSet(set); } catch (e) { validation = e.message; } }
  async function generate() {
    if (!set || validation || busy) return;
    const token = ++operation.current;
    setBusy(true); setError('');
    const urls = [];
    try {
      const output = await buildPdfPackage(set);
      if (token !== operation.current) return;
      const entries = Object.fromEntries(output.map(file => [file.name, file.bytes]));
      const zipBytes = zipSync(entries, { level: 0 });
      const files = output.map(file => {
        const url = URL.createObjectURL(new Blob([file.bytes], { type: 'application/pdf' })); urls.push(url);
        return { ...file, url };
      });
      const zip = URL.createObjectURL(new Blob([zipBytes], { type: 'application/zip' })); urls.push(zip);
      setResult({ files, zip });
    } catch (e) { urls.forEach(url => URL.revokeObjectURL(url)); if (token === operation.current) setError(e.message || '生成失败，请重新尝试。'); }
    finally { if (token === operation.current) setBusy(false); }
  }
  return <>
    <div className="eyebrow">PDF WORKFLOW <span>03</span></div><h1>基金文件，一次备齐<span>。</span></h1><p className="intro">识别编号、按顺序合并、统一命名。四份原件，生成五份交付文件。</p>
    <div className="workspace pdf-workspace"><section className="image-panel"><div className="section-heading"><h2><span className="step">01</span> 选择四个 PDF</h2><span>本地处理</span></div>
      <input ref={input} className="file-input" aria-label="选择四个 PDF" type="file" accept=".pdf,application/pdf" multiple disabled={busy} onChange={e => { upload(e.target.files); e.target.value = ''; }}/>
      <button className={`drop-zone pdf-drop ${dragging ? 'dragging' : ''}`} disabled={busy} onClick={() => input.current.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}><div className="upload-icon">↥</div><strong>{busy ? '正在处理 PDF…' : set ? '重新选择四个文件' : '将四个 PDF 一起拖到这里'}</strong><span>或 <em>点击选择文件</em></span><small>按原始文件名自动分类 · 总大小不超过 160 MB</small></button>
      <div className="pdf-inputs">{pdfKinds.map(({ key, label, short }) => <div key={key}><div className="pdf-input-heading"><strong>{short}</strong><span>{set ? `${set.items[key].pages} 页` : '待选择'}</span></div><p>{set ? set.items[key].file.name : `CF 编号 Fund ${label}.pdf`}</p>{set && <a href={`${set.items[key].url}#page=${key === 'regd' ? 8 : key === 'regs' ? 9 : 1}`} target="_blank" rel="noreferrer">{key === 'regd' || key === 'regs' ? `查看预期签名页（第 ${key === 'regd' ? 8 : 9} 页） ↗` : '查看原文件 ↗'}</a>}</div>)}</div>
    </section><section className="settings-panel"><div className="section-heading"><h2><span className="step">02</span> 核对与生成</h2><span>5 个文件</span></div>
      <div className="pdf-number"><span>自动识别基金编号</span><strong>{set ? set.number : '—'}</strong></div>
      <div className="pdf-rules"><h3>固定合并顺序</h3><p><b>运营协议</b><br/>LLC 协议 → PPM <span className={set && validation ? 'count-error' : ''}>（{set ? set.items.llc.pages + set.items.ppm.pages : '要求 100'} 页）</span></p><p><b>Reg. D 签名文件</b><br/>Reg. D → 运营协议 · 预期第 8 页签名</p><p><b>Reg. S 签名文件</b><br/>Reg. S → 运营协议 · 预期第 9 页签名</p></div>
      <div className="batch-list pdf-names">{[`oper_agr_${set?.number || '编号'}.pdf`, `${set?.number || '编号'}_sign_doc_regs.pdf`, `${set?.number || '编号'}_sign_doc_regd.pdf`, `subagree_${set?.number || '编号'}us.pdf`, `subagree_${set?.number || '编号'}nonus.pdf`].map(name => <div key={name}><span className="file-badge">PDF</span><span>{name}</span></div>)}</div>
      <p className="batch-note pdf-note">两份 subagree 仅更改文件名，内容保持原样。合并文件保留页面顺序和尺寸，不增删页面；如有可填写表单，会将其当前外观固定为页面内容。</p>
      <p className="pdf-confirm">请核对原件：Reg. D 第 8 页、Reg. S 第 9 页是所需签名页。工具保留页序，不自动识别或移动签名页。</p>
      <button className="convert" disabled={!set || Boolean(validation) || busy} onClick={generate}>{busy ? '正在处理…' : '生成五个 PDF'}<span>↗</span></button>
      <p className="button-note">文件仅在当前浏览器处理，不上传服务器</p>
    </section></div>
    <div aria-live="polite">{error && <p className="error" role="alert">{error}</p>}{result && <section className="pdf-results"><div className="section-heading"><h2>✓ 五个文件已生成</h2><a className="batch-download" href={result.zip} download={`CF_${set.number}_documents.zip`}>下载全部（ZIP） ↓</a></div><div className="pdf-output-list">{result.files.map(file => <div key={file.name}><span className="file-badge">PDF</span><div><strong>{file.name}</strong><p>{file.pages} 页{file.signaturePage ? ` · 预期签名页：第 ${file.signaturePage} 页` : ''}</p></div><a target="_blank" rel="noreferrer" href={`${file.url}#page=${file.signaturePage || 1}`}>查看 ↗</a><a href={file.url} download={file.name}>下载 ↓</a></div>)}</div></section>}</div>
  </>;
}
