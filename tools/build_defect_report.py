"""Package the verified source audit and actual browser captures as a portable HTML report."""
from pathlib import Path
import argparse
import html
import json
import shutil

PROJECT = Path(__file__).resolve().parents[1]
AUDIT = Path('E:/CodexAssets/youngnak-defect-reaudit')
ESC = html.escape
RECOVERIES = {
    'c03:7': ('동일 사진 연결', '총회장 기념촬영', 'c03-01:1', '제목·날짜·전시판 사진이 일치합니다.'),
    'c03:8': ('동일 사진 연결', 'WCC 지도자 예방', 'c03-01:2', '전시판과 같은 사진입니다. 전시판 1976년 / 보충 XML 1991년의 날짜 불일치는 미확정이며 웹페이지에도 표시했습니다.'),
    'c03:9': ('주제 사진 묶음', '한국기독교연합회 활동', 'c03-01:3–5 (3장)', '무제목 “추가 전달” 슬롯을 5페이지의 관련 사진으로 보강했습니다. 미전달 원사진과의 일대일 복원을 뜻하지 않습니다.'),
    'c03:10': ('주제 사진 묶음', '전국복음화운동', 'c03-01:6–8 (3장)', '무제목 “추후 전달” 슬롯을 6페이지의 관련 사진으로 보강했습니다. 미전달 원사진과의 일대일 복원을 뜻하지 않습니다.'),
    'c03:12': ('동일 포스터 연결', '빌리 그래함 한국전도대회 포스터', 'c03-01:9', '실제 포스터 이미지와 전시판의 확대 버튼 연결을 확인했습니다.'),
    'c03:16': ('주제 사진 묶음', '한국기독교 100주년 행사', 'c03-02:0–4 (5장)', '9페이지의 “더 많은 사진” 버튼이 연결한 갤러리입니다. 예전 파일명에 적힌 8장 전체를 복원한 것은 아닙니다.'),
}


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def figure(path, caption):
    return f'<figure><a href="{ESC(path)}" target="_blank"><img src="{ESC(path)}" alt="{ESC(caption)}" loading="lazy"></a><figcaption>{ESC(caption)}</figcaption></figure>'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    mapping = load(PROJECT / '.cache/defect-screen-map.json')
    capture = load(AUDIT / 'screenshots/capture-evidence.json')
    before = {x['id']: x for x in capture['captures'] if x['kind'] == 'before'}
    after = {x['id']: x for x in capture['captures'] if x['kind'] == 'after'}
    assert len(before) == 20, 'All twenty original blank states must be captured'
    assert set(RECOVERIES).issubset(after), 'All six production recoveries must be captured'
    screenshots = out / 'screenshots'
    shutil.copytree(AUDIT / 'screenshots', screenshots, dirs_exist_ok=True)
    evidence = out / 'evidence'
    evidence.mkdir(exist_ok=True)
    for name in ['defect-reaudit-raw.json', 'defect-alternate-search.json', 'defect-alternate-search.md', 'defect-screen-map.json']:
        shutil.copy2(PROJECT / '.cache' / name, evidence / name)
    shutil.copy2(PROJECT / 'docs/source-blank-evidence.json', evidence / 'source-blank-evidence.json')
    detail = (PROJECT / 'docs/SOURCE-DEFECTS.md').read_text(encoding='utf-8').replace('(source-reaudit/', '(evidence/').replace('(source-blank-evidence.json)', '(evidence/source-blank-evidence.json)')
    (out / '결손재검증_상세.md').write_text(detail, encoding='utf-8')
    original = Path('C:/Users/user/.agent-browser/tmp/screenshots/screenshot-1791094313255.png')
    if original.exists():
        shutil.copy2(original, screenshots / 'original-c03-7.png')

    cards = []
    rows = []
    for item in sorted(mapping['items'], key=lambda x: (x['id'] not in RECOVERIES, x['gallery'], x['index'])):
        id = item['id']
        slug = id.replace(':', '-')
        restored = id in RECOVERIES
        badge, title, target, explanation = RECOVERIES.get(id, (
            '빈 슬롯 유지', item['itemTitle'].strip() or '제목 없는 빈 항목', '추가 사진 필수 요청 대상 아님',
            '원본 이미지가 순백색이고 활성 전시 버튼에서 직접 연결하지 않습니다. 특정 역사 사진의 누락이라는 근거가 없어 구조용 공백으로 분류했습니다. 제작자의 의도까지 확정한 것은 아닙니다.'))
        context = item['recommendedCaptureContext']
        context_path = f"screenshots/panels/{context['zone']}-page-{context['page']:02d}.png"
        if not (out / context_path).exists():
            # Early capture versions used unpadded page numbers.
            context_path = f"screenshots/panels/{context['zone']}-page-{context['page']}.png"
        assert (out / context_path).exists(), context_path
        route = item['recommendedGalleryEntry']
        direction = '다음' if route['direction'] == 'next' else '이전'
        navigation = f"{route['zone'].upper()} {route['page']}페이지 → 확대 사진 {route['galleryItemId']} → {direction} {route['clicks']}회"
        images = figure(f'screenshots/before/{slug}.png', '보강 전 빈 영역 · 빨간 테두리는 검수용 표시')
        if restored:
            images += figure(f'screenshots/after/{slug}.png', '보강 후 · 기존 Vercel 주소의 실제 화면')
        images += figure(context_path, f"관련 전시판: {context['zone'].upper()} {context['page']}페이지 · 전시판 자체의 결손을 뜻하지 않음")
        extra = ''
        if id == 'd01:16':
            extra = '<p>주석 처리된 과거 버튼에는 할렐루야찬양대 연결 흔적이 있습니다. 해당 주제 사진은 기사 본문에도 있어 내용 자체의 결손은 아닙니다.</p>'
        cards.append(f'''<article id="{slug}" data-kind="{'restored' if restored else 'blank'}">
<div class="card-top"><span class="badge {'green' if restored else 'amber'}">{ESC(badge)}</span><span class="id">{ESC(id)} · 목록 {item['displayPosition']}/{item['galleryLength']}</span></div>
<h3>{ESC(title)}</h3><p>{ESC(explanation)}</p>{extra}
<p><strong>처리:</strong> {ESC(target)}</p>
<dl><dt>전시</dt><dd>{ESC(item['galleryTitle'])}</dd><dt>원본 장면</dt><dd>{ESC(item['sourceScene'])}</dd><dt>빈 원본 위치</dt><dd><code>{ESC(item['sourceFile'])}</code></dd><dt>기존 접근 동선</dt><dd>{ESC(navigation)}</dd></dl>
<div class="links"><a href="{ESC(item['blankUrl'])}" target="_blank" rel="noopener">현재 웹페이지 열기 ↗</a><a href="{ESC(context['panelUrl'])}" target="_blank" rel="noopener">관련 전시판 열기 ↗</a></div>
<div class="figures">{images}</div></article>''')
        rows.append(f'<tr><td><a href="#{slug}">{ESC(id)}</a></td><td>{ESC(title)}</td><td>{ESC(badge)}</td><td>{ESC(target)}</td></tr>')

    summary = '''<p class="eyebrow">영락교회 디지털역사관 · 2026.10.04 재검증</p>
<h1>빈 원본은 20개,<br>내용 결손과는 구분했습니다.</h1>
<p class="lead">이전의 “C03 사진 6건 누락” 판정을 수정합니다. 전달받은 다른 폴더에 같은 사진과 관련 전시 자료가 있었습니다. <strong>동일 자료 3개를 연결하고, 3개 위치는 주제 사진 묶음으로 보강</strong>했습니다.</p>
<div class="stats"><div><b>3</b><span>동일 사진·포스터 연결</span></div><div><b>3</b><span>관련 사진 묶음 연결</span></div><div><b>14</b><span>남은 빈 슬롯</span></div><div><b>0</b><span>필수 사진 추가 요청</span></div></div>
<p class="callout">14개는 원본의 빈 내용이 확정된 슬롯입니다. 제목이나 직접 연결이 없어 특정 역사 사진의 누락으로 확정할 수는 없습니다. “관련 내용이 대략 존재하면 있음으로 판단”한다는 요청 기준을 적용했습니다.</p>
<p>모든 빈 슬롯은 전시판 버튼의 직접 목적지가 아니며, 사진 목록의 이전·다음 탐색에서 만납니다. 캡처의 빨간 영역은 <strong>사진 팝업의 빈 자리</strong>입니다. 함께 제시한 전시판은 위치를 설명하기 위한 정상 화면입니다.</p>'''
    method = '''<section class="method"><h2>확인 범위와 남은 확인 사항</h2>
<p>ZIP 목록 138,650개 경로와 원문 텍스트 366개, 전달 폴더 77,906개 경로를 대조했습니다. 원본 ZIP에서 244개 파일(139,913,182바이트)을 직접 읽어 크기·CRC를 검증하고 SHA-256을 기록했습니다. 빈 슬롯 20개에 해당하는 핵심 이미지 204개는 모두 순백색이었습니다. 최고·하위 해상도, 미리보기, 썸네일, 대응 원사진과 양쪽 eye를 포함합니다.</p>
<p>전체 ZIP을 완전히 풀거나 모든 PSD 레이어·중첩 master.zip까지 열어 검사한 것은 아닙니다. 핵심 검사 완료 후 추가 후보를 읽다가 Google Drive 공간 오류가 발생해 후보 2개는 직접 읽기를 완료하지 못했습니다. 이는 파일 결손 판정에 포함하지 않았습니다. 추출한 244개 파일은 E:\\CodexAssets\\youngnak-defect-reaudit\\raw\\zip 에 보존했습니다.</p>
<p><strong>선택적으로 업체에 확인할 내용:</strong> 제목 없는 14개 빈 슬롯의 제작 의도, WCC 지도자 예방 사진의 1976.6.16 / 1991.6.16 날짜 불일치. 현재 전시 보강에 필요한 추가 사진 납품 요청은 없습니다.</p>
<p><a href="결손재검증_상세.md">상세 판정과 업체 최소 확인안</a> · <a href="evidence/defect-reaudit-raw.json">원본 픽셀·CRC 증거</a> · <a href="evidence/defect-alternate-search.json">대체 자료 검색 근거</a> · <a href="evidence/defect-screen-map.json">원본 연결 지도</a> · <a href="screenshots/capture-evidence.json">캡처 시각·URL·표시 기록</a></p>
<p class="small">스크린샷은 실제 브라우저에서 촬영했습니다. 빨간 테두리와 검수 라벨만 캡처 전에 화면에 추가했고, 원사진을 합성하거나 생성하지 않았습니다. 캡처를 클릭하면 원본 크기로 열립니다. 웹페이지 링크는 현재 배포 상태를 보여 주므로 수정 전 상태는 저장된 캡처로 확인하십시오.</p></section>'''
    if original.exists():
        method += '<details><summary>기존 운영 사이트의 원본 빈 화면도 확인</summary><p>운영 사이트의 c03 사진 목록 index 7 / scene_08 역시 흰 화면입니다. 화면 아래의 사진 제목만 표시됩니다. 이 파일은 빈 상태이지만, 전달 자료의 다른 갤러리에서 동일 사진을 찾아 시범 사이트에 연결했습니다.</p>' + figure('screenshots/original-c03-7.png', '기존 운영 사이트 · 한경직 목사 총회장 기념촬영의 빈 화면') + '</details>'
    page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>영락역사관 · 결손 재검증 및 보강 화면</title>
