"""Generates all app icons + splash from the CapturaGo mark. Run: python3 tools/make-icons.py"""
import os, cairosvg
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'assets')
MARK = "M 0.00 -100.00 Q 3.18 -25.68 14.14 -14.14 Q 25.68 -3.18 100.00 0.00 Q 25.68 3.18 14.14 14.14 Q 3.18 25.68 0.00 100.00 Q -3.18 25.68 -14.14 14.14 Q -25.68 3.18 -100.00 0.00 Q -25.68 -3.18 -14.14 -14.14 Q -3.18 -25.68 0.00 -100.00 Z"
INK, CLAY, WHITE = '#211911', '#B04722', '#FFFFFF'

def svg(fill, bg=None, scale=1.0):
    # viewBox -110..110; scale shrinks the mark toward the centre (safe zones)
    bgr = f'<rect x="-110" y="-110" width="220" height="220" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -110 220 220">{bgr}'
            f'<g transform="scale({scale})"><path d="{MARK}" fill="{fill}"/></g></svg>').encode()

def out(name, data, px):
    cairosvg.svg2png(bytestring=data, write_to=os.path.join(A, name), output_width=px, output_height=px)

out('icon.png', svg(CLAY, INK, 0.78), 1024)                       # iOS + default: square, opaque (Apple adds the rounding)
out('android-icon-background.png', svg(INK, INK, 0), 1024)        # solid ink
out('android-icon-foreground.png', svg(CLAY, None, 0.52), 1024)   # inside Android's 66% safe zone
out('android-icon-monochrome.png', svg(WHITE, None, 0.52), 1024)  # Android 13+ themed icons
out('splash-icon.png', svg(CLAY, None, 0.95), 1024)               # shown at imageWidth on the paper background
out('favicon.png', svg(CLAY, INK, 0.78), 48)
print('icons generated')
