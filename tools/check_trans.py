import codecs
c = codecs.open(r'g:\now\adarkroom-main\lang\zh_cn\strings.js', 'r', 'utf-8').read()
keys = [
    'fight', 'continue', 'watch', 'nod', 'rise', 'understood',
    'he is gone before you can speak again.',
    'light the fire', 'who are you', 'run home', 'step inside',
    'face it', "don't look away", 'refuse to fall'
]
for k in keys:
    found = ('"' + k + '"') in c
    print(('OK  ' if found else 'MISS') + ': ' + k)