<style>*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{margin:0;background:#f3f4f0;color:#1e3534;font:16px/1.75 "Malgun Gothic",sans-serif}}main{{max-width:1280px;margin:auto;padding:48px 28px}}h1{{font-size:46px;letter-spacing:-2px;line-height:1.25;margin:16px 0 24px}}h2{{font-size:27px;margin-top:38px}}h3{{font-size:22px;margin:13px 0}}a{{color:#24655a;text-underline-offset:4px}}.eyebrow{{letter-spacing:.08em;font-size:13px;color:#667c73}}.lead{{max-width:900px;font-size:19px}}.stats{{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:30px 0}}.stats>div{{background:#173d38;color:white;padding:22px;border-radius:12px}}.stats b{{font-size:43px;display:block;line-height:1.2}}.stats span{{font-size:14px}}.callout{{background:#fff2d7;padding:20px;border-left:4px solid #bf9042}}table{{width:100%;border-collapse:collapse;background:white;font-size:14px}}td,th{{padding:12px;text-align:left;border-bottom:1px solid #e1e7e0}}th{{background:#e6ece5}}.table-wrap{{overflow:auto}}nav{{position:sticky;top:0;padding:12px;background:#f3f4f0f2;z-index:2;border-bottom:1px solid #ccd6cb}}nav button{{font:inherit;background:white;color:#204d44;border:1px solid #bccfc1;padding:8px 18px;margin:4px;border-radius:24px;cursor:pointer}}nav button[aria-pressed=true]{{background:#204d44;color:white}}article{{background:white;margin:24px 0;border:1px solid #d8e0d5;border-radius:12px;padding:26px;scroll-margin-top:90px}}.card-top{{display:flex;gap:15px;align-items:center;justify-content:space-between;flex-wrap:wrap}}.badge{{border-radius:20px;padding:5px 12px;font-size:13px;font-weight:bold}}.green{{background:#dceee5;color:#1d5a3e}}.amber{{background:#fff0cf;color:#7a551e}}.id{{font-size:13px;color:#6c786e}}dl{{display:grid;grid-template-columns:130px 1fr;gap:5px;font-size:14px}}dt{{color:#788579}}dd{{margin:0;overflow-wrap:anywhere}}code{{font-size:12px}}.links{{display:flex;gap:25px;margin:18px 0;font-size:14px;flex-wrap:wrap}}.figures{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}}figure{{margin:0}}figure img{{display:block;width:100%;border:1px solid #d3dcd1;background:#e8ece5;border-radius:5px}}figcaption{{font-size:12px;color:#667565;margin:8px 0 4px}}.method{{border-top:2px solid #b6c4b8;margin-top:45px;padding:10px 0}}.small{{font-size:13px;color:#6c786e}}[hidden]{{display:none!important}}@media(max-width:680px){{main{{padding:24px 15px}}h1{{font-size:32px}}.stats{{grid-template-columns:1fr 1fr;gap:10px}}.stats>div{{padding:16px}}.figures{{grid-template-columns:1fr}}article{{padding:18px}}dl{{grid-template-columns:1fr}}dt{{margin-top:8px}}nav{{white-space:nowrap;overflow:auto}}nav button{{padding:6px 12px;font-size:13px}}}}@media print{{nav{{display:none}}article{{break-inside:avoid}}body{{background:white}}main{{padding:0}}.figures{{grid-template-columns:1fr 1fr}}}}</style>
<main>{summary}<h2>판정 목록</h2><div class="table-wrap"><table><thead><tr><th>항목</th><th>내용</th><th>판정·처리</th><th>연결한 자료</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
<h2>실제 화면으로 확인</h2><nav aria-label="캡처 분류"><button data-filter="all" aria-pressed="true">전체 20항목</button><button data-filter="restored" aria-pressed="false">보강한 C03 6항목</button><button data-filter="blank" aria-pressed="false">남은 공백 14항목</button></nav>{''.join(cards)}{method}</main>
<script>document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{{document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('article').forEach(x=>x.hidden=b.dataset.filter!=='all'&&x.dataset.kind!==b.dataset.filter)}}));document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{{document.querySelector('[data-filter="all"]').click()}}));</script></html>'''
    (out / 'index.html').write_text(page, encoding='utf-8')
    print(json.dumps({'report': str(out / 'index.html'), 'items': len(cards), 'screenshots': len(list(screenshots.rglob('*.png')))}, ensure_ascii=False))


if __name__ == '__main__':
    main()
