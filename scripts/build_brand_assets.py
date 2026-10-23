"""Build original vector packaging concepts for the AURELIS demo storefront."""
from pathlib import Path
from html import escape
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'frontend/public'/'images'
OUT.mkdir(exist_ok=True)
def vial(name='PEPTIDE 01',code='AL / 001',accent='#a39779',x=0,y=0,scale=1,rotation=0):
    return f'''<g transform="translate({x} {y}) scale({scale}) rotate({rotation} 100 180)">
    <ellipse cx="100" cy="358" rx="88" ry="15" fill="#000" opacity=".23" filter="url(#blur)"/>
    <path d="M43 72 Q43 60 57 58 L143 58 Q157 60 157 72 L157 96 Q157 109 166 120 Q177 134 177 155 L177 323 Q177 348 152 351 L48 351 Q23 348 23 323 L23 155 Q23 134 34 120 Q43 109 43 96Z" fill="url(#glass)" stroke="#bdc8c5" stroke-opacity=".5"/>
    <path d="M36 285H164V324Q164 338 150 339H50Q36 337 36 324Z" fill="#e9e7dd" opacity=".87"/>
    <rect x="28" y="147" width="144" height="161" rx="2" fill="#f4f2eb"/>
    <rect x="28" y="147" width="144" height="5" fill="{accent}"/>
    <text x="100" y="181" text-anchor="middle" fill="#263b37" font-family="Georgia,serif" font-size="19" letter-spacing="2">AURELIS</text>
    <text x="100" y="196" text-anchor="middle" fill="#75817a" font-family="Arial,sans-serif" font-size="5.5" letter-spacing="2.5">RESEARCH PEPTIDES</text>
    <path d="M44 210H156" stroke="#d3d5ca"/>
    <text x="100" y="235" text-anchor="middle" fill="#283b35" font-family="Arial,sans-serif" font-size="{min(13, 142 / max(len(name),1) / .7):.1f}" font-weight="bold" letter-spacing=".5">{escape(name)}</text>
    <text x="100" y="254" text-anchor="middle" fill="#718078" font-family="Arial,sans-serif" font-size="7" letter-spacing="1">{escape(code)}</text>
    <path d="M44 269H156" stroke="#d3d5ca"/>
    <text x="100" y="286" text-anchor="middle" fill="#7b8378" font-family="Arial,sans-serif" font-size="6" letter-spacing="1">PACKAGING CONCEPT</text>
    <path d="M34 137 Q31 220 35 320" fill="none" stroke="white" stroke-width="4" opacity=".45"/>
    <path d="M162 128 Q171 160 166 324" fill="none" stroke="white" stroke-width="2" opacity=".6"/>
    <rect x="40" y="45" width="120" height="55" rx="8" fill="url(#metal)" stroke="#727a72"/>
    {''.join(f'<path d="M{i} 53V88" stroke="#1a2d27" opacity=".3"/>' for i in range(46,158,5))}
    <ellipse cx="100" cy="47" rx="59" ry="10" fill="#344a40" stroke="#728273"/>
    <ellipse cx="100" cy="45" rx="42" ry="6" fill="#20372e"/>
    <path d="M45 94H155" stroke="#d1d2ba" opacity=".65" stroke-width="2"/>
    </g>'''
