import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const size = bytes => bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`;
function App() {
  const [source, setSource] = useState(null);
  const [format, setFormat] = useState('image/jpeg');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [locked, setLocked] = useState(true);
  const [quality, setQuality] = useState(85);
  const [background, setBackground] = useState('#ffffff');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const loadId = useRef(0);
  const generation = useRef(0);
  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => { generation.current++; setResult(null); }, [source, format, width, height, quality, background]);

  async function openFile(file) {
    if (!file) return;
    const id = ++loadId.current;
    setError('');
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setError('请选择 PNG 或 JPG 图片。'); return; }
    if (file.size > 40 * 1024 * 1024) { setError('请选择小于 40 MB 的图片。'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
      if (id !== loadId.current) { URL.revokeObjectURL(url); return; }
      if (img.naturalWidth * img.naturalHeight > 40000000) throw new Error('图片像素过大，请使用不超过 4000 万像素的图片。');
      setSource({ file, url, img });
      setWidth(img.naturalWidth); setHeight(img.naturalHeight);
      setResult(null);
    } catch (e) { URL.revokeObjectURL(url); if (id === loadId.current) setError(e.message.includes('像素') ? e.message : '图片读取失败，请尝试其他文件。'); }
  }
  function changeDimension(axis, value) {
    if (axis === 'width') setWidth(value); else setHeight(value);
    if (locked && source && Number(value) > 0) {
      const ratio = source.img.naturalWidth / source.img.naturalHeight;
      if (axis === 'width') setHeight(Math.max(1, Math.round(Number(value) / ratio)));
      else setWidth(Math.max(1, Math.round(Number(value) * ratio)));
    }
  }
  async function convert() {
    if (!source || busy) return;
    setError('');
    const w = Number(width), h = Number(height);
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 16000 || h > 16000 || w * h > 40000000) {
      setError('尺寸须为 1–16000 的整数，且总像素不超过 4000 万。'); return;
    }
    const token = generation.current;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error();
      if (format === 'image/jpeg') { ctx.fillStyle = background; ctx.fillRect(0, 0, w, h); }
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source.img, 0, 0, w, h);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality / 100));
      if (!blob) throw new Error();
      if (token === generation.current) setResult({ url: URL.createObjectURL(blob), bytes: blob.size, name: `${source.file.name.replace(/\.[^.]+$/, '')}-${w}x${h}.${format === 'image/png' ? 'png' : 'jpg'}`, w, h });
      canvas.width = 0; canvas.height = 0;
    } catch { setError('转换失败，请尝试缩小图片尺寸。'); } finally { setBusy(false); }
  }
  return <div className="shell">
    <aside><a className="brand" href="./"><span className="brand-icon">▦</span> 工作台<span className="brand-dot">.</span></a><div className="nav-label">我的工具</div><div className="nav-item"><span>▧</span> 图片转换 <span className="nav-arrow">↗</span></div><div className="aside-bottom"><span className="status-dot"/> 本地处理，安心使用</div></aside>
    <main><header><span>工具箱 <span className="slash">/</span> 图片工具</span><span className="header-tag">为日常工作减负</span></header>
      <div className="page"><div className="eyebrow">IMAGE STUDIO <span>01</span></div><h1>让图片，刚刚好<span>。</span></h1><p className="intro">转换格式、调整尺寸、减小体积。把琐碎的事，交给小工具。</p>
      <div className="workspace"><section className="image-panel"><div className="section-heading"><h2><span className="step">01</span> 选择图片</h2><span>PNG / JPG</span></div>
      <input ref={input} className="file-input" type="file" accept="image/png,image/jpeg" onChange={e => { openFile(e.target.files?.[0]); e.target.value = ''; }}/>
      <button className={`drop-zone ${dragging ? 'dragging' : ''} ${source ? 'has-image' : ''}`} onClick={() => input.current.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); openFile(e.dataTransfer.files[0]); }}>
        {source ? <><img src={source.url} alt="原始图片预览"/><span className="replace">点击或拖入图片以替换</span></> : <><div className="upload-icon">↥</div><strong>把图片拖到这里</strong><span>或 <em>点击选择文件</em></span><small>支持 PNG、JPG · 最大 40 MB</small></>}
      </button>
      <div className="file-details">{source ? <><strong title={source.file.name}>{source.file.name}</strong><span>{source.img.naturalWidth} × {source.img.naturalHeight} px · {size(source.file.size)}</span></> : <><span className="tiny-icon">⌁</span><span>你的图片仅在此设备处理，不会上传到服务器</span></>}</div>
      </section><section className="settings-panel"><div className="section-heading"><h2><span className="step">02</span> 调整设置</h2><span>自由定义</span></div>
      <label className="field-label">输出格式</label><div className="format-switch">{[['image/jpeg','JPG','更小体积'],['image/png','PNG','保留透明']].map(([value,name,desc]) => <button key={value} className={format === value ? 'selected' : ''} onClick={() => setFormat(value)}><strong>{name}</strong><span>{desc}</span>{format === value && <i>✓</i>}</button>)}</div>
      <div className="dimension-heading"><label className="field-label">图片尺寸 <span>px</span></label><label className="lock"><input type="checkbox" checked={locked} onChange={e => { setLocked(e.target.checked); if (e.target.checked && source) setHeight(Math.max(1, Math.round(Number(width) * source.img.naturalHeight / source.img.naturalWidth))); }}/>锁定比例</label></div>
      <div className="dimensions"><label><span>宽度</span><input aria-label="宽度" type="number" min="1" max="16000" placeholder="原始宽度" value={width} onChange={e => changeDimension('width', e.target.value)}/></label><span>×</span><label><span>高度</span><input aria-label="高度" type="number" min="1" max="16000" placeholder="原始高度" value={height} onChange={e => changeDimension('height', e.target.value)}/></label></div>
      <div className="quality-heading"><label className="field-label" htmlFor="quality">图片质量</label><strong>{format === 'image/png' ? '无损' : `${quality}%`}</strong></div><input id="quality" className="range" type="range" min="10" max="100" value={quality} disabled={format === 'image/png'} onChange={e => setQuality(Number(e.target.value))}/><div className="range-labels"><span>更小体积</span><span>更清晰</span></div>
      {format === 'image/jpeg' ? <label className="background">透明区域填充色<input aria-label="JPG 背景色" type="color" value={background} onChange={e => setBackground(e.target.value)}/></label> : <p className="png-note">PNG 保留透明度；减小尺寸可降低文件体积。</p>}
      <button className="convert" disabled={!source || busy} onClick={convert}>{busy ? '正在处理…' : '转换图片'}<span>↗</span></button><p className="button-note">无需安装 · 无需注册 · 免费使用</p>
      </section></div>
      <div aria-live="polite">{error && <p className="error" role="alert">{error}</p>}{result && <section className="result"><img src={result.url} alt="转换结果预览"/><div><span className="result-label">✓ 转换完成</span><h3>{result.name}</h3><p>{result.w} × {result.h} px · {size(result.bytes)}<span> · {result.bytes <= source.file.size ? `体积减少 ${Math.round((1 - result.bytes / source.file.size) * 100)}%` : `比原图增大 ${Math.round((result.bytes / source.file.size - 1) * 100)}%`}</span></p></div><a download={result.name} href={result.url}>下载图片 ↓</a></section>}</div>
      <div className="features"><div><span>◎</span><div><strong>隐私优先</strong><p>文件留在你的浏览器里</p></div></div><div><span>↗</span><div><strong>即开即用</strong><p>轻量工具，专注一件事</p></div></div><div><span>▦</span><div><strong>持续生长</strong><p>更多工作小工具，陆续加入</p></div></div></div><footer>少一点重复，多一点专注。<span>WORK TOOLS / 001</span></footer>
      </div></main></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
