import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {restoreArchive,sha256,validateAssetPath,catalogueSha256} from '../scripts/restore-deploy-assets.mjs';

test('catalogue integrity survives Git line-ending conversion without accepting content changes',()=>{
 assert.equal(catalogueSha256(Buffer.from('{\r\n"title":"영락"\r\n}')),catalogueSha256(Buffer.from('{\n"title":"영락"\n}')));
 assert.notEqual(catalogueSha256(Buffer.from('{"page":1}')),catalogueSha256(Buffer.from('{"page":2}')));
});

test('archive restoration verifies bytes and recreates nested public URLs',async()=>{
 const path='media/full/article/example.html',body=strToU8('<p>원본 전시 내용</p>'),bytes=zipSync({[path]:body});
 const archive={bytes:bytes.length,sha256:sha256(bytes),assets:[{path,bytes:body.length,sha256:sha256(body)}]};
 const root=await mkdtemp(join(tmpdir(),'museum-assets-'));
 try{assert.equal(await restoreArchive(bytes,archive,root),1);assert.deepEqual(new Uint8Array(await readFile(join(root,path))),body);}
 finally{await rm(root,{recursive:true,force:true});}
});
test('archive restoration rejects corrupt downloads and mismatched asset hashes',async()=>{
 const path='media/full/a.webp',body=strToU8('image'),bytes=zipSync({[path]:body});
 const archive={bytes:bytes.length,sha256:sha256(bytes),assets:[{path,bytes:body.length,sha256:'0'.repeat(64)}]};
 await assert.rejects(restoreArchive(bytes,archive,'.'),/Asset integrity mismatch/);
 await assert.rejects(restoreArchive(bytes,{...archive,sha256:'1'.repeat(64)},'.'),/Archive integrity mismatch/);
});
test('archive restoration rejects traversal, unexpected entries and omissions',async()=>{
 for(const path of ['../outside','media/full/../../outside','media/full/./x','media/full\\x','/media/full/a'])assert.throws(()=>validateAssetPath(path),/Unsafe/);
 const path='media/full/a.webp',body=strToU8('image');
 const asset={path,bytes:body.length,sha256:sha256(body)};
 const extra=zipSync({[path]:body,'media/full/unlisted.webp':body});
 await assert.rejects(restoreArchive(extra,{bytes:extra.length,sha256:sha256(extra),assets:[asset]},'.'),/Unexpected ZIP entry/);
 const missing=zipSync({});
 await assert.rejects(restoreArchive(missing,{bytes:missing.length,sha256:sha256(missing),assets:[asset]},'.'),/missing required/);
});
