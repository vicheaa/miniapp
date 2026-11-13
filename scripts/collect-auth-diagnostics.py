#!/usr/bin/env python3
"""Collect allowlisted staging auth events without saving raw device logs."""
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--serial', required=True)
parser.add_argument('--output', type=Path)
parser.add_argument('--screenshot', type=Path)
args = parser.parse_args()
adb = shutil.which('adb') or str(Path.home() / 'Library/Android/sdk/platform-tools/adb')
command = [adb, '-s', args.serial]
pid = subprocess.check_output(command + ['shell', 'pidof', 'com.oml.central.staging'], text=True).strip()
if not pid.isdecimal():
    raise SystemExit('Expected one running staging SuperApp process.')
logs = subprocess.check_output(command + ['logcat', '-d', '-t', '5000', '--pid', pid], text=True)
events = []
phases = {'response', 'auth_preflight', 'auth_rejection', 'refresh_start', 'refresh_join', 'refresh_reuse',
          'refresh_result', 'replay_start', 'request_end'}
results = {'success', 'failed', 'unchanged', 'http_error', 'aborted', 'timeout', 'network', 'parse'}
for line in logs.splitlines():
    if '[Miniapp Auth] ' in line:
        try:
            raw = json.loads(line.split('[Miniapp Auth] ', 1)[1])
        except ValueError:
            continue
        if not isinstance(raw, dict) or raw.get('phase') not in phases:
            continue
        event = {'phase': raw['phase']}
        for key in ['requestId', 'attempt', 'status', 'elapsedMs', 'durationMs', 'accessTokenExpiresInSeconds']:
            if isinstance(raw.get(key), (int, float)) or key == 'status' and raw.get(key) is None:
                event[key] = raw[key]
        if raw.get('method') in {'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'}:
            event['method'] = raw['method']
        path = raw.get('path')
        if isinstance(path, str) and path.startswith('/') and len(path) <= 250:
            event['path'] = re.split(r'[?#]', path, maxsplit=1)[0]
        for key in ['managedAuth', 'refreshAvailable', 'sessionCurrent']:
            if isinstance(raw.get(key), bool):
                event[key] = raw[key]
        if raw.get('result') in results:
            event['result'] = raw['result']
        if raw.get('reason') in {'http_401', 'sfa_expired', 'unrecognized'}:
            event['reason'] = raw['reason']
        indicators = raw.get('indicators')
        if isinstance(indicators, dict):
            event['indicators'] = {key: indicators[key] for key in ['dataFailure', 'upstreamUnauthorized',
                'wrappedGet', 'sfaProxy', 'authenticationFailed', 'expiredToken',
                'internalMicroserviceExpired'] if isinstance(indicators.get(key), bool)}
        events.append({'deviceTime': line[:18].strip(), **event})
    for pattern in [r'Access token check: -?\d+ seconds remaining; refresh threshold: 30 seconds',
                    r'Received action: (?:getAuthToken|refreshAuthToken)', r'Token refresh triggered']:
        match = re.search(pattern, line)
        if match:
            events.append({'deviceTime': line[:18].strip(), 'nativeEvent': match.group()})
report = json.dumps({'serial': args.serial, 'events': events}, indent=2) + '\n'
if args.output:
    args.output.write_text(report)
print(report, end='')
if args.screenshot:
    args.screenshot.write_bytes(subprocess.check_output(command + ['exec-out', 'screencap', '-p']))
