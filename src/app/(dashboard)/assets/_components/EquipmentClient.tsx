'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Monitor, Search, X, ZoomIn, ZoomOut, Maximize, Pencil, Plus } from 'lucide-react'
import { assetCategories, blockKinds, useStatuses, type Asset, type Block, type EquipmentData, type LayoutChange, type Person, type Stock } from '@/lib/equipment/types'
import { clampBlock, containedIds, searchEquipment, summarize } from '@/lib/equipment/derive'
import { refreshEquipment, revealPhone, saveLayout } from '../actions'
import { buttonClass, fieldClass, ItemEditor } from './ItemEditor'
import { StockControl } from './StockControl'
import { ServiceSection } from './ServiceSection'
import { installTraversalGuard } from '@/lib/equipment/navigation-guard'
import { ManagementEditor } from './ManagementEditor'

const kpiOrder = ['전자칠판', '데스크탑', '대형 모니터', '모니터', '키보드', '마우스', '기타']

export function EquipmentClient({ initialData, isAdmin }: { initialData: EquipmentData; isAdmin: boolean }) {
  const [data, setData] = useState(initialData)
  const [floorId, setFloorId] = useState(2)
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('floor')
  const [status, setStatus] = useState('전체')
  const [category, setCategory] = useState('')
  const [draft, setDraft] = useState<Block[] | null>(null)
  const [canvas, setCanvas] = useState<{ width: number; height: number } | null>(null)
  const [assignments, setAssignments] = useState<LayoutChange['assignments']>([])
  const [zoom, setZoom] = useState(1)
  const [availableWidth, setAvailableWidth] = useState(1000)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [phone, setPhone] = useState<{ id: string; version: number; value: string } | null>(null)
  const [editor, setEditor] = useState<{ kind: 'asset' | 'stock' | 'person'; item?: Asset | Stock | Person } | null>(null)
  const [showPeople, setShowPeople] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const lock = useRef(false)
  const drag = useRef<{ id: string; x: number; y: number; original: Block } | null>(null)
  const storedFloor = data.floors.find(f => f.id === floorId)
  const floor = storedFloor && canvas && draft ? { ...storedFloor, ...canvas } : storedFloor
  const original = data.blocks.filter(b => b.floor_id === floorId)
  const blocks = draft ?? original
  const selectedBlock = blocks.find(b => b.id === selected)
  const dirty = draft !== null && (JSON.stringify(draft) !== JSON.stringify(original) || assignments.length > 0 || (canvas !== null && (canvas.width !== storedFloor?.width || canvas.height !== storedFloor?.height)))
  const scale = Math.min(1, availableWidth / (floor?.width ?? 1000)) * zoom
  const search = searchEquipment(data, query)
  const scopedBlockIds = new Set(data.blocks.filter(b => b.floor_id === floorId).map(b => b.id))
  const matchesScope = (item: Asset | Stock) => (scope === 'all' || (item.block_id && scopedBlockIds.has(item.block_id))) && (status === '전체' || item.status === status)
  const unverified = data.blocks.filter(b => b.unverified_category && (scope === 'all' || b.floor_id === floorId) && (status === '전체' || b.unverified_status === status))
  const counts = summarize(data.assets.filter(matchesScope), data.stocks.filter(matchesScope), unverified.map(b => b.unverified_category!))
  const summary = [
    ...kpiOrder.map(category => counts.find(item => item.category === category) ?? { category, label: '등록 없음' }),
    ...counts.filter(item => !kpiOrder.includes(item.category)),
  ]
  const highlighted = new Set(search.flatMap(r => r.block_id ? [r.block_id] : []))
  if (category) for (const a of [...data.assets, ...data.stocks]) if (a.category === category && a.block_id && (status === '전체' || a.status === status)) highlighted.add(a.block_id)
  if (category) for (const b of unverified) if (b.unverified_category === category) highlighted.add(b.id)
  const selectionIds = selectedBlock ? containedIds(selectedBlock, blocks) : new Set<string>()
  const locationFor = (a: Asset | Stock) => {
    const assignment = assignments.find(v => v.id === a.id)
    if (assignment) return assignment.block_id
    if (draft && a.block_id && original.some(b => b.id === a.block_id) && !draft.some(b => b.id === a.block_id)) return null
    return a.block_id
  }
  const selectedAssets = data.assets.filter(a => { const loc = locationFor(a); return selected === 'unplaced' ? loc === null : loc !== null && selectionIds.has(loc) })
  const selectedStocks = data.stocks
    .filter(a => { const loc = locationFor(a); return selected === 'unplaced' ? loc === null : loc !== null && selectionIds.has(loc) })
    .sort((a, b) => {
      const rank = (category: string) => { const index = kpiOrder.indexOf(category); return index < 0 ? kpiOrder.length : index }
      return rank(a.category) - rank(b.category)
    })
  const person = data.people.find(p => p.id === selectedBlock?.person_id)
  const personId = person?.id
  const personVersion = person?.version

  useEffect(() => {
    if (!personId || personVersion === undefined) return
    let cancelled = false
    void revealPhone(personId).then(result => {
      if (!cancelled) setPhone({ id: personId, version: personVersion, value: result.error ?? result.phone ?? '등록된 휴대폰 없음' })
    }).catch(() => {
      if (!cancelled) setPhone({ id: personId, version: personVersion, value: '연락처를 불러오지 못했습니다.' })
    })
    return () => { cancelled = true }
  }, [personId, personVersion])

  useEffect(() => {
    if (!viewport.current) return
    const observer = new ResizeObserver(entries => setAvailableWidth(entries[0].contentRect.width))
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!dirty) return
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    const confirmLeave = () => confirm('저장하지 않은 배치 변경을 버리고 이동하시겠습니까?')
    const click = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (link && !link.download && link.target !== '_blank' && !confirmLeave()) { e.preventDefault(); e.stopPropagation() }
    }
    const submit = (e: SubmitEvent) => { if (!confirmLeave()) { e.preventDefault(); e.stopPropagation() } }
    const navigation = (window as Window & { navigation?: EventTarget }).navigation
    const removeTraversalGuard = installTraversalGuard(navigation, confirmLeave)
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', click, true)
    document.addEventListener('submit', submit, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); document.removeEventListener('submit', submit, true); removeTraversalGuard() }
  }, [dirty])

  async function refresh() { const next = await refreshEquipment(); setData(next.data) }
  function selectFloor(id: number) {
    if (busy) return false
    if (dirty && !confirm('저장하지 않은 배치 변경을 버리고 층을 이동하시겠습니까?')) return false
    setFloorId(id); setDraft(null); setCanvas(null); setAssignments([]); setSelected(null); setZoom(1); setError(''); return true
  }
  function patchBlock(id: string, patch: Partial<Block>) {
    if (!floor || busy) return
    setDraft(current => current?.map(b => b.id === id ? clampBlock({ ...b, ...patch }, floor.width, floor.height) : b) ?? null)
  }
  async function persistLayout() {
    if (!draft || !floor || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const changed = draft.filter(b => JSON.stringify(b) !== JSON.stringify(original.find(o => o.id === b.id)))
      const removed = original.filter(b => !draft.some(d => d.id === b.id)).map(b => b.id)
      const result = await saveLayout({ floor_id: floorId, version: floor.version, width: floor.width, height: floor.height, blocks: changed, removed, assignments })
      if (result.error) setError(result.error)
      else { await refresh(); setDraft(null); setCanvas(null); setAssignments([]) }
    } catch { setError('저장 결과를 확인하지 못했습니다. 변경 내용은 유지됩니다. 최신 데이터를 확인해 주세요.') }
    finally { lock.current = false; setBusy(false) }
  }
  function addBlock() {
    const id = crypto.randomUUID()
    const b: Block = { id, floor_id: floorId, kind: '보관', name: '새 보관 장소', x: 20, y: 20, width: 190, height: 90, parent_id: null, person_id: null, registration: '미등록', unverified_category: null, unverified_status: '재고', note: null, deleted_at: null, updated_at: '', updated_by: null, version: 1 }
    setDraft(v => [...(v ?? original), b]); setSelected(id)
  }
  async function cancelEditing() {
    if (dirty && !confirm('배치 변경을 취소하시겠습니까?')) return
    setDraft(null); setCanvas(null); setAssignments([]); setError('')
    try { await refresh() } catch { setError('최신 현황을 불러오지 못했습니다.') }
  }
  const beginItem = (kind: 'asset' | 'stock' | 'person', item?: Asset | Stock | Person) => setEditor({ kind, item })
  return <div className="space-y-4 p-4 lg:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-wider text-blue-700">YEONGJEONSA · IT</p><h1 className="mt-1 text-2xl font-bold text-slate-900">영전사 전산 현황</h1><p className="mt-1 text-sm text-slate-500">자리와 공간에서 찾는 장비 · 필요한 정보는 블록을 눌러 확인하세요.</p></div><Link className={`${buttonClass} flex gap-2`} href="/assets/stock">서랍·재고 보기 ↗</Link></header>
    <div className="rounded-xl border bg-white p-5 md:hidden"><Monitor className="mb-3 size-6 text-blue-700"/><p className="font-semibold">배치도는 PC 화면에서 확인해 주세요.</p><p className="mt-2 text-sm text-slate-500">휴대폰에서는 장소별 재고를 조회하고 수량을 수정할 수 있습니다.</p><Link href="/assets/stock" className="mt-4 inline-block text-blue-700">장비 재고 열기 →</Link></div>
    <div className="hidden space-y-4 md:block">
      <div className="flex flex-wrap items-center gap-2"><div className="flex gap-1 rounded-lg bg-slate-200/70 p-1" role="tablist" aria-label="층 선택">{[1,2,3].map(id => <button key={id} role="tab" aria-selected={id===floorId} disabled={busy} onClick={()=>selectFloor(id)} className={`rounded-md px-5 py-2 text-sm font-semibold ${floorId===id?'bg-white text-blue-800 shadow-sm':'text-slate-500'}`}>{id}층</button>)}</div>
        <div className="relative ml-2 min-w-56 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-slate-400"/><input aria-label="이름 장비명 자산번호 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="이름, 장비명, 자산번호 검색" className={`${fieldClass} pl-9`}/></div>
        {isAdmin && (draft ? <><button disabled={busy || !dirty} onClick={()=>void persistLayout()} className={`${buttonClass} text-blue-700`}>{busy?'저장 중…':'배치 저장'}</button><button disabled={busy} className={buttonClass} onClick={()=>void cancelEditing()}>취소</button></> : <><button className={`${buttonClass} flex items-center gap-2`} onClick={()=>{setDraft(structuredClone(original));setCanvas(null);setError('')}}><Pencil className="size-4"/>배치 편집</button><button className={buttonClass} onClick={()=>setShowPeople(v=>!v)}>인원 관리</button><button className={buttonClass} onClick={()=>beginItem('asset')}>장비 등록</button></>)}
      </div>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {query && <div className="max-h-44 overflow-y-auto rounded-lg border bg-white p-2">{search.length ? search.map(r=><button key={r.id} className="block w-full rounded p-2 text-left text-sm hover:bg-blue-50" onClick={()=>{if(r.floor_id!==null && r.floor_id!==floorId && !selectFloor(r.floor_id))return;setSelected(r.block_id??'unplaced')}}>{r.floor_id?`${r.floor_id}층`:'미배치'} · {r.label}</button>):<p className="p-2 text-sm text-slate-500">검색 결과 없음</p>}</div>}
      {showPeople && !draft && <section className="rounded-xl border bg-white p-4"><div className="mb-3 flex justify-between"><h2 className="font-semibold">인원 {data.people.filter(p=>p.active).length}명</h2><button className={buttonClass} onClick={()=>beginItem('person')}>인원 추가</button></div><div className="flex flex-wrap gap-2">{data.people.map(p=><button className={buttonClass} key={p.id} onClick={()=>beginItem('person',p)}>{p.name} {p.title}{p.active?'':' · 퇴사'}</button>)}</div></section>}
      <div className="flex flex-wrap items-center gap-2 text-sm"><select aria-label="집계 범위" value={scope} onChange={e=>setScope(e.target.value)} className="rounded-md border bg-white p-2"><option value="floor">이 층</option><option value="all">전체 · 미배치 포함</option></select><select aria-label="사용 상태 필터" value={status} onChange={e=>setStatus(e.target.value)} className="rounded-md border bg-white p-2"><option>전체</option>{useStatuses.map(s=><option key={s}>{s}</option>)}</select>{summary.map(s=><button key={s.category} onClick={()=>setCategory(category===s.category?'':s.category)} className={`rounded-lg border px-3 py-2 ${category===s.category?'border-blue-500 bg-blue-50':'bg-white'}`}><span className="text-slate-500">{s.category}</span> <strong>{s.label}</strong></button>)}{!summary.length && <span className="text-slate-500">현재 등록된 장비 없음</span>}</div>
      {draft && <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><p>편집 중 · 드래그 또는 방향키로 이동 · 상세에서 크기·배정 수정{dirty?' · 저장하지 않은 변경 있음':''}</p><button disabled={busy} className={`${buttonClass} flex items-center gap-1`} onClick={addBlock}><Plus className="size-4"/>블록 추가</button></div>}
      {draft && floor && <div className="flex items-center gap-3 text-xs text-slate-600"><span>캔버스 크기</span>{(['width','height'] as const).map(k=><label className="flex items-center gap-2" key={k}>{k==='width'?'너비':'높이'}<input className="w-24 rounded border bg-white p-2" disabled={busy} type="number" min={k==='width'?400:300} max={k==='width'?2400:1800} step="10" value={floor[k]} onChange={e=>setCanvas({width:floor.width,height:floor.height,[k]:Number(e.target.value)})}/></label>)}</div>}
      <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3"><div className="text-sm font-semibold">{floorId}층 간략 배치도 <span className="ml-2 font-normal text-slate-500">실측 비율 아님</span></div><div className="flex gap-1"><button className={buttonClass} aria-label="축소" onClick={()=>setZoom(z=>Math.max(.75,z-.15))}><ZoomOut className="size-4"/></button><button className={buttonClass} aria-label="화면 맞춤" onClick={()=>setZoom(1)}><Maximize className="size-4"/></button><button className={buttonClass} aria-label="확대" onClick={()=>setZoom(z=>Math.min(2,z+.15))}><ZoomIn className="size-4"/></button></div></div>
        <div ref={viewport} className="overflow-auto bg-slate-50/70 p-0" style={{maxHeight:'70vh'}}>
          {!blocks.length ? <div className="flex min-h-80 items-center justify-center text-slate-500">현재 등록된 장비 없음{floorId===1?' · 1층 배치 자료 미등록':''}</div> : <div style={{width:(floor?.width??1000)*scale,height:(floor?.height??650)*scale}}><div className="relative origin-top-left" style={{width:floor?.width??1000,height:floor?.height??650,transform:`scale(${scale})`}}>
            {[...blocks].sort((a,b)=>Number(a.kind!=='구역')-Number(b.kind!=='구역')).map(b=>{
              const p=data.people.find(p=>p.id===b.person_id)
              const isRegion=b.kind==='구역'
              const highlightedBlock=highlighted.has(b.id)
              return <button key={b.id} aria-label={`${b.name}, ${b.registration}`} aria-pressed={selected===b.id} disabled={busy} onClick={()=>setSelected(b.id)}
                onPointerDown={e=>{if(!draft||busy)return;e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:b.id,x:e.clientX,y:e.clientY,original:b};setSelected(b.id)}}
                onPointerMove={e=>{const d=drag.current;if(d?.id===b.id)patchBlock(b.id,{x:d.original.x+(e.clientX-d.x)/scale,y:d.original.y+(e.clientY-d.y)/scale})}}
                onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}
                onKeyDown={e=>{if(!draft)return;const directions:Record<string,[number,number]>={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};const d=directions[e.key];if(d){e.preventDefault();patchBlock(b.id,{x:b.x+d[0],y:b.y+d[1]})}}}
                className={`absolute overflow-hidden rounded-lg border-2 text-left transition-colors ${draft?'touch-none':''} ${selected===b.id?'border-blue-600 ring-2 ring-blue-200':highlightedBlock?'border-amber-500 bg-amber-50':isRegion?'border-slate-200 bg-slate-100/70':'border-slate-200 bg-white hover:border-blue-300'} ${isRegion?'p-3':'px-3 py-2 shadow-sm'}`}
                style={{left:b.x,top:b.y,width:b.width,height:b.height,zIndex:isRegion?0:1}}>
                <div className={isRegion?'absolute left-3 top-2 text-sm font-semibold text-slate-500':'text-[14px] font-semibold leading-5 text-slate-900'}>{p?p.name:b.name}{p&&<span className="ml-1 text-xs font-normal text-slate-500">{p.title}</span>}</div>
              </button>
            })}
          </div></div>}
        </div>
        <div className="flex justify-between border-t px-4 py-3 text-xs text-slate-500"><span>미등록은 실제 장비 없음과 다릅니다. 전자칠판 중복 확인 전 총수는 미확인입니다.</span><button className="font-medium text-blue-700" onClick={()=>setSelected('unplaced')}>미배치 장비 보기</button></div>
      </section>
      <ServiceSection services={data.services} assets={data.assets} isAdmin={isAdmin && !draft} onSaved={refresh} />
    </div>
    {(selectedBlock || selected==='unplaced') && <aside className="fixed bottom-4 right-4 top-20 z-30 hidden w-[340px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl md:block" aria-label="선택 위치 상세">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white p-4"><div><p className="text-xs text-blue-700">{selectedBlock?`${floorId}층 · ${selectedBlock.kind}`:'위치 미정'}</p><h2 className="mt-1 text-lg font-bold">{selectedBlock?.name??'미배치 장비'}</h2></div><button aria-label="상세 닫기" onClick={()=>setSelected(null)} className="p-1"><X className="size-5"/></button></div>
      <div className="space-y-5 p-4">
        {draft && selectedBlock ? <fieldset disabled={busy} className="space-y-3"><label className="block text-xs">블록 이름<input className={fieldClass} value={selectedBlock.name} maxLength={100} onChange={e=>patchBlock(selectedBlock.id,{name:e.target.value})}/></label><label className="block text-xs">유형<select className={fieldClass} value={selectedBlock.kind} onChange={e=>patchBlock(selectedBlock.id,{kind:e.target.value as Block['kind']})}>{blockKinds.map(k=><option key={k}>{k}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2">{(['x','y','width','height'] as const).map(k=><label key={k} className="text-xs">{{x:'가로 위치',y:'세로 위치',width:'너비',height:'높이'}[k]}<input type="number" step="10" className={fieldClass} value={selectedBlock[k]} onChange={e=>patchBlock(selectedBlock.id,{[k]:Number(e.target.value)})}/></label>)}</div>
          <label className="block text-xs">소속 구역<select className={fieldClass} value={selectedBlock.parent_id??''} onChange={e=>patchBlock(selectedBlock.id,{parent_id:e.target.value||null})}><option value="">없음</option>{blocks.filter(b=>b.kind==='구역'&&!containedIds(selectedBlock,blocks).has(b.id)).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className="block text-xs">배정 인원<select className={fieldClass} value={selectedBlock.person_id??''} onChange={e=>patchBlock(selectedBlock.id,{person_id:e.target.value||null})}><option value="">담당자 없음 / 공용</option>{data.people.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name} {p.title}</option>)}</select></label>
          <label className="block text-xs">등록 상태<select className={fieldClass} value={selectedBlock.registration} onChange={e=>patchBlock(selectedBlock.id,{registration:e.target.value as Block['registration']})}>{['미등록','일부등록','확인완료','장비있음'].map(s=><option key={s}>{s}</option>)}</select></label>
          <label className="block text-xs">개별 등록 전 수량 미확인 장비<select className={fieldClass} value={selectedBlock.unverified_category??''} onChange={e=>patchBlock(selectedBlock.id,{unverified_category:e.target.value as Block['unverified_category']||null})}><option value="">없음 / 실사 후 모두 등록함</option>{assetCategories.map(c=><option key={c}>{c}</option>)}</select></label>
          {selectedBlock.unverified_category && <label className="block text-xs">미확인 장비의 사용 상태<select className={fieldClass} value={selectedBlock.unverified_status} onChange={e=>patchBlock(selectedBlock.id,{unverified_status:e.target.value as Block['unverified_status']})}>{useStatuses.map(s=><option key={s}>{s}</option>)}</select></label>}
          <label className="block text-xs">메모<textarea className={fieldClass} value={selectedBlock.note??''} onChange={e=>patchBlock(selectedBlock.id,{note:e.target.value})}/></label>
          <label className="block text-xs">장비·수량품 배정<select className={fieldClass} value="" onChange={e=>{const a=[...data.assets,...data.stocks].find(a=>a.id===e.target.value);if(a)setAssignments(v=>[...v.filter(x=>x.id!==a.id),{id:a.id,kind:'asset_no' in a?'asset':'stock',version:a.version,block_id:selectedBlock.id}])}}><option value="">연결할 장비 선택</option>{[...data.assets,...data.stocks].map(a=><option key={a.id} value={a.id}>{a.name} · {data.blocks.find(b=>b.id===a.block_id)?.name??'미배치'}</option>)}</select></label>
          {[...selectedAssets,...selectedStocks].filter(a=>locationFor(a)===selectedBlock.id).map(a=><div key={a.id} className="flex items-center justify-between gap-2 text-xs"><span>{a.name}</span><button className="shrink-0 text-blue-700" onClick={()=>setAssignments(v=>[...v.filter(x=>x.id!==a.id),{id:a.id,kind:'asset_no' in a?'asset':'stock',version:a.version,block_id:null}])}>미배치로 이동</button></div>)}
          <button className={`${buttonClass} text-red-700`} onClick={()=>{if(!confirm('이 블록을 삭제하고 연결 장비를 미배치로 보존하시겠습니까?'))return;setDraft(v=>v?.filter(b=>b.id!==selectedBlock.id).map(b=>b.parent_id===selectedBlock.id?{...b,parent_id:null}:b)??null);setAssignments(v=>v.filter(a=>a.block_id!==selectedBlock.id));setSelected(null)}}>배치 삭제 · 장비 보존</button>
        </fieldset> : <>
          {person && <section className="space-y-2 rounded-lg bg-slate-50 p-3"><p className="font-semibold">{person.name} {person.title}</p>{person.department&&<p className="text-sm">{person.department}</p>}{person.email&&<p className="break-all text-sm">이메일: {person.email}</p>}<p className="text-sm" aria-live="polite">휴대폰: {phone?.id===person.id && phone.version===person.version ? phone.value : '불러오는 중…'}</p></section>}
          {selectedBlock?.note&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{selectedBlock.note}</p>}
          {selectedBlock&&<p className="text-xs text-slate-500">등록 상태: {selectedBlock.registration} · 수정 {selectedBlock.updated_at.slice(0,10)}</p>}
        </>}
        <section className="space-y-3"><h3 className="text-sm font-semibold">개별 장비 {selectedAssets.length}건</h3>{selectedAssets.map(a=><details key={a.id} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm"><strong>{a.name}</strong><span className="mt-1 block text-xs text-slate-500">{a.asset_no} · {a.status}{a.identity_status==='중복미확정'?' · 중복 확인 필요':''}</span></summary><dl className="mt-3 space-y-2 break-words text-xs">{Object.entries({분류:a.category,모델:a.model,시리얼:a.serial,운영체제:a.os,...a.specs,최종확인일:a.last_checked,메모:a.note}).map(([k,v])=><div key={k}><dt className="text-slate-500">{k}</dt><dd>{v===null?'미등록':String(v)}</dd></div>)}</dl>{isAdmin&&!draft&&<button className={`${buttonClass} mt-3`} onClick={()=>beginItem('asset',a)}>장비 수정</button>}</details>)}{!selectedAssets.length&&<p className="text-sm text-slate-500">등록된 개별 장비 없음</p>}</section>
        <section className="space-y-3"><h3 className="text-sm font-semibold">수량품</h3>{selectedStocks.map(s=><div key={s.id} className="space-y-2 rounded-lg border p-3"><p className="text-sm font-medium">{s.name} {s.specification}</p><StockControl item={s} isAdmin={isAdmin&&!draft} onSaved={refresh}/>{s.note&&<p className="text-xs text-slate-500">{s.note}</p>}{isAdmin&&!draft&&<button className={buttonClass} onClick={()=>beginItem('stock',s)}>품목 수정</button>}</div>)}{!selectedStocks.length&&<p className="text-sm text-slate-500">등록된 수량품 없음</p>}</section>
        {isAdmin && !draft && selectedAssets.length > 0 && <section className="space-y-2 border-t pt-3"><h3 className="text-sm font-semibold">관리자 전용</h3>{selectedAssets.map(a=><div key={a.id} className="flex items-center justify-between gap-2 text-xs"><span className="break-all">{a.name}</span><ManagementEditor assetId={a.id}/></div>)}</section>}
        {isAdmin&&!draft&&<div className="flex gap-2"><button className={buttonClass} onClick={()=>beginItem('asset')}>장비 추가</button><button className={buttonClass} onClick={()=>beginItem('stock')}>수량품 추가</button></div>}
      </div>
    </aside>}
    {editor&&<ItemEditor key={`${editor.kind}:${editor.item?.id??'new'}`} kind={editor.kind} item={editor.item} blockId={selectedBlock?.id??null} blocks={data.blocks} onSaved={refresh} onClose={()=>setEditor(null)}/>}
  </div>
}
