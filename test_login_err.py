import urllib.request, json; 
try: 
    req = urllib.request.Request('https://try4-psi.vercel.app/auth/login', data=b'{\"username\":\"admin\",\"password\":\"admin123\"}', headers={'Content-Type': 'application/json'}); 
    res = urllib.request.urlopen(req); 
    print(res.read()) 
except urllib.error.HTTPError as e: 
    print('HTTP ERROR:', e.code, e.reason, e.read());
