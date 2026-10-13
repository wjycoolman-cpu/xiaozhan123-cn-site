"""Reconstruct a release ZIP as data. Never extracts or executes application files.

Usage: python apply.py BASE.zip UPDATE.delta.zip OUTPUT.zip
"""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import zipfile

CHUNK = 1024 * 1024
MAX_SIZE = 16 * 1024**3


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as source:
        while chunk := source.read(CHUNK):
            digest.update(chunk)
    return digest.hexdigest()


def integer(value, name):
    if type(value) is not int or not 0 <= value <= MAX_SIZE:
        raise ValueError('Invalid ' + name)
    return value


def digest_string(value):
    if not isinstance(value, str) or len(value) != 64 or any(c not in '0123456789abcdef' for c in value):
        raise ValueError('Invalid SHA256')
    return value


def read_manifest(archive):
    names = archive.namelist()
    if len(names) != len(set(names)) or names.count('manifest.json') != 1 or names.count('payload.bin') != 1:
        raise ValueError('Missing or duplicate patch entries')
    entry = archive.getinfo('manifest.json')
    if entry.file_size > 16 * 1024**2:
        raise ValueError('Manifest too large')
    data = json.loads(archive.read(entry))
    if not isinstance(data, dict) or data.get('format') != 'subtitle-studio-raw-zip-delta/v1':
        raise ValueError('Unsupported patch format')
    for key in ('base', 'target', 'payload'):
        meta = data.get(key)
        if not isinstance(meta, dict):
            raise ValueError('Missing ' + key + ' metadata')
        integer(meta.get('bytes'), key + ' size')
        digest_string(meta.get('sha256'))
    if archive.getinfo('payload.bin').file_size != data['payload']['bytes']:
        raise ValueError('Payload size mismatch')
    operations = data.get('operations')
    if not isinstance(operations, list) or len(operations) > 100000:
        raise ValueError('Invalid operations')
    target_size = 0
    inserted = 0
    for op in operations:
        if not isinstance(op, list) or len(op) != 3 or op[0] not in ('copy', 'insert'):
            raise ValueError('Invalid operation')
        offset = integer(op[1], 'offset')
        length = integer(op[2], 'length')
        if length == 0:
            raise ValueError('Empty operation')
        size = data['base' if op[0] == 'copy' else 'payload']['bytes']
        if offset > size or length > size - offset:
            raise ValueError('Operation exceeds source bounds')
        if op[0] == 'insert':
            if offset != inserted:
                raise ValueError('Payload operations must be sequential')
            inserted += length
        target_size += length
        if target_size > data['target']['bytes']:
            raise ValueError('Operations exceed target size')
    if target_size != data['target']['bytes'] or inserted != data['payload']['bytes']:
        raise ValueError('Operations do not cover declared sizes')
    return data


def apply(base_path, delta_path, output_path):
    base = Path(base_path).resolve(strict=True)
    delta = Path(delta_path).resolve(strict=True)
    output = Path(output_path).resolve()
    if output in (base, delta) or output.exists():
        raise ValueError('Output must be a new path, distinct from inputs')
    if not output.parent.is_dir():
        raise ValueError('Output folder does not exist')
    temporary = None
    with zipfile.ZipFile(delta) as patch:
        manifest = read_manifest(patch)
        if base.stat().st_size != manifest['base']['bytes'] or sha256_file(base) != manifest['base']['sha256']:
            raise ValueError('Base ZIP size or SHA256 does not match')
        payload_digest = hashlib.sha256()
        with patch.open('payload.bin') as source:
            while chunk := source.read(CHUNK):
                payload_digest.update(chunk)
        if payload_digest.hexdigest() != manifest['payload']['sha256']:
            raise ValueError('Payload SHA256 mismatch')
        try:
            with tempfile.NamedTemporaryFile(mode='wb', dir=output.parent, prefix='.' + output.name + '-', suffix='.part', delete=False) as destination:
                temporary = Path(destination.name)
                target_digest = hashlib.sha256()
                with base.open('rb') as old, patch.open('payload.bin') as payload:
                    for kind, offset, length in manifest['operations']:
                        source = old if kind == 'copy' else payload
                        if kind == 'copy':
                            old.seek(offset)
                        remaining = length
                        while remaining:
                            chunk = source.read(min(CHUNK, remaining))
                            if not chunk:
                                raise ValueError('Unexpected end of patch source')
                            destination.write(chunk)
                            target_digest.update(chunk)
                            remaining -= len(chunk)
                destination.flush()
                os.fsync(destination.fileno())
            if temporary.stat().st_size != manifest['target']['bytes'] or target_digest.hexdigest() != manifest['target']['sha256']:
                raise ValueError('Reconstructed ZIP size or SHA256 mismatch')
            # Publish verified bytes atomically, refusing an existing output even if it
            # appeared while rebuilding. The temporary file is on the same filesystem.
            # NTFS/ext4/APFS support hard links; an unsupported destination fails closed.
            os.link(temporary, output)
            return {'bytes': manifest['target']['bytes'], 'sha256': target_digest.hexdigest(), 'output': str(output)}
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit('Usage: python apply.py BASE.zip UPDATE.delta.zip OUTPUT.zip')
    try:
        print(json.dumps(apply(*sys.argv[1:]), ensure_ascii=False))
    except (ValueError, OSError, zipfile.BadZipFile, KeyError, TypeError) as error:
        raise SystemExit('Patch rejected: ' + str(error))
