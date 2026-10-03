# Builds one self-contained index.ts per function (easy to paste into Supabase's web editor)
import os
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
lib = open(os.path.join(here, 'lib.js')).read()
for name in ['ai-match', 'stripe-connect', 'create-checkout', 'create-boost', 'stripe-webhook', 'booking-action']:
    body = open(os.path.join(here, f'{name}.js')).read()
    os.makedirs(os.path.join(root, name), exist_ok=True)
    out = (f"// @ts-nocheck\n// CapturaGo edge function: {name}\n// GENERATED from supabase/functions/_src — edit there and re-run build.py\n\n"
           + lib + "\n" + body + "\nexport { createHandler };\n")
    open(os.path.join(root, name, 'index.ts'), 'w').write(out)
    print('built', name, len(out.splitlines()), 'lines')
