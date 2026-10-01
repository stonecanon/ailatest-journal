from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/chrome-web-store/store-screenshots-minimal-v3'
OUT.mkdir(parents=True, exist_ok=True)
W,H=1280,800
BG=Path('/Users/zhizhi/.codex/generated_images/019ff3e2-1feb-7e80-b128-c3812b17e3d8/exec-525e7fe9-a0d3-442a-aea9-c668bbcbdb3b.png')
EN='/System/Library/Fonts/Supplemental/Arial.ttf'; ENB='/System/Library/Fonts/Supplemental/Arial Bold.ttf'; CN='/System/Library/Fonts/Hiragino Sans GB.ttc'
INK=(43,34,27); MUTED=(113,99,87); ORANGE=(224,88,28); CREAM=(255,252,247); LINE=(231,220,209); NAVY=(24,56,91); GREEN=(28,132,99)
def ft(n,b=False,cn=False): return ImageFont.truetype(CN if cn else (ENB if b else EN), n, index=0) if cn else ImageFont.truetype(ENB if b else EN,n)
def bg():
    if BG.exists(): im=Image.open(BG).convert('RGB').resize((W,H),Image.Resampling.LANCZOS)
    else: im=Image.new('RGB',(W,H),(250,246,239))
    veil=Image.new('RGBA',(W,H),(255,250,244,195)); return Image.alpha_composite(im.convert('RGBA'),veil)
