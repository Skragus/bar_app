import React, {createContext, useContext, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Plus, ChevronDown, ChevronRight, MoreHorizontal, Check, X, Minus, Folder, Tv, Swords, BookOpen, Search, Download, Upload, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, List, Hash, Square, Layers, CheckCheck, RefreshCw} from 'lucide-react';
import {STORAGE_KEY, group, checkbox, counter, progress, updateItem, findItem, removeItem, moveItem, contains, groupOptions, validateData} from './model.js';
import {readLocal, fetchTracker} from './data.js';
import './style.css';
const icons = {tv: Tv, swords: Swords, book: BookOpen};
const num = value => new Intl.NumberFormat(undefined, {maximumFractionDigits: 2}).format(value);
const AppContext = createContext(null);
function App() {
  const [initial] = useState(() => readLocal());
  const [localItems, setLocalItems] = useState(initial.items), [canonical, setCanonical] = useState(null);
  const [mode, setMode] = useState('github'), [viewExpanded, setViewExpanded] = useState({});
  const readOnly = mode === 'github', items = (readOnly ? canonical : localItems) || [];
  const [storageError, setStorageError] = useState(initial.error), [dataError, setDataError] = useState(''), [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(''), [menu, setMenu] = useState(null), [editor, setEditor] = useState(null), [moving, setMoving] = useState(null), [deleting, setDeleting] = useState(null), [notice, setNotice] = useState(''), [importing, setImporting] = useState(null);
  const dirty = useRef(false), importInput = useRef();
  const change = next => { if (readOnly) return; dirty.current = true; setLocalItems(previous => typeof next === 'function' ? next(previous || []) : next); };
  const reloadCanonical = async signal => {
    setLoading(true);
    try { const next = await fetchTracker({signal}); if (!signal?.aborted) { setCanonical(next); setDataError(''); } }
    catch (error) { if (!signal?.aborted) setDataError('Could not load GitHub data: ' + error.message + ' Reload Data to retry. Any previous valid dataset remains visible.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => { const controller = new AbortController(); reloadCanonical(controller.signal); return () => controller.abort(); }, []);
  useEffect(() => {
    if (!dirty.current) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(localItems)); setStorageError(''); }
    catch { setStorageError('Local changes could not be saved in this browser. Export a backup before leaving.'); }
  }, [localItems]);
  const switchMode = () => {
    if (readOnly && localItems === null && canonical) setLocalItems(structuredClone(canonical));
    setMode(readOnly ? 'local' : 'github');
    setEditor(null); setMoving(null); setMenu(null); setDeleting(null); setImporting(null); setQuery('');
  };
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { const close = event => { if (!event.target.closest('[data-menu]')) setMenu(null); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, []);
  useEffect(() => { const close = event => { if (event.key === 'Escape') { setMenu(null); setEditor(null); setMoving(null); setDeleting(null); setImporting(null); } }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, []);
  const patch = (id, data) => {
    if (readOnly) { if (typeof data.expanded === 'boolean') setViewExpanded(old => ({...old, [id]: data.expanded})); return; }
    change(old => updateItem(old, id, item => ({...item, ...data})));
  };
  const openCreate = (parent, type) => { if (readOnly) return; if (parent) patch(parent, {expanded: true}); setEditor({parent, type}); setMenu(null); setMoving(null); };
  const edit = item => { if (readOnly) return; setEditor({id: item.id, type: item.type}); setMenu(null); };
  const deleteItem = item => { if (readOnly) return; setMenu(null); if (item.type === 'group' && item.children.length) setDeleting(item); else { change(old => removeItem(old, item.id)); if (editor?.id === item.id) setEditor(null); } };
  const matches = item => item.name.toLowerCase().includes(query.toLowerCase()) || item.description?.toLowerCase().includes(query.toLowerCase()) || (item.type === 'group' && item.children.some(matches));
  const download = (text, filename) => {
    const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Your outline has been exported.'); setMenu(null);
  };
  const exportData = () => download(JSON.stringify({version: 1, items}, null, 2), 'bar-app-backup.json');
  const exportLocal = () => download(initial.error && !dirty.current ? initial.raw || '' : JSON.stringify({version: 1, items: localItems || []}, null, 2), 'bar-app-local-backup.json');
  const localDiffers = canonical !== null && (initial.raw !== null || dirty.current) && JSON.stringify(localItems) !== JSON.stringify(canonical);
  const importData = async event => { if (readOnly) return;
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try { if (file.size > 10000000) throw new Error('Choose a JSON file smaller than 10 MB.'); const data = JSON.parse(await file.text()); if (data.version !== 1) throw new Error('Unsupported backup version.'); setImporting(validateData(data.items)); }
    catch (error) { setNotice('Import failed: ' + error.message); }
  };
  return <AppContext.Provider value={{readOnly, viewExpanded, items, patch, change, setEditor, setMoving, edit, openCreate, setMenu, deleteItem, menu, query, matches, editor, moving}}><header className="app-header"><div className="header-inner"><a className="brand" href="" aria-label="Bar-App home"><span className="brand-mark"><i/><i/><i/></span>bar-app<span className="brand-dot">.</span></a><div className="header-right"><span className={'save-status ' + (storageError ? 'unsaved' : '')}><span/>{readOnly ? 'GitHub · read-only' : storageError ? 'Local · not saved' : 'Local only · this device'}</span><div className="menu-anchor" data-menu><button className="icon-button" aria-label="Backup options" onClick={() => setMenu(menu === 'backup' ? null : 'backup')}><MoreHorizontal size={20}/></button>{menu === 'backup' && <div className="dropdown"><button disabled={readOnly && canonical === null} onClick={exportData}><Download size={14}/>Export JSON</button>{!readOnly && <button onClick={() => {importInput.current.click(); setMenu(null);}}><Upload size={14}/>Import JSON</button>}<p className="menu-hint">{readOnly ? "Public data from GitHub. Browser edits are disabled." : "Local edits stay in this browser. They do not sync to GitHub."}</p></div>}</div></div></div></header>
    <main><div className="page-heading"><div><div className="eyebrow">One thing at a time</div><h1>Your progress<span>.</span></h1><p>Everything you’re working through, in one quiet place.</p></div>{!readOnly && <button className="primary add-root" onClick={() => openCreate(null, 'group')}><Plus size={16}/>Add group</button>}</div>
    <section className="data-mode" aria-label="Data source">
      <div><strong>{readOnly ? 'GitHub-managed' : 'Local-only mode'}</strong><p>{readOnly ? 'Public tracker data. Ask your agent to update it in GitHub, then reload.' : 'Edits save only in this browser. They are not synchronized to GitHub.'}</p></div>
      <div className="data-controls">{readOnly && <button disabled={loading} onClick={() => reloadCanonical()}><RefreshCw size={16}/>{loading ? 'Loading…' : 'Reload Data'}</button>}<button disabled={readOnly && !canonical && localItems === null && !initial.raw} onClick={switchMode}>{readOnly ? 'Open local-only mode' : 'Back to GitHub data'}</button></div>
    </section>
    {readOnly && localDiffers && <div className="migration-notice"><p>Your saved local progress differs from GitHub. It has been preserved and is not used to override GitHub data. Export a backup or open local-only mode to review it. No automatic merge is performed.</p><button onClick={exportLocal}><Download size={16}/>Export local backup</button></div>}
    {readOnly && dataError && <div className="alert" role="alert">{dataError}</div>}
    <div className="outline-toolbar"><div className="outline-label"><Layers size={14}/>My outline<span>{items.length} groups</span></div><label className="search"><Search size={14}/><input aria-label="Search outline" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find something…"/>{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={13}/></button>}</label></div>
    {storageError && <div className="alert" role="alert">{storageError}{initial.raw && <button className="text-button" onClick={exportLocal}>Export local backup</button>}</div>}
    {importing && <div className="confirm-panel" role="alertdialog" aria-label="Confirm import"><strong>Replace this outline?</strong><p>This imports {importing.length} root groups and replaces your current data. Export a backup first if you want to keep it.</p><div><button onClick={exportData}>Export current outline</button><button onClick={() => setImporting(null)}>Cancel</button><button className="primary" onClick={() => {change(importing); setImporting(null); setEditor(null); setMoving(null); setDeleting(null); setNotice('Outline imported.');}}>Replace & import</button></div></div>}
    {deleting && <div className="confirm-panel" role="alertdialog" aria-label="Confirm deletion"><strong>Delete “{deleting.name}” and everything inside?</strong><p>This removes all its groups, checkboxes, and counters.</p><div><button onClick={() => setDeleting(null)}>Keep group</button><button className="danger-button" onClick={() => {change(old => removeItem(old, deleting.id)); setDeleting(null); setEditor(null); setMoving(null);}}>Delete group</button></div></div>}
    <section className={"outline " + (readOnly ? "read-only" : "")} aria-label="Progress outline">{readOnly && canonical?.length === 0 && <div className="empty-state"><h2>No tracked groups yet.</h2><p>Ask your agent to add groups to the GitHub tracker.</p></div>}{editor && !editor.parent && !editor.id && <Editor key={'root-' + editor.type} config={editor}/>} {items.map((item, i) => <Node key={item.id} item={item} index={i} siblings={items}/>)}{!readOnly && items.length === 0 && !editor && <div className="empty-state"><Layers size={28}/><h2>Start with something small.</h2><p>A book, a series, a goal. Give it a home.</p><button className="primary" onClick={() => openCreate(null, 'group')}><Plus size={15}/>Add your first group</button></div>}{query && !items.some(matches) && <div className="empty-state"><Search size={25}/><h2>No matches for “{query}”</h2><p>Try another name or note.</p></div>}</section>
    {!readOnly && <button className="bottom-add" onClick={() => openCreate(null, 'group')}><Plus size={15}/>Add a group<span>Make room for something new</span></button>}
    <footer><span><span className="tiny-mark">▥</span>Small steps. Visible progress.</span><span title="Progress averages eligible immediate children equally. Empty groups do not contribute.">Your pace. Your outline.</span></footer></main>
    <input ref={importInput} className="hidden" type="file" accept="application/json,.json" onChange={importData}/>{notice && <div className="toast" role="status"><CheckCheck size={17}/>{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14}/></button></div>}
  </AppContext.Provider>;
}
  function Editor({config}) {
    const {items, patch, change, setEditor} = useContext(AppContext);
    const existing = config.id ? findItem(items, config.id) : null;
    const [name, setName] = useState(existing?.name || ''), [description, setDescription] = useState(existing?.description || ''), [current, setCurrent] = useState(existing?.current ?? 0), [target, setTarget] = useState(existing?.target ?? 100), [amount, setAmount] = useState(13), [image, setImage] = useState(existing?.image || ''), [icon, setIcon] = useState(existing?.icon || ''), [error, setError] = useState('');
    const save = event => {
      event.preventDefault();
      if (config.type !== 'batch' && !name.trim() && !(existing?.number)) { setError('Give this item a name.'); return; }
      if (config.type === 'counter' && (!Number.isFinite(Number(current)) || Number(current) < 0 || !Number.isFinite(Number(target)) || Number(target) <= 0)) { setError('Use a current value of 0 or more and a target greater than 0.'); return; }
      if (image && !/^https?:\/\//i.test(image)) { setError('Use an http or https image URL.'); return; }
      const details = {name: name.trim(), description: description.trim(), image, icon};
      if (config.type === 'counter') Object.assign(details, {current: Number(current), target: Number(target)});
      if (existing) patch(existing.id, details);
      else {
        let added;
        if (config.type === 'batch') {
          const count = Number(amount); if (!Number.isInteger(count) || count < 1 || count > 1000) { setError('Choose between 1 and 1,000 checkboxes.'); return; }
          const parent = findItem(items, config.parent); const start = Math.max(0, ...parent.children.filter(item => item.type === 'checkbox').map(item => item.number || 0)) + 1;
          added = Array.from({length: count}, (_, i) => checkbox(name.trim(), {number: start + i}));
        } else added = [{...(config.type === 'group' ? group(name.trim()) : config.type === 'counter' ? counter(name.trim()) : checkbox(name.trim())), ...details}];
        change(old => config.parent ? updateItem(old, config.parent, parent => ({...parent, expanded: true, presentation: config.type === 'batch' ? 'tiles' : parent.presentation, children: [...parent.children, ...added]})) : [...old, ...added]);
      }
      setEditor(null);
    };
    return <form className="editor" onSubmit={save} aria-label={existing ? 'Edit item' : 'Create item'}>
      <div className="editor-heading">{existing ? 'Edit' : 'Add'} {config.type === 'batch' ? 'numbered checkboxes' : config.type}<button type="button" className="icon-button" aria-label="Cancel editing" onClick={() => setEditor(null)}><X size={15}/></button></div>
      <label>{config.type === 'batch' ? 'Label (optional)' : 'Name'}<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder={config.type === 'batch' ? 'e.g. Episode' : 'What are you tracking?'} maxLength={300}/></label>
      {config.type === 'batch' ? <label>Number of checkboxes<input type="number" min="1" max="1000" required value={amount} onChange={event => setAmount(event.target.value)}/></label> : <>
      {config.type === 'counter' && <div className="field-pair"><label>Current<input type="number" step="any" min="0" required value={current} onChange={event => setCurrent(event.target.value)}/></label><label>Target<input type="number" step="any" min="0.000001" required value={target} onChange={event => setTarget(event.target.value)}/></label></div>}
      <label>Note <span>optional</span><input value={description} onChange={event => setDescription(event.target.value)} placeholder="A little context…" maxLength={2000}/></label>
      <div className="field-pair"><label>Image URL <span>optional</span><input type="url" value={image} onChange={event => setImage(event.target.value)} placeholder="https://…"/></label>{config.type === 'group' && <label>Icon <span>optional</span><input value={icon} onChange={event => setIcon(event.target.value)} placeholder="e.g. 📚" maxLength={12}/></label>}</div>
      </>}
      {error && <p className="error" role="alert">{error}</p>}<div className="editor-footer"><button type="button" className="text-button" onClick={() => setEditor(null)}>Cancel</button><button className="primary" type="submit">{existing ? 'Save changes' : config.type === 'batch' ? 'Create checkboxes' : 'Create ' + config.type}<Check size={14}/></button></div>
    </form>;
  }
  function MovePanel({item, parent, index, siblings}) {
    const {items, change, setMoving} = useContext(AppContext);
    const [destination, setDestination] = useState(parent || '');
    return <div className="move-panel"><div className="editor-heading">Move “{item.name || item.number}”<button className="icon-button" aria-label="Cancel move" onClick={() => setMoving(null)}><X size={14}/></button></div><div className="move-controls"><label>Destination<select value={destination} onChange={event => setDestination(event.target.value)}>{item.type === 'group' && <option value="">Top level</option>}{groupOptions(items).filter(option => !contains(item, option.id)).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><button className="primary" onClick={() => {change(old => moveItem(old, item.id, destination || null)); setMoving(null);}}>Move here</button></div><div className="reorder"><span>Within this group</span><button disabled={index === 0} onClick={() => change(old => moveItem(old, item.id, parent, index - 1))}><ArrowUp size={14}/>Move up</button><button disabled={index === siblings.length - 1} onClick={() => change(old => moveItem(old, item.id, parent, index + 1))}><ArrowDown size={14}/>Move down</button></div></div>;
  }
  function ItemMenu({item}) {
    const {edit, openCreate, patch, setMenu, setMoving, setEditor, deleteItem} = useContext(AppContext);
    const menuRef = useRef(null);
    useLayoutEffect(() => {
      const place = () => {
        const menu = menuRef.current;
        // Phone menus use the fixed sheet defined in CSS.
        if (window.innerWidth <= 700) {
          ['left', 'right', 'top'].forEach(property => menu.style.removeProperty(property));
          return;
        }
        const anchor = menu.parentElement.getBoundingClientRect();
        const {width, height} = menu.getBoundingClientRect();
        const left = Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12));
        const below = anchor.bottom + 6;
        const top = below + height <= window.innerHeight - 12 ? below : Math.max(12, anchor.top - height - 6);
        Object.assign(menu.style, {left: left + 'px', right: 'auto', top: top + 'px'});
      };
      place();
      window.addEventListener('resize', place);
      window.addEventListener('scroll', place, true);
      return () => {
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
      };
    }, []);
    return <div ref={menuRef} className="dropdown item-menu" role="menu"><button role="menuitem" onClick={() => edit(item)}><Pencil size={14}/>Edit details</button>{item.type === 'group' && <><div className="menu-label">Add to group</div><button role="menuitem" onClick={() => openCreate(item.id, 'group')}><Folder size={14}/>Nested group</button><button role="menuitem" onClick={() => openCreate(item.id, 'checkbox')}><Square size={14}/>Checkbox</button><button role="menuitem" onClick={() => openCreate(item.id, 'counter')}><Hash size={14}/>Counter</button><button role="menuitem" onClick={() => openCreate(item.id, 'batch')}><LayoutGrid size={14}/>Numbered checkboxes</button><div className="menu-divider"/><button role="menuitem" onClick={() => {patch(item.id, {presentation: item.presentation === 'tiles' ? 'list' : 'tiles'}); setMenu(null);}}>{item.presentation === 'tiles' ? <List size={14}/> : <LayoutGrid size={14}/>}Show checkboxes as {item.presentation === 'tiles' ? 'list' : 'tiles'}</button></>}<button role="menuitem" onClick={() => {setMoving(item.id); setMenu(null); setEditor(null);}}><ArrowUpDown size={14}/>Move or reorder</button><div className="menu-divider"/><button className="danger" role="menuitem" onClick={() => deleteItem(item)}><Trash2 size={14}/>Delete {item.type}</button></div>;
  }
  function Actions({item}) {
    const {openCreate, menu, setMenu, readOnly} = useContext(AppContext);
    if (readOnly) return null;
    return <div className="row-actions">{item.type === 'group' && <button className="icon-button quick-add" aria-label={'Add to ' + item.name} title="Add a checkbox" onClick={() => openCreate(item.id, 'checkbox')}><Plus size={16}/></button>}<div className="menu-anchor" data-menu><button className={'icon-button ' + (menu === item.id ? 'active' : '')} aria-label={'Actions for ' + (item.name || 'checkbox ' + item.number)} aria-expanded={menu === item.id} onClick={() => setMenu(menu === item.id ? null : item.id)}><MoreHorizontal size={17}/></button>{menu === item.id && <ItemMenu item={item}/>}</div></div>;
  }
  function Node({item, depth = 0, parent = null, index, siblings, tile = false, reveal = false}) {
    const {query, matches, patch, editor, moving, openCreate, edit, readOnly, viewExpanded} = useContext(AppContext);
    if (query && !reveal && !matches(item)) return null;
    const value = progress(item), isGroup = item.type === 'group', expanded = (readOnly ? viewExpanded[item.id] ?? item.expanded : item.expanded) || !!query, Icon = icons[item.icon] || Folder;
    const label = item.name || (item.number ? 'Episode ' + item.number : 'Untitled checkbox');
    return <div className={'node ' + (isGroup ? 'group-node ' : 'unit-node ') + (depth === 0 ? 'root-node ' : '') + (tile ? 'tile-node' : '')} data-item-id={item.id}>
      <div className={'item-row ' + (isGroup ? 'group-row' : tile ? 'tile-row' : 'unit-row') + (value === 1 ? ' is-complete' : '')}>
        {isGroup ? <button className="group-toggle" onClick={() => patch(item.id, {expanded: !expanded})} aria-expanded={expanded} aria-label={(expanded ? 'Collapse ' : 'Expand ') + item.name}>{expanded ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}<span className={'group-icon ' + (depth === 0 ? 'root-icon' : '')}>{item.image ? <img src={item.image} alt=""/> : item.icon && !icons[item.icon] ? item.icon : <Icon size={depth === 0 ? 17 : 15}/>}</span><span className="name">{item.name}</span>{depth === 0 && <span className="item-count">{item.children.length}</span>}</button> : item.type === 'checkbox' ? <button className={'checkbox-button ' + (item.complete ? 'checked' : '')} disabled={readOnly} role="checkbox" aria-checked={item.complete} aria-label={label} title={item.description || label} onClick={() => patch(item.id, {complete: !item.complete})}>{tile ? <>{item.image && <img src={item.image} alt=""/>}<span className="tile-label">{item.number || (item.complete ? <Check size={18}/> : <Square size={17}/>)}</span>{item.name && <span className="tile-name">{item.name}</span>}{item.complete && <Check className="tile-check" size={11}/>}</> : <><span className="check-box">{item.complete && <Check size={12}/>}</span><span className="name">{item.number && <span className="unit-number">{item.number}.</span>}{label === 'Episode ' + item.number ? 'Episode ' + item.number : item.name}</span></>}</button> : <><Hash size={14} className="counter-icon"/><button className="counter-name" disabled={readOnly} onClick={() => edit(item)} title={readOnly ? "Managed in GitHub" : "Edit counter"}>{item.name}</button></>}
        {isGroup && <div className="group-progress"><span>{value === null ? '—' : Math.round(value * 100) + '%'}</span><div className="progress-track"><i style={{width: (value || 0) * 100 + '%'}}/></div></div>}
        {item.type === 'counter' && <div className="counter-progress"><div className="progress-track"><i style={{width: value * 100 + '%'}}/></div><button className="counter-value" disabled={readOnly} aria-label={'Edit values for ' + item.name} onClick={() => edit(item)}><strong>{num(item.current)}</strong><span>/ {num(item.target)}</span></button>{!readOnly && <div className="stepper"><button aria-label={'Decrease ' + item.name} disabled={item.current === 0} onClick={() => patch(item.id, {current: Math.max(0, item.current - 1)})}><Minus size={13}/></button><button aria-label={'Increase ' + item.name} onClick={() => patch(item.id, {current: item.current + 1})}><Plus size={13}/></button></div>}</div>}
        <Actions item={item}/>
      </div>
      {item.description && !tile && <p className={'item-note ' + (isGroup ? 'group-note' : '')}>{item.description}</p>}
      {editor?.id === item.id && <Editor key={item.id} config={editor}/>}
      {moving === item.id && <MovePanel item={item} parent={parent} index={index} siblings={siblings}/>}
      {isGroup && expanded && <div className="children">
        {item.presentation === 'tiles' && item.children.some(child => child.type === 'checkbox') ? (() => {
          const parts = []; let checks = [];
          const flush = () => {if (checks.length) {parts.push(<div className="tile-grid" key={'tiles-' + checks[0].id}>{checks.map(child => <Node key={child.id} item={child} depth={depth + 1} parent={item.id} index={item.children.indexOf(child)} siblings={item.children} tile reveal={reveal || item.name.toLowerCase().includes(query.toLowerCase())}/>)}</div>); checks = [];}};
          item.children.forEach((child, i) => {if (child.type === 'checkbox') checks.push(child); else {flush(); parts.push(<Node key={child.id} item={child} depth={depth + 1} parent={item.id} index={i} siblings={item.children} reveal={reveal || item.name.toLowerCase().includes(query.toLowerCase())}/>);}}); flush(); return parts;
        })() : item.children.map((child, i) => <Node key={child.id} item={child} depth={depth + 1} parent={item.id} index={i} siblings={item.children} reveal={reveal || item.name.toLowerCase().includes(query.toLowerCase())}/>)}
        {editor?.parent === item.id && !editor.id && <Editor key={item.id + editor.type} config={editor}/>}
        {!readOnly && item.children.length === 0 && editor?.parent !== item.id && <div className="empty-group"><span>A little room for progress.</span><button onClick={() => openCreate(item.id, 'checkbox')}><Plus size={13}/>Add checkbox</button><button onClick={() => openCreate(item.id, 'counter')}>Counter</button><button onClick={() => openCreate(item.id, 'group')}>Group</button><button onClick={() => openCreate(item.id, 'batch')}>Numbered batch</button></div>}
      </div>}
    </div>;
  }

createRoot(document.getElementById('root')).render(<App/>);
