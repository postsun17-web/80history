import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {extractArticleHtml} from '../tools/search-import-text.mjs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url));
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const workspaceMarker = new URL('../.museum-workspace.json', import.meta.url);

test('extracts museum article content, figure captions, useful image alt text and distinct table cells', () => {
  const html = `<!doctype html><head><title>템플릿</title></head><body>
    <header>겉머리</header>
    <main>
      <article><p>신앙 <em>공동체</em>&nbsp;信仰</p><p>교회 &amp; 학교 &#x654E;</p>
        <script>잘못된 본문</script><style>.prose { content: "서식"; }</style>
        <table><tr><th>교회</th><td>학교</td></tr></table></article>
      <figure><img alt="같은 사진" src="image.jpg"><figcaption>사진 설명</figcaption></figure>
      <figure><img alt="독립 자료 사진" src="other.jpg"></figure>
      <img src="plain.jpg" alt="사진 2">
    </main><footer>꼬리말</footer></body>`;
  assert.deepEqual(extractArticleHtml(html), {
    paragraphs: ['신앙 공동체 信仰', '교회 & 학교 敎', '교회', '학교', '사진 설명', '독립 자료 사진'],
    imageAltParagraphs: 1,
  });
});

test('shipped corpus, catalogue and audit cover all sources with stable ids and hashes', () => {
  const corpusBytes = read('../src/search/corpus.json');
  const catalogueBytes = read('../src/search/catalogue.json');
  const {schemaVersion, documents} = JSON.parse(corpusBytes.toString('utf8'));
  const catalogue = JSON.parse(catalogueBytes.toString('utf8'));
  const auditPath = 'docs/workspace/search-corpus-audit.json';
  // The wrapper mirrors runtime code and tests. The audit lives with the editing source.
  const audit = JSON.parse(existsSync(workspaceMarker)
    ? readFileSync(join(JSON.parse(readFileSync(workspaceMarker, 'utf8')).sourceRoot, auditPath), 'utf8')
    : read('../' + auditPath).toString('utf8'));
  const articles = JSON.parse(read('../src/data/full-museum.json').toString('utf8')).articles;
  const reviewed = JSON.parse(read('../src/data/content-titles.json').toString('utf8')).articles;
  assert.equal(schemaVersion, 1);
  assert.equal(documents.length, 250);
  assert.equal(new Set(documents.map(({id}) => id)).size, 250);
  assert.deepEqual(documents.map(({id}) => id), documents.map(({id}) => id).sort());
  assert.deepEqual(documents.filter(({kind}) => kind === 'article').map(({articlePath}) => articlePath), Object.keys(articles).sort());
  assert.equal(documents.filter(({kind}) => kind === 'hwp').length, 26);
  assert.equal(catalogue.schemaVersion, schemaVersion);
  assert.deepEqual(catalogue.documents, documents.map(({id, paragraphs}) => ({id, paragraphCount: paragraphs.length})));
  assert.deepEqual(audit.documents.map(({id, paragraphCount}) => ({id, paragraphCount})), catalogue.documents);
  assert.equal(audit.counts.documents, documents.length);
  assert.equal(audit.counts.paragraphs, documents.reduce((total, {paragraphs}) => total + paragraphs.length, 0));
  assert.equal(audit.outputSha256.corpus, sha256(corpusBytes));
  assert.equal(audit.outputSha256.catalogue, sha256(catalogueBytes));
  for (const doc of documents) {
    assert.ok(doc.source.trim() && doc.title.trim() && doc.paragraphs.length > 0);
    if (doc.kind === 'article') {
      assert.equal(doc.id, 'article:' + doc.articlePath);
      assert.equal(doc.title, reviewed[doc.articlePath].title.trim());
    } else {
      assert.match(doc.id, /^hwp:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/u);
      assert.equal(doc.source, doc.chapter ? `${doc.title} · ${doc.chapter}` : doc.title);
    }
    for (const [index, {id, text}] of doc.paragraphs.entries()) {
      assert.equal(id, `p${index + 1}`);
      assert.equal(text, text.trim());
      assert.ok(text && !/[\u0000-\u001f\ufffd]/u.test(text));
    }
  }
});

test('actual samples retain historical narrative, figure captions, citation metadata and Hanja', () => {
  const {documents} = JSON.parse(read('../src/search/corpus.json').toString('utf8'));
  const article = documents.find(({id}) => id === 'article:html/a02_02.html');
  assert.equal(article.title, '서북지역 신앙공동체의 형성과 한글 성경 보급');
  assert.ok(article.paragraphs.some(({text}) => text.includes('로스가 안식년으로 떠나자')));
  assert.ok(article.paragraphs.some(({text}) => text === '로스의 〈누가복음〉(1882)'));
  const hwp = documents.find(({id}) => id === 'hwp:1def5d05-b28c-4289-bb82-3b586f47666b');
  assert.equal(hwp.source, '영락교회 50년사 · 제1단원');
  assert.ok(hwp.paragraphs.some(({text}) => /\p{Script=Han}/u.test(text)));
});
