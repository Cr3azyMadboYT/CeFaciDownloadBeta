"""Verify JAR/PKCS7 signatures and every entry digest of the actual release AABs."""
import base64
import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile
import zipfile

EXPECTED_CERT = 'd7714280ace4bcb3b37d5738f9334fb1fca9f29ac35024d5d5622d1d26cf853e'


def attributes(section):
    lines = []
    for line in section.decode('utf-8').splitlines():
        if line.startswith(' '):
            assert lines, 'Malformed manifest continuation'
            lines[-1] += line[1:]
        else:
            lines.append(line)
    return dict(line.split(': ', 1) for line in lines if line)


def digest(data):
    return base64.b64encode(hashlib.sha256(data).digest()).decode()


for name in sys.argv[1:] or ['CeFaci-Client', 'CeFaci-Business']:
    assert name in {'CeFaci-Client', 'CeFaci-Business'}, 'Unexpected artifact name'
    path = pathlib.Path('release') / (name + '.aab')
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        assert len(set(names)) == len(names), 'Duplicate archive entries'
        assert z.testzip() is None, 'Archive CRC mismatch'
        blocks = [n for n in names if n.startswith('META-INF/') and n.endswith('.RSA')]
        assert len(blocks) == 1, 'Expected exactly one production signer'
        block = blocks[0]
        sf = z.read(block[:-4] + '.SF')
        manifest = z.read('META-INF/MANIFEST.MF')
        assert attributes(sf.split(b'\r\n\r\n', 1)[0])['SHA-256-Digest-Manifest'] == digest(manifest), 'Manifest signature digest mismatch'
        covered = set()
        for section in manifest.split(b'\r\n\r\n')[1:]:
            if not section.strip():
                continue
            entry = attributes(section)
            assert entry['Name'] not in covered, 'Duplicate signed entry'
            assert entry['SHA-256-Digest'] == digest(z.read(entry['Name'])), 'Signed entry mismatch: ' + entry['Name']
            covered.add(entry['Name'])
        unsigned = [n for n in names if not n.endswith('/') and n not in covered and n not in {block, block[:-4] + '.SF', 'META-INF/MANIFEST.MF'}]
        assert not unsigned, 'Unsigned entries: ' + str(unsigned)
        with tempfile.TemporaryDirectory(prefix='cefaci-aab-verify-') as tmp:
            folder = pathlib.Path(tmp)
            (folder / 'signature.der').write_bytes(z.read(block))
            (folder / 'content.sf').write_bytes(sf)
            subprocess.run(['openssl', 'cms', '-verify', '-inform', 'DER', '-binary', '-noverify', '-in', str(folder / 'signature.der'), '-content', str(folder / 'content.sf'), '-out', str(folder / 'verified.sf')], check=True, capture_output=True)
            assert (folder / 'verified.sf').read_bytes() == sf, 'PKCS7 content mismatch'
            subprocess.run(['openssl', 'pkcs7', '-inform', 'DER', '-in', str(folder / 'signature.der'), '-print_certs', '-out', str(folder / 'certificate.pem')], check=True, capture_output=True)
            certificate = subprocess.run(['openssl', 'x509', '-in', str(folder / 'certificate.pem'), '-outform', 'DER'], check=True, capture_output=True).stdout
            assert hashlib.sha256(certificate).hexdigest() == EXPECTED_CERT, 'Production certificate mismatch'
    print(json.dumps({'aab': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'certificate_sha256': EXPECTED_CERT, 'pkcs7_verified': True, 'verified_entries': len(covered)}))
