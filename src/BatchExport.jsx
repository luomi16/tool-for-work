import React, { useEffect, useRef, useState } from 'react';
import { zipSync } from 'fflate';

const outputs = [[1200, 900, 'jpg'], [1200, 900, 'png'], [600, 450, 'jpg'], [600, 450, 'png']];
export default function BatchExport({ source }) {
  const [number, setNumber] = useState('');
  const [fit, setFit] = useState('contain');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [archive, setArchive] = useState(null);
  const generation = useRef(0);
  const valid = /^\d+$/.test(number);
  const enlarges = source && (fit === 'contain' ? Math.min : Math.max)(1200 / source.img.naturalWidth, 900 / source.img.naturalHeight) > 1;
  useEffect(() => { generation.current++; setFiles([]); setArchive(null); setError(''); }, [source, number, fit]);
  useEffect(() => () => files.forEach(file => URL.revokeObjectURL(file.url)), [files]);
  useEffect(() => () => { if (archive) URL.revokeObjectURL(archive.url); }, [archive]);
  useEffect(() => () => { generation.current++; }, []);

  async function generate() {
    if (!source || !valid || busy) return;
    const token = generation.current;
    setBusy(true); setError('');
    const generated = [];
    let zipUrl;
    try {
      const entries = {};
      for (const [w, h, extension] of outputs) {
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error();
        if (extension === 'jpg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        const img = source.img;
        if (fit === 'stretch') ctx.drawImage(img, 0, 0, w, h);
        else {
          const scale = (fit === 'cover' ? Math.max : Math.min)(w / img.naturalWidth, h / img.naturalHeight);
          const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
          ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        }
        const blob = await new Promise(resolve => canvas.toBlob(resolve, extension === 'jpg' ? 'image/jpeg' : 'image/png', 1));
        canvas.width = 0; canvas.height = 0;
        if (!blob) throw new Error();
        if (token !== generation.current) return;
        const name = `${number}.1-${w}x${h}.${extension}`;
        entries[name] = new Uint8Array(await blob.arrayBuffer());
        generated.push({ name, url: URL.createObjectURL(blob), bytes: blob.size });
      }
      const zip = zipSync(entries, { level: 0 });
      if (token !== generation.current) return;
      zipUrl = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      setFiles(generated); setArchive({ url: zipUrl, name: `${number}.1-images.zip` });
    } catch {
      if (token === generation.current) setError('生成失败，请重新尝试。');
      generated.forEach(file => URL.revokeObjectURL(file.url));
      if (zipUrl) URL.revokeObjectURL(zipUrl);
    } finally {
      if (token !== generation.current) generated.forEach(file => URL.revokeObjectURL(file.url));
      setBusy(false);
    }
  }
  return <>
    <label className="field-label" htmlFor="export-number">图片编号</label>
    <input id="export-number" className="batch-number" inputMode="numeric" placeholder="例如：863" value={number} onChange={e => setNumber(e.target.value.trim())} aria-invalid={number !== '' && !valid}/>
    {number && !valid && <p className="batch-validation">编号请只填写数字。</p>}
    <label className="field-label" htmlFor="export-fit">图片与 4:3 比例不一致时</label>
    <select id="export-fit" className="batch-fit" value={fit} onChange={e => setFit(e.target.value)}>
      <option value="contain">完整保留图片，边缘留白</option>
      <option value="cover">居中裁剪，铺满画面</option>
      <option value="stretch">拉伸到指定尺寸</option>
    </select>
    <p className="batch-note">JPG 最高质量（100%），PNG 无损编码。两种尺寸均直接从原图生成。JPG 透明区域和留白填充白色，PNG 保留透明。</p>
    {enlarges && <p className="batch-warning">当前设置会放大原图；放大无法增加原有细节。</p>}
    <div className="batch-list" aria-label="导出文件预览">{outputs.map(([w, h, extension]) => <div key={`${w}-${extension}`}><span className="file-badge">{extension.toUpperCase()}</span><span>{valid ? number : '编号'}.1-{w}x{h}.{extension}</span></div>)}</div>
    <button className="convert" disabled={!source || !valid || busy} onClick={generate}>{busy ? '正在生成…' : '生成四张图片'}<span>↗</span></button>
    <p className="button-note">尺寸调整会改变像素；JPG 编码仍有损</p>
    <div className="batch-results" aria-live="polite">
      {error && <p className="error" role="alert">{error}</p>}
      {archive && <><a className="batch-download" download={archive.name} href={archive.url}>下载全部四张（ZIP） ↓</a><div className="batch-individual">{files.map(file => <a key={file.name} download={file.name} href={file.url}><img src={file.url} alt={file.name}/><span>{file.name}<small>{(file.bytes / 1024).toFixed(1)} KB · 单独下载 ↓</small></span></a>)}</div></>}
    </div>
  </>;
}
