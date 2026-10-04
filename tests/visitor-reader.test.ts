import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReaderUrl,readerArticlePath} from '../src/visitor-reader-utils.ts';
test('reader rejects executable and protocol-relative image URLs',()=>{
 for(const url of ['javascript:alert(1)','data:image/svg+xml,evil','//evil.test/x','/media/full/\\evil','https://a.test/\nimage'])assert.equal(safeReaderUrl(url),null);
 assert.equal(safeReaderUrl('/media/full/html/image.jpg.webp'),'/media/full/html/image.jpg.webp');
 assert.equal(safeReaderUrl('https://example.org/photo.jpg'),'https://example.org/photo.jpg');
});
test('direct article selection resolves inert JSON only',()=>{
 assert.equal(readerArticlePath(JSON.stringify({type:'article',path:'%FIRSTXML%/html/a01.html'})),'html/a01.html');
 for(const value of ['alert(1)',JSON.stringify({type:'image',src:'html/a01.html'}),JSON.stringify({type:'article',path:5}),undefined])assert.equal(readerArticlePath(value),undefined);
});
