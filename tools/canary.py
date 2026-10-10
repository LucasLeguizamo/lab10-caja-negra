#!/usr/bin/env python3
"""Canario de deriva de versión: reproduce los 20 ejemplos de la mañana y muestra diferencias.

  python3 tools/canary.py s-canario-HHMM
"""
import json,subprocess,sys
seqname=sys.argv[1]
ex=[json.loads(l) for l in open('material/pruebas/ejemplos.jsonl')]
ms=[e['request']['m'] for e in ex]
before=sum(1 for l in open('experimentos.jsonl') if l.strip())
subprocess.run(['python3','tools/probe.py','seq',seqname,'Canario: reproducir 20 ejemplos de la manana y comparar (deriva de version)']+ms,stdout=subprocess.DEVNULL,check=True)
rows=[json.loads(l) for l in open('experimentos.jsonl') if l.strip()]
mine=[r for r in rows if r['seq']==seqname]
print('ids',mine[0]['id'],'..',mine[-1]['id'],'reset:',mine[0]['status'],mine[0]['response'],'xreq',mine[0]['x_req'])
diffs=0
for e,r in zip(ex,mine[1:]):
    ok = e['status']==r['status'] and e['response']==r['response']
    if not ok:
        diffs+=1
        print('DIFF n=%d id=%d m=%r\n  ej: %s %s\n  hoy: %s %s'%(e['n'],r['id'],e['request']['m'],e['status'],json.dumps(e['response'],ensure_ascii=False),r['status'],json.dumps(r['response'],ensure_ascii=False)))
print('diffs',diffs,'x_req seq',[r['x_req'] for r in mine])
