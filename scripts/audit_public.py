"""Scan Git publication candidates without printing matched credential values.

Standard-library only; includes tracked AND untracked non-ignored files. This
is a bounded pattern scan, not a proof that every possible secret is absent.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
RULES = {
    'private-key': re.compile(r'-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----'),
    'github-token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b'),
    'aws-access-key': re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'slack-token': re.compile(r'\bxox[baprs]-[A-Za-z0-9-]{20,}\b'),
    'openai-token': re.compile(r'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b'),
    'credential-url': re.compile(r'(?i)https?://[^\s/:@]+:[^\s/@]{4,}@'),
    'credential-literal': re.compile(r'''(?ix)\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|passwd)\b["']?\s*[:=]\s*["']([A-Za-z0-9_+/=.-]{16,})["']'''),
    'personal-home-path': re.compile(r'(?i)(?:[A-Z]:[\\/]+Users[\\/]+[^\s\\/"\x27]+|/(?:Users|home)/[^\s/"\x27]+)'),
}
SENSITIVE_SUFFIXES = {'.pem', '.key', '.pfx', '.p12', '.keystore', '.jks'}


def findings_for_text(text):
    findings = []
    for rule, pattern in RULES.items():
        for match in pattern.finditer(text):
            value = match.group(0)
            if rule == 'credential-literal':
                literal = match.group(1)
                # Explicit public documentation placeholders, never arbitrary hashes.
                if literal.lower().startswith(('example', 'placeholder', 'your_')):
                    continue
            findings.append({'rule': rule, 'line': text.count('\n', 0, match.start()) + 1,
                             'fingerprint': hashlib.sha256(value.encode()).hexdigest()[:12]})
    return findings


def public_files():
    result = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
                            cwd=ROOT, check=True, capture_output=True)
    return sorted({p.decode('utf-8') for p in result.stdout.split(b'\0') if p})


def scan():
    findings, binaries, inventory = [], [], []
    text_count = 0
    for name in public_files():
        path = ROOT / name
        if path.is_symlink():
            findings.append({'path': name, 'rule': 'symlink-review'})
            continue
        if not path.is_file():
            continue
        data = path.read_bytes()
        inventory.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        if len(data) >= 100 * 2**20:
            findings.append({'path': name, 'rule': 'git-file-size-limit'})
        if path.suffix.lower() in SENSITIVE_SUFFIXES or (path.name.startswith('.env') and path.name != '.env.example') or path.name in {'id_rsa', 'id_ed25519', '.npmrc', '.pypirc'}:
            findings.append({'path': name, 'rule': 'credential-file-name'})
        if b'\0' in data[:8192]:
            binaries.append(name)
            continue
        try:
            content = data.decode('utf-8-sig')
        except UnicodeDecodeError:
            binaries.append(name)
            continue
        text_count += 1
        findings.extend({'path': name, **finding} for finding in findings_for_text(content))
    return {'scope': 'git ls-files --cached --others --exclude-standard; current working files, no history',
            'files': len(inventory), 'text_files_scanned': text_count,
            'bytes': sum(p['bytes'] for p in inventory), 'findings': findings,
            'binary_files_for_separate_review': binaries,
            'limitations': ['Pattern matching cannot prove absence of all credentials or personal data.',
                            'Binary pixels, font payloads and ignored local files are not scanned as text.',
                            'Third-party public attribution is retained; no claim of legal certification.'],
            'inventory': inventory}


def self_test():
    samples = {
        'private-key': '-----BEGIN ' + 'PRIVATE KEY-----',
        'github-token': 'ghp_' + 'A' * 36,
        'aws-access-key': 'AKIA' + 'A' * 16,
        'slack-token': 'xoxb-' + 'a' * 30,
        'openai-token': 'sk-proj-' + 'a' * 48,
        'credential-url': 'https://' + 'user:secretvalue@example.invalid',
        'credential-literal': 'api_key = "' + 'testcredential123456' + '"',
        'personal-home-path': 'C:/' + 'Users/TestPerson/private.json',
    }
    for rule, sample in samples.items():
        assert any(item['rule'] == rule for item in findings_for_text(sample)), rule
    assert not findings_for_text('sha256=' + 'a' * 64 + '\nhttp://127.0.0.1:1420/\npassword = "YOUR_PASSWORD_EXAMPLE"')
    assert 'secretvalue' not in json.dumps(findings_for_text(samples['credential-url']))
    print('8 detector families and redacted reporting self-test passed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/public-audit.json')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
    else:
        report = scan()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps({k: v for k, v in report.items() if k not in {'inventory', 'limitations', 'binary_files_for_separate_review'}}, ensure_ascii=True))
        sys.exit(bool(report['findings']))
