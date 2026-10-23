"""Normalize observed public YuanTid product controls into the local catalog.
Input is captured through the browser; this script does not access the network.
"""
import json, re, csv
from decimal import Decimal
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
observed=json.loads((ROOT/'sources/yuantid-observed-2026-10-23.json').read_text())
assert len(observed)==30
categories={'glp':'GLP Series','single':'Single Peptides','blend':'Peptide Blends','blends':'Peptide Blends','reagent':'Reagents','reagents':'Reagents'}
SIZE=re.compile(r'(\d+(?:\.\d+)?)\s*mg\s*\*\s*(\d+)\s*vials',re.I)
def mg(value):
    """Render a milligram figure without a trailing .0 on whole numbers."""
    return str(int(value)) if value==value.to_integral() else str(value.normalize())
def copy_for(name,category,labels,prices):
    """Build the card subtitle and product description from the observed labels.

    Labels that publish a strength ('332 5mg*10vials') are summarised as a
    milligram range; code-only labels ('RT10') are quoted as published, because
    the source catalogue gives no quantity for them and we do not infer one.
    """
    sizes=[(Decimal(m.group(1)),int(m.group(2))) for m in (SIZE.search(l) for l in labels) if m]
    packages='One package' if len(labels)==1 else f'{len(labels)} packages'
    if len(sizes)==len(labels):
        strengths=sorted({s[0] for s in sizes});vials=sorted({s[1] for s in sizes})
        strength=f'{mg(strengths[0])}mg' if len(strengths)==1 else f'{mg(strengths[0])}–{mg(strengths[-1])}mg'
        per=f'{vials[0]} vials' if len(vials)==1 else f'{vials[0]}–{vials[-1]} vials'
        subtitle=f'{len(labels)} package'+('s' if len(labels)>1 else '')+f' · {strength} per vial'
        detail=f'{packages}'+(' to choose from' if len(labels)>1 else '')+f': {strength} per vial, {per} per package.'
    else:
        quoted=', '.join(labels) if len(labels)<=4 else f'{labels[0]} through {labels[-1]}'
        subtitle=f'{len(labels)} package'+('s' if len(labels)>1 else '')+f' · {labels[0] if len(labels)==1 else labels[0]+"–"+labels[-1]}'
        detail=f'{packages}, published as {quoted}. The source catalogue lists these codes without a quantity, so we quote them exactly as published rather than inferring one.'
    low,high=f'{min(prices)/100:.2f}',f'{max(prices)/100:.2f}'
    pricing=f'Priced at ${low} per package' if low==high else f'Prices run from ${low} to ${high} per package'
    return subtitle,(f'{name} is listed in our {category} range. {detail} {pricing}, checked on 23 October 2026 '
        'against the public listing linked below. We reproduce the published name, package label and price, and make '
        'no purity or testing claims of our own. Supplied for research use only — not for human or veterinary use.')
result=[];references=[]
for i,raw in enumerate(observed,1):
    attrs=dict(raw['attributes']); category=categories[attrs['data-cat']]
    pid=2000+i; variants=[]
    assert raw['name'] and raw['variants']
    for j,v in enumerate(raw['variants'],1):
        price=int(Decimal(str(v['price']))*100)
        assert price>0 and v['label']
        variants.append({'id':pid*100+j,'label':v['label'],'price':price,'stock':100,'active':1,'source_variant_id':str(v['id'])})
        references.append({'product':raw['name'],'variant':v['label'],'price_usd':f'{price/100:.2f}','source_url':raw['url'],'checked_on':'2026-10-23','source_variant_id':str(v['id'])})
    prices=[v['price'] for v in variants]
    shown=[int(Decimal(x.replace(',',''))*100) for x in re.findall(r'\$\s*([\d,]+\.\d{2})',raw['price'])]
    assert shown[0]==min(prices) and shown[-1]==max(prices),(raw['name'],shown,prices)
    subtitle,description=copy_for(raw['name'],category,[v['label'] for v in variants],prices)
    result.append({'id':pid,'name':raw['name'],'subtitle':subtitle,'category':category,'price':min(prices),'old_price':0,'stock':sum(v['stock'] for v in variants),'image':f'/images/catalog-{pid}.svg','tag':category.upper(),'description':description,'source_url':raw['url'],'source_checked_on':'2026-10-23','variants':variants})
image_manifest=json.loads((ROOT/'sources/yuantid-images-2026-10-23.json').read_text())
for product in result:
    source=next(x for x in image_manifest if x['id']==product['id'])
    product['gallery']=source['local_images']
    product['image']=product['gallery'][0]
(ROOT/'catalog.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(ROOT/'sources/yuantid-2026-10-23.json').write_text(json.dumps({'source':'https://www.yuantid.com/pages/shop','checked_on':'2026-10-23','products':result},ensure_ascii=False,indent=2)+'\n')
with (ROOT/'sources/yuantid-prices-2026-10-23.csv').open('w',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=list(references[0]));writer.writeheader();writer.writerows(references)
print(f'Validated {len(result)} products and {len(references)} variant prices against catalog ranges.')
