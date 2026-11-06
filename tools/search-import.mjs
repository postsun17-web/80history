import {createHash, randomUUID} from 'node:crypto';
import {mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {extractHwp} from './search-import-hwp.mjs';
import {withTarMembers} from './search-import-tar.mjs';
import {cleanText, extractArticleHtml} from './search-import-text.mjs';

const RESOURCES = 'ypc-chatbot/chatbot/backend/resources';
const CITES = `${RESOURCES}/cites/ypc.json`;
const HWP_FOLDER = `${RESOURCES}/ypc/docs/`;
const HWP_ID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/u;
const ARTICLE_PATH = /^html\/[a-z\d_-]+\.html$/iu;
const EXPECTED_ARTICLES = 224;
const EXPECTED_HWP = 26;
const utf8 = new TextDecoder('utf-8', {fatal: true});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const serialize = (data) => JSON.stringify(data, null, 2) + '\n';
const readJson = (bytes) => JSON.parse(utf8.decode(bytes));
const paragraphsFor = (texts) => texts.map((text, index) => ({id: `p${index + 1}`, text}));

function hwpId(name) {
  if (!name.startsWith(HWP_FOLDER) || !name.endsWith('.hwp')) return undefined;
  const id = name.slice(HWP_FOLDER.length, -4);
  return HWP_ID.test(id) ? id : undefined;
}

function requireText(value, label) {
  const text = typeof value === 'string' ? cleanText(value) : '';
  if (!text) throw new Error(`Missing ${label}`);
  return text;
}

function buildArticles(sourceRoot, inputRoot, documents, sources) {
  const museum = readFileSync(join(sourceRoot, 'src/data/full-museum.json'));
  const reviewed = readFileSync(join(sourceRoot, 'src/data/content-titles.json'));
  const {articles} = readJson(museum);
  const titles = readJson(reviewed).articles;
  const paths = Object.keys(articles).sort();
  if (paths.length !== EXPECTED_ARTICLES) throw new Error(`Expected ${EXPECTED_ARTICLES} registered articles`);
  for (const articlePath of paths) {
    if (!ARTICLE_PATH.test(articlePath)) throw new Error('Invalid registered article path');
    const id = `article:${articlePath}`;
    const entry = titles[articlePath];
    const title = requireText(entry?.title, `reviewed title for ${id}`);
    if (!Array.isArray(entry.sources) || !entry.sources.includes(articlePath)) {
      throw new Error(`Missing reviewed article source for ${id}`);
    }
    const bytes = readFileSync(join(inputRoot, articlePath));
    const {paragraphs, imageAltParagraphs} = extractArticleHtml(utf8.decode(bytes));
    const titleOnly = paragraphs.length === 0;
    if (titleOnly) paragraphs.push(title);
    documents.push({
      id, kind: 'article', title, source: '영락교회 디지털역사관', articlePath, paragraphs: paragraphsFor(paragraphs),
    });
    sources.push({id, sha256: sha256(bytes), paragraphCount: paragraphs.length, imageAltParagraphs, titleOnly});
  }
  return {museumCatalogueSha256: sha256(museum), reviewedTitlesSha256: sha256(reviewed)};
}

function buildHwp(inputRoot, documents, sources) {
  const archive = join(inputRoot, '챗봇', 'ypc-chatbot.20261106.tar');
  return withTarMembers(archive, (name) => name === CITES || hwpId(name) !== undefined, ({members, read}) => {
    const cites = read(CITES);
    const citations = readJson(cites).fname_map;
    const ids = Object.keys(citations).sort();
    if (ids.length !== EXPECTED_HWP || members.size !== EXPECTED_HWP + 1 || ids.some((id) => !HWP_ID.test(id))) {
      throw new Error(`Expected ${EXPECTED_HWP} HWP documents with matching citations`);
    }
    for (const uuid of ids) {
      const id = `hwp:${uuid}`;
      const member = HWP_FOLDER + uuid + '.hwp';
      if (!members.has(member)) throw new Error(`Missing HWP document ${id}`);
      const citation = citations[uuid];
      const title = requireText(citation?.title, `citation title for ${id}`);
      if (typeof citation.chapter_title !== 'string') throw new Error(`Invalid citation chapter for ${id}`);
      const chapter = cleanText(citation.chapter_title);
      const bytes = read(member);
      let extraction;
      try {
        extraction = extractHwp(bytes);
      } catch (error) {
        throw new Error(`Failed to extract ${id}: ${error.message}`, {cause: error});
      }
      const {paragraphs, ...stats} = extraction;
      if (paragraphs.length === 0) throw new Error(`No readable body text in ${id}`);
      const source = chapter ? `${title} · ${chapter}` : title;
      documents.push({id, kind: 'hwp', title, source, ...(chapter && {chapter}), paragraphs: paragraphsFor(paragraphs)});
      sources.push({id, sha256: sha256(bytes), paragraphCount: paragraphs.length, ...stats});
    }
    return {hwpCitationsSha256: sha256(cites)};
  });
}

export function buildSearchCorpus({sourceRoot, inputRoot = dirname(sourceRoot)}) {
  const documents = [];
  const sources = [];
  const articleInputs = buildArticles(sourceRoot, inputRoot, documents, sources);
  const hwpInputs = buildHwp(inputRoot, documents, sources);
  const corpus = {schemaVersion: 1, documents};
  const catalogue = {
    schemaVersion: 1,
    documents: documents.map(({id, paragraphs}) => ({id, paragraphCount: paragraphs.length})),
  };
  const audit = {
    schemaVersion: 1,
    counts: {
      articles: EXPECTED_ARTICLES,
      hwp: EXPECTED_HWP,
      documents: documents.length,
      paragraphs: sources.reduce((sum, {paragraphCount}) => sum + paragraphCount, 0),
      articleTitleOnly: sources.filter(({titleOnly}) => titleOnly).length,
      articleImageAltParagraphs: sources.reduce((sum, {imageAltParagraphs = 0}) => sum + imageAltParagraphs, 0),
      omittedHwpHeaderFooterControls: sources.reduce((sum, {omittedHeaderFooterControls = 0}) => sum + omittedHeaderFooterControls, 0),
      hwpTablesWithCellCoordinates: sources.reduce((sum, {tablesWithCellCoordinates = 0}) => sum + tablesWithCellCoordinates, 0),
      hwpTablesWithSerializedOrder: sources.reduce((sum, {tablesWithSerializedOrder = 0}) => sum + tablesWithSerializedOrder, 0),
    },
    inputSha256: {...articleInputs, ...hwpInputs},
    outputSha256: {corpus: sha256(serialize(corpus)), catalogue: sha256(serialize(catalogue))},
    coverageNotes: [
      'Only registered articles and cited HWP documents are included.',
      'Images and embedded objects are not OCRed. Article captions and useful alt text are retained.',
      'HWP text is extracted from BodyText only. Headers and footers are excluded. Printed page numbers are not inferred.',
      'HWP table cells are ordered by row and column when coordinates are usable. Each cell paragraph stays separate.',
    ],
    documents: sources,
  };
  return {corpus, catalogue, audit};
}

export function writeSearchCorpus(sourceRoot, {corpus, catalogue, audit}) {
  const files = [
    [join(sourceRoot, 'src/search/corpus.json'), corpus],
    [join(sourceRoot, 'src/search/catalogue.json'), catalogue],
    [join(sourceRoot, 'docs/workspace/search-corpus-audit.json'), audit],
  ].map(([target, data]) => ({target, staged: target + '.' + randomUUID() + '.tmp', data}));

  try {
    for (const {target, staged, data} of files) {
      mkdirSync(dirname(target), {recursive: true});
      writeFileSync(staged, serialize(data), {flag: 'wx'});
    }
    for (const {target, staged} of files) renameSync(staged, target);
  } finally {
    for (const {staged} of files) rmSync(staged, {force: true});
  }
}

function main() {
  const {values} = parseArgs({
    options: {'source-root': {type: 'string'}, 'input-root': {type: 'string'}},
  });
  const sourceRoot = resolve(values['source-root'] ?? fileURLToPath(new URL('../', import.meta.url)));
  const inputRoot = values['input-root'] ? resolve(values['input-root']) : dirname(sourceRoot);
  const result = buildSearchCorpus({sourceRoot, inputRoot});
  writeSearchCorpus(sourceRoot, result);
  const {articles, hwp, paragraphs} = result.audit.counts;
  console.log(`Search corpus imported: ${articles} articles, ${hwp} HWP documents, ${paragraphs} paragraphs.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
