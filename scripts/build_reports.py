from pathlib import Path
import re, html, sys
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER,TA_JUSTIFY
import pypdfium2 as pdfium
from pypdf import PdfReader
from PIL import Image as PILImage,ImageDraw
ROOT=Path(__file__).resolve().parents[1]; BASE=ROOT/'docs'/'reports'; QA=ROOT/'.work'/'reports';QA.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('Arial','C:/Windows/Fonts/arial.ttf'));pdfmetrics.registerFont(TTFont('Arial-Bold','C:/Windows/Fonts/arialbd.ttf'));pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='Arial-Bold',italic='Arial',boldItalic='Arial-Bold')
styles={
 'title':ParagraphStyle('title',fontName='Arial-Bold',fontSize=22,leading=28,spaceAfter=20,textColor=colors.black),
 'h':ParagraphStyle('h',fontName='Arial-Bold',fontSize=15,leading=20,spaceBefore=20,spaceAfter=12,keepWithNext=True,textColor=colors.black),
 'p':ParagraphStyle('p',fontName='Arial',fontSize=11,leading=16,spaceAfter=10,alignment=TA_JUSTIFY),
 'caption':ParagraphStyle('caption',fontName='Arial',fontSize=10,leading=14,spaceBefore=8,spaceAfter=12,alignment=TA_CENTER),
 'cell':ParagraphStyle('cell',fontName='Arial',fontSize=9,leading=12,spaceAfter=0),
 'source':ParagraphStyle('source',fontName='Arial',fontSize=9,leading=13,spaceAfter=10,wordWrap='CJK'),
}
def para(s,style='p'):
 s=html.escape(s)
 s=re.sub(r'(https?://[^\s]+)',lambda m:f'<link href="{m[0]}">{m[0]}</link>',s)
 return Paragraph(s,styles[style])
def footer(c,d):
 c.setFont('Arial',9);c.setFillColor(colors.HexColor('#60656c'));c.drawRightString(547,28,str(d.page))
def build(file):
 lines=file.read_text(encoding='utf-8').splitlines();story=[];i=0;tables=0;figures=0
 while i<len(lines):
  l=lines[i].strip()
  if not l:i+=1;continue
  if l.startswith('# '):story.append(para(l[2:],'title'));i+=1;continue
  if l=='## Источники':
   source_block=[para('Источники','h')]
   for tail in lines[i+1:]:
    if tail.strip():source_block.append(para(tail.strip(),'source'))
   story.extend([PageBreak(),*source_block]);break
  if l.startswith('## '):story.append(para(l[3:],'h'));i+=1;continue
  if l.startswith('!['):
   cap,path=re.match(r'!\[(.*?)\]\((.*?)\)',l).groups();p=BASE/path;image=Image(str(p),width=482,height=482*650/1320);story.append(KeepTogether([Spacer(1,5),image,para(cap,'caption')]));figures+=1;i+=1;continue
  if l.startswith('|'):
   rows=[]
   while i<len(lines) and lines[i].strip().startswith('|'):
    cells=[c.strip() for c in lines[i].strip().strip('|').split('|')]
    if not all(re.fullmatch(r'[-: ]+',c) for c in cells):rows.append([para(c,'cell') for c in cells])
    i+=1
   n=len(rows[0]);w=[482/n]*n
   t=Table(rows,colWidths=w,repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e8edf1')),('VALIGN',(0,0),(-1,-1),'TOP'),('BOX',(0,0),(-1,-1),.5,colors.HexColor('#aeb9c2')),('INNERGRID',(0,0),(-1,-1),.4,colors.HexColor('#c7cfd5')),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]));caption=story.pop();story.append(KeepTogether([caption,t,Spacer(1,15)]));tables+=1;continue
  style='source' if l.startswith('[') or l.startswith('Дата ') else 'caption' if l.startswith('Таблица ') else 'p'
  story.append(para(l,style));i+=1
 out=BASE/(file.stem+'.pdf');doc=SimpleDocTemplate(str(out),pagesize=(595.28,841.89),leftMargin=56,rightMargin=57,topMargin=48,bottomMargin=48,title=lines[0][2:],author='',subject='Учебный отчёт')
 doc.build(story,onFirstPage=footer,onLaterPages=footer)
 pdf=pdfium.PdfDocument(str(out));sub=QA/file.stem;sub.mkdir(exist_ok=True)
 for j,page in enumerate(pdf):page.render(scale=1.7).to_pil().convert('RGB').save(sub/f'page-{j+1:02}.png')
 previews=[]
 for p in sorted(sub.glob('page-*.png')):
  im=PILImage.open(p);im.thumbnail((298,422));previews.append((im.copy(),p.name))
 sheet=PILImage.new('RGB',(4*318,((len(previews)+3)//4)*456),'#c6c9ce');draw=ImageDraw.Draw(sheet)
 for j,(im,n) in enumerate(previews):x=(j%4)*318+10;y=(j//4)*456+10;sheet.paste(im,(x,y));draw.text((x,y+425),n,fill='black')
 sheet.save(QA/f'{file.stem}-overview.png')
 reader=PdfReader(out);print(f'{out.name}: {len(reader.pages)} pages, {figures} figures, {tables} tables, {sum(len(p.extract_text().split()) for p in reader.pages)} words')
for file in ([BASE/(name+'.md') for name in sys.argv[1:]] if len(sys.argv)>1 else [BASE/'ARIS.md',BASE/'КИС.md']):build(file)
