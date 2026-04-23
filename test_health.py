import urllib.request, json; 
try: 
    res = urllib.request.urlopen('https://try4-psi.vercel.app/health'); 
    print('STATUS:', res.getcode(), 'BODY:', res.read()[:200]) 
except urllib.error.HTTPError as e: 
    print('HTTP ERROR:', e.code, e.reason, e.read()[:200]);
