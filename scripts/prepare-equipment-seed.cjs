/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS import utility */
// Read source files only. Produces a private, reviewable SQL file; never connects to a DB.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const XLSX = require('xlsx')
const root = path.resolve(__dirname, '..')
const source = path.join(root, '전산운영대장 페이지')
const workbook = XLSX.readFile(path.join(source, '전산운영대장.xlsx'))
const rows = name => XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: null })
const pcs = rows('업무PC').slice(8, 22)
const services = rows('핵심서비스').slice(8, 20)
if (pcs.length !== 14 || pcs.some(r => !r[0]) || services.length !== 12 || services.some(r => !r[1])) throw Error('원본 행 수가 달라졌습니다. 매핑을 다시 검토하세요.')
const id = key => {
 const h = crypto.createHash('sha256').update('equipment-v2:' + key).digest('hex')
 return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`
}
const date = n => { if (typeof n !== 'number') return null; const d = XLSX.SSF.parse_date_code(n); return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` }
const sql = value => value == null ? 'null' : typeof value === 'number' || typeof value === 'boolean' ? String(value) : `'${(typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`
const statements = ['-- Generated from current source workbook and plan v2.0. Contains private business data.', 'begin;']
function insert(table, row, conflict='source_key') {
 statements.push(`insert into public."${table}" (${Object.keys(row).map(k=>`"${k}"`).join(',')}) values (${Object.values(row).map(sql).join(',')}) on conflict (${conflict}) do nothing;`)
}
for (const f of [1,2,3]) insert('장비_층',{id:f,name:`${f}층`,width:1000,height:650},'id')
const blocks = []
function block(key,name,kind,x,y,width,height,floor=2,parent=null,person=null,registration='미등록',note=null) {
 const row={id:id(key),source_key:key,floor_id:floor,name,kind,x,y,width,height,parent_id:parent?id(parent):null,person_id:person?id('person:'+person):null,registration,note,unverified_category:key==='pantry-stock'?'데스크탑':null}
 blocks.push(row); insert('장비_배치',row); return row.id
}
block('office','사무실','구역',10,100,730,530)
block('ceo-room','대표이사실','구역',760,10,230,190)
block('meeting','회의실','구역',760,220,230,190)
block('pantry','탕비실','구역',760,430,230,200)
block('entrance','현관','구역',10,10,220,80)
block('lab','연구실','구역',20,30,590,330,3)
block('storage3','3층 보관 공간','구역',640,30,330,330,3)
// Relative order transcribed from slide1. Independent of scale in the PPTX.
const seats = [
 ['김기태','기사',30,230],['한동근','기사',170,230],['김국진','과장',30,320],['김종인','차장',170,320],
 ['김성훈','차장',30,410],['이한열','부장',170,410],['최정우','부장',30,500],['임재홍','소장',170,500],
 ['신송희','보조',330,250],['정조을','과장',330,360],['김무선','이사',330,500],
 ['이재규','대리',480,230],['조성현','기사',610,230],['김상훈','대리',480,360],['김단후','대리',610,360],
 ['김도윤','차장',480,500],['고운선','과장',610,500],['김명호','대표이사',780,75],['김남규','연구소장',50,100],
]
for (const [name,title,x,y] of seats) {
 insert('장비_인원',{id:id('person:'+name),source_key:'person:'+name,name,title})
 const hasPc=pcs.some(r=>r[1].startsWith(name))
 block('seat:'+name,`${name} ${title}`,'자리',x,y,name==='김명호'?190:120,80,name==='김남규'?3:2,name==='김명호'?'ceo-room':name==='김남규'?'lab':'office',name,hasPc?'일부등록':'미등록',hasPc?null:'대장에 PC 기록 없음 · 실제 장비 유무 확인 필요')
}
block('server','서버 컴퓨터','서버',330,130,170,70,2,'office',null,'일부등록')
block('meeting-pc','회의실 공용 PC','자리',780,280,190,80,2,'meeting',null,'일부등록')
block('scan-pc','북스캔 공용 PC','자리',270,100,200,80,3,'lab',null,'일부등록')
block('pantry-stock','오래된 PC 재고','보관',780,490,190,100,2,'pantry',null,'장비있음','오래된 PC 재고 있음 · 수량/상세 미확인')
block('drawer','공용 서랍 · 임시 위치','서랍',30,130,230,70,2,'office',null,'미등록','실제 위치와 품목·수량 확인 필요')
block('board-office','사무실 전자칠판','벽부착',260,10,270,80,2,null,null,'장비있음','평면도 기록. 현관·3층 기록과 동일 장비인지 확인 필요')
block('board3','보관 전자칠판','보관',670,100,270,100,3,'storage3',null,'장비있음','현관·사무실 기록과 동일 장비인지 확인 필요')
pcs.forEach((r,i)=>{
 const key='pc:'+r[0]
 const location=r[1]==='공용'?(r[2]==='회의실'?'meeting-pc':r[3]==='북스캔'?'scan-pc':'server'):'seat:'+r[1].split(' ')[0]
 const serial=String(r[15]??'').match(/시리얼번호:([^/]+)/)?.[1]?.trim()
 insert('장비_자산',{id:id(key),source_key:key,asset_no:`YJ-PC-${String(i+1).padStart(3,'0')}`,category:'데스크탑',name:r[0],block_id:id(location),model:r[4],serial:serial==='확인 필요'?null:serial,os:r[8],specs:{CPU:r[5],'RAM(GB)':r[6],저장장치:r[7],업무용도:r[3],중요프로그램:r[9],중요자료위치:r[10],백업:r[11],고장시대응:r[13],원본위치:r[2],원본상태:r[12]},last_checked:date(r[14]),note:r[15]})
 insert('장비_자산관리정보',{asset_id:id(key),spec_grade:r[19],replacement_priority:r[22],source:{CPU점수:r[16],RAM점수:r[17],종합점수:r[18],CPU출시연도:r[20],추정사용연수:r[21]}},'asset_id')
})
for (const [category,quantity] of [['모니터',4],['키보드',2],['마우스',3]]) insert('장비_수량품',{source_key:'ceo:'+category,block_id:id('seat:김명호'),category,name:category,quantity,confirmed:true,status:'사용중',note:'사용자 확인 수량 · 모델/규격 선택 상세 미등록'})
for (const [key,location,name,model] of [['entrance','entrance','현관 대형 전자칠판',null],['office','board-office','사무실 전자칠판','LG Create Board'],['storage','board3','3층 보관 전자칠판',null]]) insert('장비_자산',{source_key:'board:'+key,asset_no:`YJ-EB-${String(['entrance','office','storage'].indexOf(key)+1).padStart(3,'0')}`,category:'전자칠판',name,model,block_id:id(location),identity_status:'중복미확정',status:key==='storage'?'재고':'사용중',note:'세 위치 기록의 동일 장비 여부 확인 필요. 확정 총수에서 제외.'})
const physical = {NAS:['NAS','NS'],네트워크:['공유기','RT'],CCTV:['CCTV','CV'],복합기:['복합기','PR']}
services.forEach(r=>{
 let linked=null
 if(physical[r[0]]) {
  const [category,prefix]=physical[r[0]];linked=id('physical:'+category)
  insert('장비_자산',{id:linked,source_key:'physical:'+category,asset_no:`YJ-${prefix}-001`,category,name:r[1],note:'핵심서비스 기록과 연결 · 실제 배치 위치 확인 필요'})
 }
 const raw=r[9],isUsd=typeof raw==='string'&&raw.includes('$')
 const amount=typeof raw==='number'?raw:isUsd?Number.parseFloat(raw):null
 const perPerson=typeof raw==='string'&&raw.includes('/인')
 const users=String(r[17]??'').match(/(?:현재\s*)?(\d+)명/)
 const header=rows('핵심서비스')[7]
 const original=Object.fromEntries(header.map((h,i)=>[h,r[i]]))
 insert('장비_서비스',{source_key:'service:'+r[1],name:r[1],purpose:r[2],vendor:r[3],account_owner:r[4],amount,currency:amount==null?null:isUsd?'USD':'KRW',cycle:r[8],billing_unit:perPerson?'1인':'전체',users:users?Number(users[1]):null,renewal_date:date(r[11]),asset_id:linked,source:original,needs_review:r[1]==='도메인 ③'||r[0]==='AI 구독',note:r[17]})
})
for (const [prefix,value] of [['PC',14],['EB',3],['NS',1],['RT',1],['CV',1],['PR',1]]) statements.push(`insert into public.장비_번호 values('${prefix}',${value}) on conflict(prefix) do update set value=greatest(장비_번호.value,excluded.value);`)
statements.push('select public.equipment_validate_layout();','commit;')
const out=path.join(root,'tmp/equipment')
fs.mkdirSync(out,{recursive:true})
fs.writeFileSync(path.join(out,'seed.sql'),statements.join('\n')+'\n','utf8')
console.log(`Seed prepared only: ${pcs.length} PCs (11 personal / 3 shared), ${seats.length} people, ${services.length} services, ${blocks.length} blocks. tmp/equipment/seed.sql`)
