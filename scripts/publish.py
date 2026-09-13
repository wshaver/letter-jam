"""Publish Letter Jam to willshaver.com/letterjam using versioned SFTP releases.

Setup: python -m pip install --target .deploy-tools paramiko==5.0.0
Credentials: ignored .env.deploy.json (host, username, password).
Host key: ignored .deploy/known_hosts, copied from a trusted deployment.
Inspect: python scripts/publish.py --inspect
Publish: npm run publish:letterjam
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import posixpath
import secrets
import shlex
import stat
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
PRIVATE = ROOT / '.deploy'
URL = 'https://willshaver.com/letterjam/'
sys.path.insert(0, str(ROOT / '.deploy-tools'))


def run(ssh, command):
    _, stdout, stderr = ssh.exec_command(command, timeout=120)
    output, error = stdout.read().decode(), stderr.read().decode()
    if stdout.channel.recv_exit_status():
        raise RuntimeError('Remote operation failed: ' + error[:400])
    return output.strip()


def mkdirs(sftp, path):
    try:
        sftp.stat(path)
    except FileNotFoundError:
        mkdirs(sftp, posixpath.dirname(path))
        sftp.mkdir(path)


def exists(sftp, path):
    try:
        return sftp.lstat(path)
    except FileNotFoundError:
        return None


def verify(files):
    for path, expected in files.items():
        if path == '.htaccess':
            continue
        request = urllib.request.Request(URL + ('' if path == 'index.html' else path),
                                         headers={'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(request, timeout=45) as response:
            if response.status != 200 or hashlib.sha256(response.read()).digest() != hashlib.sha256(expected).digest():
                raise RuntimeError('Live file differs from this release: ' + path)
    # The canonical slash matters for Vite's relative asset and sprite URLs.
    with urllib.request.urlopen(URL.rstrip('/'), timeout=45) as response:
        if response.geturl() != URL:
            raise RuntimeError('The non-slash URL did not redirect to /letterjam/.')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inspect', action='store_true')
    args = parser.parse_args()
    cfg = json.loads((ROOT / '.env.deploy.json').read_text())
    if not all(isinstance(cfg.get(k), str) and cfg[k] for k in ('host', 'username', 'password')):
        raise RuntimeError('Deployment configuration needs host, username and password.')
    PRIVATE.mkdir(exist_ok=True)
    known_hosts = PRIVATE / 'known_hosts'
    if not known_hosts.exists():
        raise RuntimeError('Install the verified SSH host key in .deploy/known_hosts first.')
    files = {}
    if not args.inspect:
        npm = 'npm.cmd' if os.name == 'nt' else 'npm'
        for command in [[npm, 'test'], [npm, 'run', 'build']]:
            subprocess.run(command, cwd=ROOT, check=True)
        files = {p.relative_to(ROOT / 'dist').as_posix(): p.read_bytes()
                 for p in (ROOT / 'dist').rglob('*') if p.is_file()}
        if 'index.html' not in files or 'manifest.webmanifest' not in files:
            raise RuntimeError('Incomplete build.')
        for name, content in files.items():
            if cfg['password'].encode() in content:
                raise RuntimeError('Credential found in build; upload cancelled.')
            if name.startswith('.') or not name.endswith(('.html', '.js', '.css', '.json', '.webmanifest', '.mp3', '.wav', '.svg', '.png', '.ico', '.woff', '.woff2', '.txt')):
                raise RuntimeError('Unexpected public build file: ' + name)
        files['.htaccess'] = ("Options -Indexes\nDirectoryIndex index.html\nFallbackResource disabled\n"
                             "<IfModule mod_headers.c>\n"
                             '<FilesMatch "\\.(html|json|webmanifest)$">\nHeader set Cache-Control "no-cache"\n</FilesMatch>\n'
                             "</IfModule>\nAddType application/manifest+json .webmanifest\n").encode()

    import paramiko
    ssh = paramiko.SSHClient()
    ssh.load_host_keys(str(known_hosts))
    ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
    ssh.connect(cfg['host'], username=cfg['username'], password=cfg['password'],
                look_for_keys=False, allow_agent=False, timeout=30)
    try:
        sftp = ssh.open_sftp()
        home = sftp.normalize('.')
        document_root = home + '/willshaver.com/public'
        sftp.stat(document_root)
        target = document_root + '/letterjam'
        current = exists(sftp, target)
        print('Destination: ' + URL, flush=True)
        print('Remote target: ' + target, flush=True)
        if args.inspect:
            print('Existing target: ' + ('symlink' if current and stat.S_ISLNK(current.st_mode)
                                        else 'directory' if current and stat.S_ISDIR(current.st_mode) else 'absent'), flush=True)
            if current:
                print('Current entries: ' + ', '.join(sftp.listdir(target)), flush=True)
            return
        if current and not (stat.S_ISLNK(current.st_mode) or stat.S_ISDIR(current.st_mode)):
            raise RuntimeError('The destination is not a directory or symlink.')

        releases = home + '/willshaver.com/.letterjam-releases'
        release_id = time.strftime('%Y%m%d-%H%M%S') + '-' + secrets.token_hex(3)
        release = releases + '/' + release_id
        mkdirs(sftp, release)
        # Keep assets requested by already-open tabs available across releases.
        if current:
            for folder in ('assets', 'audio'):
                source = target + '/' + folder
                if exists(sftp, source):
                    mkdirs(sftp, release + '/' + folder)
                    run(ssh, 'cp -a ' + shlex.quote(source + '/.') + ' ' + shlex.quote(release + '/' + folder + '/'))
        print('Uploading validated release...', flush=True)
        for name, content in files.items():
            remote = release + '/' + name
            mkdirs(sftp, posixpath.dirname(remote))
            with sftp.file(remote, 'wb') as output:
                output.write(content)
            sftp.chmod(remote, 0o644)
        # Independently check the remote bytes before switching the live site.
        for name, content in files.items():
            with sftp.file(release + '/' + name, 'rb') as uploaded:
                if hashlib.sha256(uploaded.read()).digest() != hashlib.sha256(content).digest():
                    raise RuntimeError('Upload checksum mismatch: ' + name)
        temporary = document_root + '/.letterjam-link-' + release_id
        sftp.symlink(release, temporary)
        previous = sftp.readlink(target) if current and stat.S_ISLNK(current.st_mode) else None
        legacy = None
        activated = False
        try:
            if current and stat.S_ISDIR(current.st_mode):
                # First migration preserves the complete old directory for rollback.
                legacy = releases + '/legacy-' + release_id
                sftp.rename(target, legacy)
                previous = legacy
            sftp.posix_rename(temporary, target)
            activated = True
            verify(files)
        except BaseException:
            if activated:
                if legacy:
                    sftp.remove(target)
                    sftp.rename(legacy, target)
                elif previous:
                    sftp.symlink(previous, temporary)
                    sftp.posix_rename(temporary, target)
                else:
                    sftp.remove(target)
            elif legacy:
                sftp.rename(legacy, target)
            if exists(sftp, temporary):
                sftp.remove(temporary)
            print('Publication failed; previous site restored.', flush=True)
            raise
        record = dict(url=URL, release=release, previous=previous, files=len(files),
                      verified_at=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
        (PRIVATE / 'last-publish.json').write_text(json.dumps(record, indent=2) + '\n')
        print(f'Verified {len(files)} uploaded files; all {len(files) - 1} public files match over HTTPS.', flush=True)
        print('Published: ' + URL, flush=True)
    finally:
        ssh.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Publish failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
