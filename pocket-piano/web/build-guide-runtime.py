"""Reproduce the web Guide fix from the unchanged, published TeaVM runtime.

The generated TreeSet.add used the key as the TreeMap value. TreeSet.remove
compares its removed value with the shared presence sentinel JJ, so a real
removal returned false. Guide.press then removed a pending note but did not
accept it or advance. Store the same sentinel used by remove, and report a
new entry only when TreeMap.put returned null, as the Java Set contract says.

This patch changes Guide collection semantics only. AudioWorklet and offline
audio continue loading the unchanged formal engine from ../demo/.
"""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
source=root.parent/'demo/native-synth.js'
raw=source.read_bytes().replace(b'\r\n',b'\n');sha=hashlib.sha256(raw).hexdigest()
assert sha=='3fda73348df6e57322ea6c5ff5c2495b8c18fbe93677f229ad9a05f1e3d6d246','Shared engine changed; review the new source before applying this exact patch'
old=b'Fj=(a,b)=>{return Mn(a.ss,b,b)===JJ?0:1;}'
new=b'Fj=(a,b)=>{return Mn(a.ss,b,JJ)===null?1:0;}'
assert raw.count(old)==1,'Published runtime changed; inspect the compiler output before patching'
header=b'/* Web-only TreeSet presence-sentinel correction. Reproduce with build-guide-runtime.py. Shared audio runtime is unchanged. */\n'
result=header+raw.replace(old,new,1)
(root/'native-synth.js').write_bytes(result)
(root/'guide-runtime-provenance.json').write_text(json.dumps({
 'baseline':'../demo/native-synth.js','lineEndings':'canonical LF; Windows checkout CRLF normalized before the exact check','baselineSha256':sha,
 'runtimeSha256':hashlib.sha256(result).hexdigest(),
 'old':old.decode(),'new':new.decode(),
 'reason':'TreeSet.add must store the same presence sentinel consumed by TreeSet.remove and return true only for a new key.',
 'scope':'Main-thread Guide, cursor and score preparation; shared AudioWorklet and offline audio assets unchanged',
 'license':'Project GPL-3.0 and embedded TeaVM Apache-2.0 notices preserved',
},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'baselineSha256':sha,'runtimeSha256':hashlib.sha256(result).hexdigest()}))