def tx(d,xy,s,n,fill=INK,b=False,cn=False): d.text(xy,s,font=ft(n,b,cn),fill=fill)
def rr(d,b,r=18,fill=CREAM,outline=LINE,w=2): d.rounded_rectangle(b,r,fill=fill,outline=outline,width=w)
def badge(d,x,y,s,color=ORANGE,fill=(255,244,233),n=15):
    box=d.textbbox((0,0),s,font=ft(n,True)); ww=box[2]+22; hh=box[3]-box[1]+12; rr(d,(x,y,x+ww,y+hh),hh//2,fill,color,2); tx(d,(x+11,y+5),s,n,color,True); return ww
def logo(d,x,y):
    rr(d,(x,y,x+36,y+36),10,ORANGE,ORANGE,0); tx(d,(x+10,y+7),'A',20,(255,255,255),True)
def title(c,cn_title,en_sub,eyebrow):
    d=ImageDraw.Draw(c); logo(d,68,58); tx(d,(115,64),'AILatest Journal',20,ORANGE,True); tx(d,(70,132),cn_title,40,INK,True,True); tx(d,(72,194),en_sub,19,MUTED); tx(d,(72,240),eyebrow.upper(),13,ORANGE,True,True)
def browser_card(c,b,site='Google Scholar'):
    d=ImageDraw.Draw(c); x,y,w,h=b; rr(d,(x,y,x+w,y+h),20,(255,255,253),(224,213,202),2); d.ellipse((x+22,y+18,x+32,y+28),fill=(226,91,48)); d.ellipse((x+40,y+18,x+50,y+28),fill=(239,176,69)); d.ellipse((x+58,y+18,x+68,y+28),fill=(104,154,101)); rr(d,(x+88,y+14,x+w-24,y+32),9,(247,243,237),None,0); tx(d,(x+104,y+16),site,12,MUTED)
def paper_card(c,b):
    d=ImageDraw.Draw(c); x,y,w,h=b; rr(d,(x,y,x+w,y+h),18,CREAM,(225,215,204),2); tx(d,(x+24,y+24),'BUILDING AND ENVIRONMENT',18,INK,True); tx(d,(x+24,y+52),'Indoor air quality and occupancy estimation',14,MUTED); d.line((x+24,y+84,x+w-24,y+84),fill=LINE,width=2)
    badge(d,x+24,y+104,'SCIE',NAVY,(235,244,251),13); badge(d,x+92,y+104,'EI',(117,86,59),(247,238,229),13); badge(d,x+130,y+104,'Scopus',(31,112,136),(232,247,249),13); badge(d,x+24,y+150,'JCR Q1',(180,57,28),(255,237,230),13); badge(d,x+101,y+150,'CAS 1区 TOP',(111,83,59),(245,239,231),13)
    tx(d,(x+24,y+212),'Impact factor',12,MUTED); tx(d,(x+24,y+232),'7.6',36,ORANGE,True); tx(d,(x+150,y+212),'Review time',12,MUTED); tx(d,(x+150,y+232),'5 months',22,INK,True)
def save(c,name): c.convert('RGB').save(OUT/name,quality=95)
def s1():
    c=bg(); title(c,'看见期刊信号，再决定下一步','Journal ratings appear where you search and read.','核心功能'); d=ImageDraw.Draw(c); browser_card(c,(600,86,580,570)); tx(d,(630,142),'Google Scholar',15,MUTED,True); tx(d,(630,190),'Law and finance',24,INK,True); d.line((630,228,1140,228),fill=LINE,width=2)
    for i,t in enumerate(['A journal title with useful context','A journal title with useful context','A journal title with useful context']):
        yy=260+i*105; tx(d,(630,yy),t,15,INK,True); tx(d,(630,yy+25),'Authors · year · source page',12,MUTED); badge(d,630,yy+51,'SCIE',NAVY,(235,244,251),12); badge(d,694,yy+51,'JCR Q1',ORANGE,(255,239,231),12); badge(d,774,yy+51,'IF 7.6',GREEN,(232,247,240),12)
    save(c,'01-minimal-overview-1280x800.png')
def s2():
    c=bg(); title(c,'一个小徽章，快速判断','Index, quartile and impact factor — together.','期刊信息'); d=ImageDraw.Draw(c); paper_card(c,(430,110,620,430)); tx(d,(70,340),'少切换页面',27,INK,True,True); tx(d,(70,386),'少找数据，先看最关键的信号。',18,MUTED,False,True); badge(d,72,456,'SCIE / EI / Scopus',NAVY,(235,244,251),14); badge(d,72,505,'JCR / CAS / IF',ORANGE,(255,239,231),14); save(c,'02-minimal-badges-1280x800.png')
def s3():
    c=bg(); title(c,'支持你常用的学术网站','One consistent reading layer across your research workflow.','支持范围'); d=ImageDraw.Draw(c); sites=[('Google Scholar','检索结果页'),('PubMed','文章与期刊页'),('CNKI','知网页面'),('Springer · IEEE · Elsevier','期刊官网')]
    for i,(a,b) in enumerate(sites):
        x=80+(i%2)*570; y=310+(i//2)*165; rr(d,(x,y,x+500,y+120),18,CREAM,(225,215,204),2); d.ellipse((x+24,y+30,x+52,y+58),fill=ORANGE); tx(d,(x+74,y+25),a,21,INK,True); tx(d,(x+74,y+63),b,15,MUTED,False,True); tx(d,(x+430,y+38),'→',28,ORANGE,True)
    save(c,'03-minimal-supported-sites-1280x800.png')
def s4():
    c=bg(); title(c,'只显示你需要的信息','Customize language, theme and badge groups in a few clicks.','个性化设置'); d=ImageDraw.Draw(c); rr(d,(430,105,1120,640),24,CREAM,(225,215,204),2); tx(d,(480,150),'Badge settings',25,INK,True); tx(d,(480,205),'Language',14,MUTED); rr(d,(480,235,1045,284),12,(255,255,253),LINE,2); tx(d,(500,249),'中文 / English',16,INK,True,True); tx(d,(480,330),'Badges to display',14,MUTED)
    for i,s in enumerate(['International indexes','JCR quartile','CAS ranking','Chinese rankings']):
        yy=370+i*54; rr(d,(480,yy,510,yy+30),8,ORANGE,ORANGE,0); tx(d,(488,yy+3),'✓',21,(255,255,255),True); tx(d,(530,yy+3),s,17,INK)
    tx(d,(70,370),'你的页面',28,INK,True,True); tx(d,(70,414),'你的阅读节奏',28,INK,True,True); tx(d,(70,466),'显示重要的，隐藏多余的。',18,MUTED,False,True); save(c,'04-minimal-settings-1280x800.png')
def s5():
    c=bg(); title(c,'从检索到选刊，保持同一条线索','Find a fit. Check the evidence. Move on.','工作流'); d=ImageDraw.Draw(c); cards=[('01','检索','Google Scholar / PubMed'),('02','识别','Index · JCR · CAS · IF'),('03','决策','加入收藏，继续比较')]
    for i,(num,a,b) in enumerate(cards):
        x=75+i*390; rr(d,(x,320,x+315,500),20,CREAM,(225,215,204),2); tx(d,(x+26,346),num,16,ORANGE,True); tx(d,(x+26,390),a,26,INK,True,True); tx(d,(x+26,438),b,14,MUTED,False,True)
        if i<2: tx(d,(x+334,390),'→',31,ORANGE,True)
    badge(d,75,580,'AILatest Journal',ORANGE,(255,239,231),15); tx(d,(75,640),'把期刊信息放回你的研究流程里。',20,INK,False,True); save(c,'05-minimal-workflow-1280x800.png')
if __name__=='__main__':
    for fn in (s1,s2,s3,s4,s5): fn()
    print('saved',len(list(OUT.glob('*.png'))),'minimal screenshots to',OUT)