DEFS='''<defs>
<linearGradient id="glass" x1="0" x2="1"><stop stop-color="#7c938c" stop-opacity=".7"/><stop offset=".15" stop-color="#e9f0e9" stop-opacity=".85"/><stop offset=".3" stop-color="#aabdb2" stop-opacity=".4"/><stop offset=".65" stop-color="#b3c0b1" stop-opacity=".15"/><stop offset=".9" stop-color="#e6e9dd" stop-opacity=".8"/><stop offset="1" stop-color="#72897e" stop-opacity=".65"/></linearGradient>
<linearGradient id="metal"><stop stop-color="#1b3028"/><stop offset=".25" stop-color="#697b66"/><stop offset=".45" stop-color="#344d3d"/><stop offset=".8" stop-color="#20372e"/><stop offset="1" stop-color="#53674f"/></linearGradient>
<linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eae9e2"/><stop offset="1" stop-color="#d4d7cb"/></linearGradient>
<linearGradient id="dark" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#10231e"/><stop offset=".6" stop-color="#263c30"/><stop offset="1" stop-color="#626c4f"/></linearGradient>
<radialGradient id="light"><stop stop-color="#afba88" stop-opacity=".3"/><stop offset="1" stop-color="#aab483" stop-opacity="0"/></radialGradient>
<linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#90987d"/><stop offset=".02" stop-color="#535f4c"/><stop offset="1" stop-color="#243a2d"/></linearGradient>
<filter id="blur"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".045"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>
</defs>'''
items=[('PEPTIDE 01','AL / 001','#9f946e'),('PEPTIDE 02','AL / 002','#707f76'),('PEPTIDE 03','AL / 003','#7d8a9a'),('PEPTIDE 04','AL / 004','#a58b77'),('PEPTIDE 05','AL / 005','#9589a0'),('PEPTIDE 06','AL / 006','#7b9190'),('DISCOVERY','AL / SET 01','#9f946e'),('REFERENCE','AL / SET 02','#707f76')]
for i,(name,code,accent) in enumerate(items,1):
    art=vial(name,code,accent,150,65,1.0,0)
    if i>6:art=vial('PEPTIDE 01','AL / 001',accent,65,85,.9,-8)+vial('PEPTIDE 02','AL / 002',accent,245,75,.9,6)
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 480">{DEFS}<rect width="500" height="480" fill="url(#back)"/><path d="M0 400L500 220V480H0Z" fill="#cdd1c2" opacity=".35"/>{art}</svg>'
    (OUT/f'peptide-{i:02}.svg').write_text(svg)
hero=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 1000">{DEFS}
<rect width="1100" height="1000" fill="url(#dark)"/>
<ellipse cx="780" cy="270" rx="580" ry="580" fill="url(#light)"/>
<g fill="none" stroke="#c0c8ac" opacity=".12"><circle cx="600" cy="440" r="310"/><circle cx="600" cy="440" r="380"/><path d="M40 740 1060 150M190 880 1060 380"/></g>
<g fill="#b5bea0" opacity=".5"><circle cx="325" cy="294" r="4"/><circle cx="957" cy="311" r="4"/><circle cx="782" cy="770" r="4"/></g>
<path d="M250 730L750 650L1050 750L550 840Z" fill="#7d866a"/><path d="M250 730L550 840V1000H250Z" fill="#46543d"/><path d="M550 840L1050 750V1000H550Z" fill="url(#stone)"/>
<path d="M650 565L960 520L1100 575L800 633Z" fill="#8b9276"/><path d="M650 565L800 633V1000H650Z" fill="#566048"/><path d="M800 633L1100 575V1000H800Z" fill="url(#stone)"/>
{vial('IPAMORELIN','IP5 / 10 VIALS','#7b8f7e',690,150,1.12,0)}
{vial('SLU-PP-332','332 / 10 VIALS','#ac9a6e',350,190,1.62,-6)}
<rect width="1100" height="1000" fill="transparent" filter="url(#grain)"/>
<text x="1000" y="950" fill="#c7cbb8" opacity=".6" text-anchor="end" font-family="Arial" font-size="10" letter-spacing="4">AURELIS / PACKAGING CONCEPT</text></svg>'''
(OUT/'aurelis-hero.svg').write_text(hero)
for i in range(3):
    s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">{DEFS}<rect width="800" height="500" fill="{["#dce0d5","#263c32","#d6d5c9"][i]}"/>'
    if i==0:
        s+='<g fill="none" stroke="#546c5b" stroke-width="2" opacity=".6">'
        coords=[(170,250),(280,180),(390,240),(500,160),(610,230),(500,340),(390,380),(280,330)]
        for a,b in zip(coords,coords[1:]+coords[:1]):s+=f'<path d="M{a[0]} {a[1]}L{b[0]} {b[1]}"/>'
        s+='</g>'+''.join(f'<circle cx="{x}" cy="{y}" r="{18 if j%2 else 30}" fill="url(#metal)"/>' for j,(x,y) in enumerate(coords))
    elif i==1:
        s+='<g transform="rotate(-9 400 250)"><rect x="220" y="65" width="360" height="400" fill="#f0eee5"/><text x="255" y="115" font-family="Georgia" font-size="22" fill="#304438">AURELIS</text><text x="255" y="155" font-family="Arial" font-size="10" fill="#768272" letter-spacing="2">PRODUCT DOCUMENTATION</text>'
        s+=''.join(f'<path d="M255 {y}H{520 if j%3 else 450}" stroke="#c8ccbd" stroke-width="{7 if j%4 else 12}"/>' for j,y in enumerate(range(185,390,27)))+'</g>'
    else:s+=vial('PEPTIDE 03','AL / 003','#7d8a9a',220,10,1.2,12)+'<path d="M540 0V500" stroke="#b4bcab"/>'
    s+='</svg>';(OUT/f'journal-{i}.svg').write_text(s)
print('Created 12 original SVG brand assets.')

for product in json.loads((ROOT/'catalog.json').read_text()):
    if 'variants' not in product: continue
    accent={'GLP Series':'#7c8b78','Single Peptides':'#ac9a6e','Peptide Blends':'#8d8197','Reagents':'#78918c'}[product['category']]
    code=product['variants'][0]['label'].split(' ')[0]
    art=vial(product['name'].upper(),code,accent,150,65,1,0)
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 480">{DEFS}<rect width="500" height="480" fill="url(#back)"/><path d="M0 400L500 220V480H0Z" fill="#cdd1c2" opacity=".35"/>{art}</svg>'
    (OUT/f"catalog-{product['id']}.svg").write_text(svg)
print('Generated branded product visuals for imported catalog.')
